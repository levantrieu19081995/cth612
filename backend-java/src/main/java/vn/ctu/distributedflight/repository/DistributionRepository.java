package vn.ctu.distributedflight.repository;

import java.time.*;
import java.nio.ByteBuffer;
import java.util.*;
import com.datastax.oss.driver.api.core.ProtocolVersion;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.type.codec.TypeCodecs;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read-only data browser. SQL names are selected from fixed allowlists. */
@Repository
public class DistributionRepository {
    public static final Set<String> SQL_TABLES=Set.of("bookings","payments","outbox_events","flight_seats");
    public static final Set<String> CQL_TABLES=Set.of("booking_events_by_booking","booking_events_by_day");
    public record DataRow(UUID id,UUID bookingId,String label,String status,String occurredAt) {}
    public record Placement(Long rangeId,Integer leaseholder,List<String> replicas) {}
    public record CqlPage(List<DataRow> rows,String cursor) {}
    private final JdbcTemplate jdbc;
    private final CassandraConnection cassandra;
    public DistributionRepository(JdbcTemplate jdbc,CassandraConnection cassandra) { this.jdbc=jdbc;this.cassandra=cassandra; }

    public List<DataRow> sqlRows(String table,String query,UUID after,int limit) {
        if(!SQL_TABLES.contains(table)) throw new IllegalArgumentException("Unknown table");
        String from,booking,label,status,time;
        switch(table) {
            case "bookings" -> {from="bookings t";booking="t.id";label="t.booking_code";status="t.status";time="t.created_at";}
            case "payments" -> {from="payments t LEFT JOIN bookings b ON b.id=t.booking_id";booking="t.booking_id";label="COALESCE(b.booking_code,CAST(t.id AS STRING))";status="t.status";time="t.created_at";}
            case "outbox_events" -> {from="outbox_events t LEFT JOIN bookings b ON b.id=t.aggregate_id";booking="t.aggregate_id";label="COALESCE(b.booking_code,CAST(t.id AS STRING))";status="CASE WHEN t.published_at IS NULL THEN 'PENDING' ELSE 'PUBLISHED' END";time="t.occurred_at";}
            default -> {from="flight_seats t";booking="CAST(NULL AS UUID)";label="t.seat_no";status="t.status";time="CAST(NULL AS TIMESTAMPTZ)";}
        }
        String sql="SELECT t.id,"+booking+" booking_id,"+label+" label,"+status+" status,"+time+" occurred_at FROM "+from+
            " WHERE (?='' OR lower("+label+") LIKE ? OR CAST(t.id AS STRING)=?)"+
            " AND (CAST(? AS UUID) IS NULL OR t.id>CAST(? AS UUID)) ORDER BY t.id LIMIT ?";
        String key=after==null?null:after.toString();
        return jdbc.query(sql,(r,n)->new DataRow(r.getObject("id",UUID.class),r.getObject("booking_id",UUID.class),
            r.getString("label"),r.getString("status"),r.getString("occurred_at")),query,"%"+query.toLowerCase(Locale.ROOT)+"%",query,key,key,limit);
    }
    public Placement sqlPlacement(String table,UUID id) {
        if(!SQL_TABLES.contains(table)) throw new IllegalArgumentException("Unknown table");
        return jdbc.query("SELECT range_id,lease_holder,replicas FROM [SHOW RANGE FROM TABLE "+table+" FOR ROW ('"+id+"')]",(r,n)->{
            List<String> replicas=new ArrayList<>();
            var array=r.getArray("replicas");
            if(array!=null)for(Object value:(Object[])array.getArray())replicas.add(String.valueOf(((Number)value).intValue()));
            Number holder=(Number)r.getObject("lease_holder");
            return new Placement(r.getLong("range_id"),holder==null?null:holder.intValue(),replicas);
        }).stream().findFirst().orElse(new Placement(null,null,List.of()));
    }
    public Optional<UUID> bookingId(String code) {
        return jdbc.query("SELECT id FROM bookings WHERE booking_code=? ORDER BY id LIMIT 1",(r,n)->r.getObject("id",UUID.class),code).stream().findFirst();
    }
    public List<String> cqlReplicas(String table,String partition) {
        ByteBuffer key=table.equals("booking_events_by_booking")?TypeCodecs.UUID.encode(UUID.fromString(partition),ProtocolVersion.DEFAULT):TypeCodecs.DATE.encode(LocalDate.parse(partition),ProtocolVersion.DEFAULT);
        var session=cassandra.session();
        return session.getMetadata().getTokenMap().orElseThrow(()->new IllegalStateException("Token metadata unavailable"))
            .getReplicas(cassandra.keyspace(),key).stream().map(n->{var a=n.getEndPoint().resolve();return a instanceof java.net.InetSocketAddress i?i.getHostString():a.toString();}).sorted().toList();
    }
    public CqlPage cqlRows(String table,String partition,String cursor,int limit) {
        if(!CQL_TABLES.contains(table))throw new IllegalArgumentException("Unknown table");
        String key=table.equals("booking_events_by_booking")?"booking_id":"event_date";
        var statement=cassandra.session().prepare("SELECT booking_id,event_id,event_type,occurred_at FROM "+table+" WHERE "+key+"=?")
            .bind(table.equals("booking_events_by_booking")?UUID.fromString(partition):LocalDate.parse(partition))
            .setPageSize(limit).setTimeout(Duration.ofSeconds(5));
        if(cursor!=null)statement=statement.setPagingState(PagingState.fromString(cursor));
        var result=cassandra.session().execute(statement);
        int available=result.getAvailableWithoutFetching();List<DataRow> rows=new ArrayList<>();
        var it=result.iterator();
        for(int i=0;i<available;i++) {var row=it.next();rows.add(new DataRow(row.getUuid("event_id"),row.getUuid("booking_id"),row.getString("event_type"),"RECORDED",row.getInstant("occurred_at").toString()));}
        var next=result.getExecutionInfo().getSafePagingState();
        return new CqlPage(rows,next==null?null:next.toString());
    }
    public long cqlCount(String table) {
        if(!CQL_TABLES.contains(table))throw new IllegalArgumentException("Unknown table");
        var row=cassandra.session().execute(SimpleStatement.newInstance("SELECT count(*) FROM "+table).setTimeout(Duration.ofSeconds(3))).one();
        if(row==null)throw new IllegalStateException("No count result");
        return row.getLong(0);
    }
}
