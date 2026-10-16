package vn.ctu.distributedflight.monitoring;

import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import vn.ctu.distributedflight.repository.ReplicationRepository;
import vn.ctu.distributedflight.repository.ReplicationRepository.Range;

/**
 * How many copies of the data exist and on which nodes, read from the databases themselves:
 * CockroachDB range replicas/leaseholders and Cassandra token ownership. Never derived from the node list alone.
 */
@Service
public class ReplicationService {
    public record NodeShare(int nodeId,String address,boolean live,int leaseholderRanges,int replicaRanges) {}
    public record TableShare(String table,int ranges,double sizeMb,Map<Integer,Integer> rangesByCopies) {}
    public record Cockroach(String status,Integer targetReplicas,int liveNodes,int knownNodes,int ranges,int minCopies,int maxCopies,
            int rangesWithoutMajority,List<NodeShare> nodes,List<TableShare> tables,String error) {}
    public record Cassandra(String status,String keyspace,String strategy,Integer replicationFactor,String consistency,
            int nodesInDatacenter,int liveNodes,Integer copiesPerRow,Integer requiredForWrite,Integer liveCopiesWorstCase,
            Boolean writableWorstCase,List<ReplicationRepository.CassandraNode> nodes,String error) {}
    public record Placement(UUID bookingId,String bookingCode,Long rangeId,Integer leaseHolder,List<Integer> cockroachReplicas,List<String> cassandraReplicas) {}
    public record Snapshot(Cockroach cockroach,Cassandra cassandra,List<Placement> samples,String observedAt) {}

    private static final long CACHE_MS=5000;
    private final ReplicationRepository repository;
    private Snapshot cached;
    private long cachedAt;
    public ReplicationService(ReplicationRepository repository) { this.repository=repository; }

    // SHOW RANGES scans every table; a short cache keeps several open browsers from repeating it.
    public synchronized Snapshot snapshot() {
        if(cached!=null&&System.currentTimeMillis()-cachedAt<CACHE_MS) return cached;
        Cockroach cockroach=cockroach();
        Cassandra cassandra=cassandra();
        cached=new Snapshot(cockroach,cassandra,samples(!"UNAVAILABLE".equals(cockroach.status())),Instant.now().toString());
        cachedAt=System.currentTimeMillis();
        return cached;
    }

    private Cockroach cockroach() {
        try {
            var nodes=repository.cockroachNodes();
            Integer target=repository.targetReplicas();
            List<Range> all=new ArrayList<>();
            for(String table:ReplicationRepository.TABLES) all.addAll(repository.ranges(table));
            // Small tables can share one range, so node counts use each range once.
            Map<Long,Range> distinct=new LinkedHashMap<>();
            all.forEach(range->distinct.putIfAbsent(range.rangeId(),range));
            Set<Integer> live=new HashSet<>();
            nodes.stream().filter(ReplicationRepository.CockroachNode::live).forEach(node->live.add(node.nodeId()));
            List<NodeShare> shares=nodes.stream().map(node->new NodeShare(node.nodeId(),node.address(),node.live(),
                (int)distinct.values().stream().filter(r->Objects.equals(r.leaseHolder(),node.nodeId())).count(),
                (int)distinct.values().stream().filter(r->r.replicas().contains(node.nodeId())).count())).toList();
            List<TableShare> tables=ReplicationRepository.TABLES.stream().map(table->{
                var ranges=all.stream().filter(r->r.table().equals(table)).toList();
                Map<Integer,Integer> byCopies=new TreeMap<>();
                ranges.forEach(r->byCopies.merge(r.replicas().size(),1,Integer::sum));
                return new TableShare(table,ranges.size(),ranges.stream().mapToDouble(Range::sizeMb).sum(),byCopies);
            }).toList();
            int without=(int)distinct.values().stream().filter(r->!hasMajority(r.replicas(),live)).count();
            IntSummaryStatistics copies=distinct.values().stream().mapToInt(r->r.replicas().size()).summaryStatistics();
            return new Cockroach(without==0?"AVAILABLE":"PARTIAL",target,live.size(),nodes.size(),distinct.size(),
                distinct.isEmpty()?0:copies.getMin(),distinct.isEmpty()?0:copies.getMax(),without,shares,tables,null);
        } catch(RuntimeException ex) {
            return new Cockroach("UNAVAILABLE",null,0,0,0,0,0,0,List.of(),List.of(),ex.getClass().getSimpleName());
        }
    }

    private Cassandra cassandra() {
        String consistency=repository.consistency();
        try {
            var keyspace=repository.keyspace();
            String datacenter=repository.localDatacenter();
            Integer factor=parse(keyspace.strategy().equals("SimpleStrategy")?keyspace.replication().get("replication_factor"):keyspace.replication().get(datacenter));
            var nodes=repository.cassandraNodes();
            int inDc=(int)nodes.stream().filter(n->datacenter.equals(n.datacenter())).count();
            int live=(int)nodes.stream().filter(n->datacenter.equals(n.datacenter())&&"UP".equals(n.state())).count();
            Integer copies=factor==null?null:Math.min(factor,inDc);
            Integer required=factor==null?null:requiredReplicas(consistency,factor);
            Integer worst=copies==null?null:Math.max(0,copies-(inDc-live));
            return new Cassandra("AVAILABLE",repository.keyspaceName(),keyspace.strategy(),factor,consistency,inDc,live,
                copies,required,worst,worst==null||required==null?null:worst>=required,nodes,null);
        } catch(RuntimeException ex) {
            return new Cassandra("UNAVAILABLE",null,null,null,consistency,0,0,null,null,null,null,List.of(),ex.getClass().getSimpleName());
        }
    }
    private List<Placement> samples(boolean sqlAvailable) {
        if(!sqlAvailable) return List.of();
        try {
            return repository.latestBookings(5).stream().map(booking->{
                Range range=null;List<String> cassandra=List.of();
                try { range=repository.rangeOfBooking(booking.id()).orElse(null); } catch(RuntimeException ignored) { }
                try { cassandra=repository.cassandraReplicas(booking.id()); } catch(RuntimeException ignored) { }
                return new Placement(booking.id(),booking.code(),range==null?null:range.rangeId(),range==null?null:range.leaseHolder(),
                    range==null?List.of():range.replicas(),cassandra);
            }).toList();
        } catch(RuntimeException ex) { return List.of(); }
    }

    /** Majority (Raft quorum) of a range with this many copies. */
    public static int majority(int copies) { return copies/2+1; }
    public static boolean hasMajority(List<Integer> replicas,Set<Integer> liveNodes) {
        return !replicas.isEmpty()&&replicas.stream().filter(liveNodes::contains).count()>=majority(replicas.size());
    }
    /** Copies that must acknowledge a Cassandra write at this consistency level for a keyspace with this RF. */
    public static int requiredReplicas(String consistency,int replicationFactor) {
        return switch(consistency==null?"":consistency.toUpperCase(Locale.ROOT)) {
            case "ONE","LOCAL_ONE","ANY" -> 1;
            case "TWO" -> 2;
            case "THREE" -> 3;
            case "ALL" -> replicationFactor;
            default -> replicationFactor/2+1;
        };
    }
    private static Integer parse(String value) {
        try { return value==null?null:Integer.valueOf(value.trim()); } catch(NumberFormatException ex) { return null; }
    }
}
