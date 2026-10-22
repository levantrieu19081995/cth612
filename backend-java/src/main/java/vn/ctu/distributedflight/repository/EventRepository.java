package vn.ctu.distributedflight.repository;

import java.time.*;
import java.util.*;
import tools.jackson.databind.*;
import tools.jackson.databind.json.JsonMapper;
import com.datastax.oss.driver.api.core.cql.*;
import org.springframework.stereotype.Repository;
import vn.ctu.distributedflight.dto.EventDtos.Event;
import vn.ctu.distributedflight.repository.OutboxRepository;
import vn.ctu.distributedflight.domain.InvalidEventException;

@Repository
public class EventRepository {
    private final CassandraConnection connection;
    private final JsonMapper json;
    private final Map<String,UUID> observedNodeIds=new java.util.concurrent.ConcurrentHashMap<>();
    public EventRepository(CassandraConnection connection,JsonMapper json) { this.connection=connection;this.json=json; }
    public void publish(OutboxRepository.Event event) {
        try {
            Payload payload=decode(event);
            UUID flightId=payload.flightId();
            String seat=payload.seatNo();
            var session=connection.session();
            var byBooking=session.prepare("""
                INSERT INTO booking_events_by_booking(booking_id,occurred_at,event_id,event_type,flight_id,seat_no,payload,payload_version)
                VALUES (?,?,?,?,?,?,?,?)
                """);
            // Fixed primary keys AND timestamp make repeated writes deterministic, including partial two-table failures.
            long timestamp=event.occurredAt().toEpochMilli()*1000;
            session.execute(byBooking.bind(event.bookingId(),event.occurredAt(),event.id(),event.eventType(),flightId,seat,event.payload(),event.version())
                .setQueryTimestamp(timestamp).setIdempotent(true));
            var byDay=session.prepare("""
                INSERT INTO booking_events_by_day(event_date,occurred_at,event_id,booking_id,event_type,payload,payload_version)
                VALUES (?,?,?,?,?,?,?)
                """);
            session.execute(byDay.bind(event.occurredAt().atZone(ZoneOffset.UTC).toLocalDate(),event.occurredAt(),event.id(),
                event.bookingId(),event.eventType(),event.payload(),event.version()).setQueryTimestamp(timestamp).setIdempotent(true));
        } catch(tools.jackson.core.JacksonException ex) { throw new IllegalArgumentException("Invalid event JSON",ex); }
    }
    public List<Event> timeline(UUID bookingId) {
        var session=connection.session();
        var statement=session.prepare("SELECT event_id,event_type,occurred_at,payload_version,payload FROM booking_events_by_booking WHERE booking_id=? LIMIT 100");
        List<Event> events=new ArrayList<>();
        for(Row row:session.execute(statement.bind(bookingId))) {
            try {
                events.add(new Event(row.getUuid("event_id"),row.getString("event_type"),bookingId,
                    row.getInstant("occurred_at"),row.getInt("payload_version"),json.readTree(row.getString("payload"))));
            } catch(tools.jackson.core.JacksonException ex) { throw new IllegalStateException("Stored event JSON invalid",ex); }
        }
        return events;
    }
    private record Payload(UUID flightId,String seatNo) {}
    private Payload decode(OutboxRepository.Event event) {
        try {
            JsonNode payload=json.readTree(event.payload()).required("payload");
            JsonNode seatNode=payload.get("seatNo");
            String seat=seatNode==null||seatNode.isNull()?null:seatNode.asText();
            if((seat!=null&&seat.isBlank())||event.version()!=1) throw new IllegalArgumentException("Invalid event version or seat");
            return new Payload(UUID.fromString(payload.required("flightId").asText()),seat);
        } catch(RuntimeException ex) {throw new InvalidEventException(ex);}
    }
    public long countByDay(LocalDate day) {
        var session=connection.session();
        var stmt=session.prepare("SELECT count(*) FROM booking_events_by_day WHERE event_date=?");
        Row row=session.execute(stmt.bind(day)).one();
        return row==null?0:row.getLong(0);
    }
    public Map<String,String> nodes() {
        var session=connection.session();
        session.execute("SELECT release_version FROM system.local");
        Map<String,String> nodes=new TreeMap<>();
        session.getMetadata().getNodes().values().forEach(node->{
            var address=node.getEndPoint().resolve();
            if(address instanceof java.net.InetSocketAddress inet) nodes.put(inet.getHostString(),node.getState().name());
        });
        return nodes;
    }
    public String probeNode(String host,int port,boolean singleNode) {
        var session=connection.session();
        var nodes=session.getMetadata().getNodes().values();
        String key=host+":"+port;
        UUID observed=observedNodeIds.get(key);
        var node=nodes.stream().filter(n->observed!=null&&observed.equals(n.getHostId())).findFirst();
        if(observed==null) {
            java.net.InetSocketAddress target=new java.net.InetSocketAddress(host,port);
            node=nodes.stream().filter(n->{
                var endpoint=n.getEndPoint().resolve();
                if(!(endpoint instanceof java.net.InetSocketAddress remote)||remote.getPort()!=port) return false;
                return remote.equals(target)||remote.getHostString().equalsIgnoreCase(host)
                    ||(target.getAddress()!=null&&remote.getHostString().equals(target.getAddress().getHostAddress()));
            }).findFirst();
        }
        if(node.isEmpty()&&singleNode&&nodes.size()==1) node=nodes.stream().findFirst();
        if(node.isEmpty()) return "UNKNOWN";
        if(node.get().getHostId()!=null) observedNodeIds.putIfAbsent(key,node.get().getHostId());
        if(!node.get().getState().name().equals("UP")) return "OFFLINE";
        Row local=session.execute(SimpleStatement.newInstance("SELECT host_id,release_version FROM system.local").setNode(node.get())).one();
        if(local==null||!Objects.equals(local.getUuid("host_id"),node.get().getHostId())) return "UNKNOWN";
        return "ONLINE";
    }
}
