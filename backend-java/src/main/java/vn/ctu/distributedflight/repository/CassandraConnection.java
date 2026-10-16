package vn.ctu.distributedflight.repository;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.*;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import com.datastax.oss.driver.api.core.*;
import com.datastax.oss.driver.api.core.config.*;

@Component
public class CassandraConnection {
    private final String contacts,datacenter,keyspace,consistency;
    private volatile CqlSession session;
    private long reconnectAfter;
    public CassandraConnection(@Value("${spring.cassandra.contact-points}") String contacts,
            @Value("${spring.cassandra.local-datacenter}") String datacenter,
            @Value("${spring.cassandra.keyspace-name}") String keyspace,
            @Value("${app.cassandra.consistency:LOCAL_QUORUM}") String consistency) {
        if(!keyspace.matches("[a-zA-Z][a-zA-Z0-9_]*")) throw new IllegalArgumentException("Invalid Cassandra keyspace");
        this.contacts=contacts; this.datacenter=datacenter; this.keyspace=keyspace; this.consistency=consistency;
    }
    public synchronized CqlSession session() {
        if(session!=null&&!session.isClosed()) return session;
        if(System.nanoTime()<reconnectAfter) throw new IllegalStateException("Cassandra connection retry pending");
        try {
            var config=DriverConfigLoader.programmaticBuilder()
                .withDuration(DefaultDriverOption.REQUEST_TIMEOUT,Duration.ofSeconds(2))
                .withDuration(DefaultDriverOption.CONNECTION_CONNECT_TIMEOUT,Duration.ofSeconds(2))
                .withDuration(DefaultDriverOption.CONNECTION_INIT_QUERY_TIMEOUT,Duration.ofSeconds(2))
                .withString(DefaultDriverOption.REQUEST_CONSISTENCY,consistency).build();
            var builder=CqlSession.builder().withLocalDatacenter(datacenter).withConfigLoader(config);
            for(String contact:contacts.split(",")) {
                String[] parts=contact.trim().split(":");
                builder.addContactPoint(InetSocketAddress.createUnresolved(parts[0],parts.length>1?Integer.parseInt(parts[1]):9042));
            }
            // Connect lazily, so Cassandra downtime does not prevent SQL booking startup.
            var pending=builder.withKeyspace(keyspace).buildAsync().toCompletableFuture();
            try { session=pending.get(5,TimeUnit.SECONDS); }
            catch(TimeoutException ex) {
                // Close a late successful session; never leak background connection resources.
                pending.whenComplete((late,error)->{if(late!=null) late.closeAsync();});
                throw new IllegalStateException("Cassandra connection timed out",ex);
            } catch(InterruptedException ex) {
                pending.whenComplete((late,error)->{if(late!=null) late.closeAsync();});
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Cassandra connection interrupted",ex);
            } catch(ExecutionException ex) { throw new IllegalStateException("Cassandra connection unavailable",ex.getCause()); }
            return session;
        } catch(RuntimeException ex) {
            reconnectAfter=System.nanoTime()+Duration.ofSeconds(3).toNanos();
            throw ex;
        }
    }
    public String datacenter() { return datacenter; }
    public String keyspace() { return keyspace; }
    public String consistency() { return consistency; }
    @PreDestroy public synchronized void close() { if(session!=null) session.close(); }
}
