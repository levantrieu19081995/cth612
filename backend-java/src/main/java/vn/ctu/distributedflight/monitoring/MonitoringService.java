package vn.ctu.distributedflight.monitoring;

import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import jakarta.annotation.PreDestroy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vn.ctu.distributedflight.repository.*;

@Service
public class MonitoringService {
    public record Machine(String machineId,String host,String cockroach,String cassandra,String hostObservation,
            String cockroachAddress,String cassandraAddress) {}
    public record Cluster(int activeNodes,int expectedNodes,Integer registeredNodes,String status,boolean queryAvailable) {}
    public record Transition(String machineId,String service,String before,String after,String observedAt) {}
    public record Overview(String mode,String systemStatus,List<Machine> machines,Cluster cockroach,Cluster cassandra,
            OutboxRepository.Stats outbox,List<Transition> transitions,String observedAt,List<MachineMatrix.PhysicalMachine> physicalMachines) {}
    private final MonitorConfiguration.Properties config;
    private final AnalyticsRepository sql;
    private final EventRepository events;
    private final OutboxRepository outbox;
    private final MachineMatrix matrix;
    private final ExecutorService pool=Executors.newFixedThreadPool(8);
    // Plain HTTP health endpoints (including Next.js) may reject an h2c upgrade.
    private final HttpClient http=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(1)).build();
    private final Deque<Transition> transitions=new ArrayDeque<>();
    private volatile Overview snapshot;
    public MonitoringService(MonitorConfiguration.Properties config,AnalyticsRepository sql,EventRepository events,OutboxRepository outbox,MachineMatrix matrix) {
        this.config=config;this.sql=sql;this.events=events;this.outbox=outbox;this.matrix=matrix;
        var initial=config.nodes().stream().map(n->new Machine(n.id(),n.host(),"UNKNOWN","UNKNOWN","UNKNOWN",
            URI.create(n.cockroachUrl()).getHost(),n.cassandraHost())).toList();
        snapshot=new Overview(config.mode(),"UNKNOWN",initial,new Cluster(0,initial.size(),null,"UNKNOWN",false),
            new Cluster(0,initial.size(),null,"UNKNOWN",false),null,List.of(),null,matrix.observe(initial,Map.of()));
    }
    public Overview overview() { return snapshot; }
    @Scheduled(fixedDelayString="${app.monitor.poll-ms:4000}",initialDelay=1000)
    public synchronized void refresh() {
        List<CompletableFuture<Machine>> probes=config.nodes().stream().map(n->CompletableFuture.supplyAsync(()->{
            String cr=probeHttp(n.cockroachUrl());
            String cs;
            try { cs=events.probeNode(n.cassandraHost(),n.cassandraPort(),config.nodes().size()==1); }
            catch(RuntimeException ex) { cs="OFFLINE"; }
            return new Machine(n.id(),n.host(),cr,cs,cr.equals("ONLINE")||cs.equals("ONLINE")?"REACHABLE":"UNKNOWN",
                URI.create(n.cockroachUrl()).getHost(),n.cassandraHost());
        },pool)).toList();
        Map<String,CompletableFuture<String>> applicationProbes=new LinkedHashMap<>();
        for(var host:matrix.hosts()) for(var service:host.services()) {
            applicationProbes.put(MachineMatrix.endpointKey(host.id(),service.id()),CompletableFuture.supplyAsync(()->probeHttp(service.url()),pool));
        }
        List<Machine> machines=probes.stream().map(CompletableFuture::join).toList();
        Map<String,String> applicationStates=new HashMap<>();
        applicationProbes.forEach((key,probe)->applicationStates.put(key,probe.join()));
        boolean sqlReady=false,cassandraReady=false;
        Integer sqlMembers=null,casMembers=null;
        OutboxRepository.Stats stats=null;
        try { sqlReady=sql.sqlReady();sqlMembers=sql.cockroachMembership();stats=outbox.stats(); } catch(RuntimeException ex) { sqlReady=false; }
        try { events.countByDay(LocalDate.now(ZoneOffset.UTC));cassandraReady=true;casMembers=events.nodes().size(); } catch(RuntimeException ex) { cassandraReady=false; }
        int cr=(int)machines.stream().filter(m->m.cockroach().equals("ONLINE")).count();
        int cs=(int)machines.stream().filter(m->m.cassandra().equals("ONLINE")).count();
        int expected=machines.size();
        String crState=state(sqlReady,cr,expected),csState=state(cassandraReady,cs,expected);
        String state=!sqlReady?"UNAVAILABLE":crState.equals("HEALTHY")&&csState.equals("HEALTHY")?"HEALTHY":"DEGRADED";
        if(state.equals("HEALTHY")&&stats!=null&&stats.pending()>0&&stats.oldestPendingAgeMs()>10000) state="DEGRADED";
        String observed=Instant.now().toString();
        for(int i=0;i<machines.size();i++) {
            var current=machines.get(i);var previous=snapshot.machines().get(i);
            transition(current.machineId(),"CockroachDB",previous.cockroach(),current.cockroach(),observed);
            transition(current.machineId(),"Cassandra",previous.cassandra(),current.cassandra(),observed);
        }
        snapshot=new Overview(config.mode(),state,machines,new Cluster(cr,expected,sqlMembers,crState,sqlReady),
            new Cluster(cs,expected,casMembers,csState,cassandraReady),stats,List.copyOf(transitions),observed,matrix.observe(machines,applicationStates));
    }
    public static String state(boolean queryAvailable,int online,int expected) {
        return !queryAvailable?"UNAVAILABLE":online==expected?"HEALTHY":"DEGRADED";
    }
    private void transition(String id,String service,String before,String after,String at) {
        if(before.equals(after)) return;
        transitions.addFirst(new Transition(id,service,before,after,at));
        while(transitions.size()>100) transitions.removeLast();
    }
    private String probeHttp(String url) {
        try {
            var response=http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofMillis(1500)).GET().build(),HttpResponse.BodyHandlers.discarding());
            return response.statusCode()==200?"ONLINE":"OFFLINE";
        } catch(Exception ex) {
            if(ex instanceof InterruptedException) Thread.currentThread().interrupt();
            return "OFFLINE";
        }
    }
    @PreDestroy public void close() { pool.shutdownNow(); }
}
