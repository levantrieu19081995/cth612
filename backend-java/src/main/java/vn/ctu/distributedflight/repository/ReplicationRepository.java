package vn.ctu.distributedflight.repository;

import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.sql.Array;
import java.sql.SQLException;
import java.util.*;
import java.util.regex.Pattern;
import com.datastax.oss.driver.api.core.ProtocolVersion;
import com.datastax.oss.driver.api.core.metadata.Node;
import com.datastax.oss.driver.api.core.type.codec.TypeCodecs;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads where data physically lives: CockroachDB ranges/replicas and Cassandra token ownership. Read-only. */
@Repository
public class ReplicationRepository {
    public record CockroachNode(int nodeId,String address,boolean live) {}
    public record Range(String table,long rangeId,Integer leaseHolder,List<Integer> replicas,double sizeMb) {}
    public record Booking(UUID id,String code) {}
    public record CassandraNode(String address,String datacenter,String state) {}
    public record Keyspace(String strategy,Map<String,String> replication) {}
    /** Tables whose rows grow with bookings; fixed list, never user input. */
    public static final List<String> TABLES=List.of("bookings","payments","outbox_events","flight_seats");
    private static final Pattern NUM_REPLICAS=Pattern.compile("num_replicas\\s*=\\s*(\\d+)");
    private final JdbcTemplate jdbc;
    private final CassandraConnection cassandra;
    public ReplicationRepository(JdbcTemplate jdbc,CassandraConnection cassandra) { this.jdbc=jdbc;this.cassandra=cassandra; }

    public Integer targetReplicas() {
        String sql=jdbc.queryForObject("SELECT raw_config_sql FROM [SHOW ZONE CONFIGURATION FROM DATABASE flight_booking]",String.class);
        var match=NUM_REPLICAS.matcher(sql==null?"":sql);
        return match.find()?Integer.valueOf(match.group(1)):null;
    }
    public List<CockroachNode> cockroachNodes() {
        return jdbc.query("SELECT node_id,address,is_live FROM crdb_internal.gossip_nodes ORDER BY node_id",
            (rs,n)->new CockroachNode(rs.getInt("node_id"),rs.getString("address"),rs.getBoolean("is_live")));
    }
    public List<Range> ranges(String table) {
        if(!TABLES.contains(table)) throw new IllegalArgumentException("Unknown table "+table);
        return jdbc.query("SELECT range_id,lease_holder,replicas,range_size_mb FROM [SHOW RANGES FROM TABLE flight_booking."+table+" WITH DETAILS]",
            (rs,n)->new Range(table,rs.getLong("range_id"),leaseHolder(rs),ints(rs.getArray("replicas")),rs.getDouble("range_size_mb")));
    }
    /** Exact row count of one of the fixed tables (the name is checked against the list, never user input). */
    public long rowCount(String table) {
        if(!TABLES.contains(table)) throw new IllegalArgumentException("Unknown table "+table);
        Long count=jdbc.queryForObject("SELECT count(*) FROM "+table,Long.class);
        return count==null?0:count;
    }
    public List<Booking> latestBookings(int limit) {
        return jdbc.query("SELECT id,booking_code FROM bookings ORDER BY created_at DESC LIMIT ?",
            (rs,n)->new Booking(rs.getObject("id",UUID.class),rs.getString("booking_code")),limit);
    }
    /** The range holding one booking row; the UUID type rules out injection in the inlined literal. */
    public Optional<Range> rangeOfBooking(UUID id) {
        return jdbc.query("SELECT range_id,lease_holder,replicas FROM [SHOW RANGE FROM TABLE bookings FOR ROW ('"+id+"')]",
            (rs,n)->new Range("bookings",rs.getLong("range_id"),leaseHolder(rs),ints(rs.getArray("replicas")),0)).stream().findFirst();
    }
    // INT8 column: the driver returns Long; null while a range has no lease.
    private static Integer leaseHolder(java.sql.ResultSet rs) throws SQLException {
        Object value=rs.getObject("lease_holder");
        return value==null?null:((Number)value).intValue();
    }
    private static List<Integer> ints(Array array) throws SQLException {
        if(array==null) return List.of();
        List<Integer> values=new ArrayList<>();
        for(Object value:(Object[])array.getArray()) values.add(((Number)value).intValue());
        return values;
    }

    public Keyspace keyspace() {
        var metadata=cassandra.session().getMetadata().getKeyspace(cassandra.keyspace())
            .orElseThrow(()->new IllegalStateException("Keyspace "+cassandra.keyspace()+" not found"));
        var replication=new TreeMap<>(metadata.getReplication());
        String strategy=replication.remove("class");
        return new Keyspace(strategy==null?"":strategy.substring(strategy.lastIndexOf('.')+1),replication);
    }
    public List<CassandraNode> cassandraNodes() {
        return cassandra.session().getMetadata().getNodes().values().stream()
            .map(node->new CassandraNode(address(node),node.getDatacenter(),node.getState().name()))
            .sorted(Comparator.comparing(CassandraNode::address)).toList();
    }
    /** Nodes owning the partition of booking_events_by_booking for this booking (from the driver token map). */
    public List<String> cassandraReplicas(UUID bookingId) {
        var session=cassandra.session();
        ByteBuffer key=TypeCodecs.UUID.encode(bookingId,ProtocolVersion.DEFAULT);
        return session.getMetadata().getTokenMap()
            .map(map->map.getReplicas(cassandra.keyspace(),key).stream().map(ReplicationRepository::address).sorted().toList())
            .orElse(List.of());
    }
    public String localDatacenter() { return cassandra.datacenter(); }
    public String keyspaceName() { return cassandra.keyspace(); }
    public String consistency() { return cassandra.consistency(); }
    private static String address(Node node) {
        var endpoint=node.getEndPoint().resolve();
        return endpoint instanceof InetSocketAddress inet?inet.getHostString():String.valueOf(endpoint);
    }
}
