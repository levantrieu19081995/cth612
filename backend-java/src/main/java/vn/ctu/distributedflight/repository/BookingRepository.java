package vn.ctu.distributedflight.repository;
import java.math.BigDecimal;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.ctu.distributedflight.domain.BookingPolicy;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.service.RequestIdentity;

@Repository
public class BookingRepository {
    private final JdbcTemplate jdbc;
    public BookingRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public List<Flight> flights(String origin,String destination,LocalDate date,YearMonth month,int requiredSeats) {
        String sql="""
            SELECT f.*, a.code origin, b.code destination, a.city origin_city, b.city destination_city,
            (SELECT count(*) FROM flight_seats s WHERE s.flight_id=f.id AND s.status='AVAILABLE') available_seats
            FROM flights f JOIN airports a ON a.id=f.origin_airport_id
            JOIN airports b ON b.id=f.destination_airport_id
            WHERE f.status='SCHEDULED' AND f.departure_time>now()
            """;
        List<Object> args=new ArrayList<>();
        if(origin!=null&&!origin.isBlank()) { sql+=" AND a.code=?"; args.add(origin.trim().toUpperCase(Locale.ROOT)); }
        if(destination!=null&&!destination.isBlank()) { sql+=" AND b.code=?"; args.add(destination.trim().toUpperCase(Locale.ROOT)); }
        if(date!=null||month!=null) {
            ZoneId zone=ZoneId.of("Asia/Ho_Chi_Minh");
            sql+=" AND f.departure_time>=? AND f.departure_time<?";
            LocalDate start=date!=null?date:month.atDay(1);
            LocalDate end=date!=null?date.plusDays(1):month.plusMonths(1).atDay(1);
            args.add(Timestamp.from(start.atStartOfDay(zone).toInstant()));
            args.add(Timestamp.from(end.atStartOfDay(zone).toInstant()));
        }
        sql+=" ORDER BY f.departure_time LIMIT 100";
        List<Flight> base=jdbc.query(sql,(rs,n)->new Flight(rs.getObject("id",UUID.class),rs.getString("flight_no"),
            rs.getString("origin"),rs.getString("destination"),rs.getString("origin_city"),rs.getString("destination_city"),
            rs.getTimestamp("departure_time").toInstant(),rs.getTimestamp("arrival_time").toInstant(),
            rs.getString("status"),rs.getLong("available_seats"),BookingPolicy.DEMO_FARE,"VND",
            rs.getLong("available_seats")>=requiredSeats,rs.getString("airline_code"),rs.getString("airline_name"),
            List.of(),BookingPolicy.passengerFares(),BookingPolicy.ancillaries()),args.toArray());
        if(base.isEmpty()) return base;
        Map<UUID,Map<String,long[]>> counts=new HashMap<>();
        String marks=String.join(",",Collections.nCopies(base.size(),"?"));
        jdbc.query("SELECT flight_id,cabin_class,count(*) total,count(*) FILTER (WHERE status='AVAILABLE') available FROM flight_seats WHERE flight_id IN ("
            +marks+") GROUP BY flight_id,cabin_class",rs->{
            counts.computeIfAbsent(rs.getObject("flight_id",UUID.class),k->new HashMap<>())
                .put(rs.getString("cabin_class"),new long[]{rs.getLong("total"),rs.getLong("available")});
        },base.stream().map(Flight::flightId).toArray());
        return base.stream().map(f->{
            Map<String,long[]> byCabin=counts.getOrDefault(f.flightId(),Map.of());
            List<CabinOffer> cabins=BookingPolicy.CABIN_CLASSES.stream().filter(byCabin::containsKey).map(c->{
                BigDecimal surcharge=BookingPolicy.cabinPrice(c);
                return new CabinOffer(c,byCabin.get(c)[0],byCabin.get(c)[1],surcharge,
                    BookingPolicy.passengerBaseFare("ADULT").add(surcharge),BookingPolicy.passengerBaseFare("CHILD").add(surcharge));
            }).toList();
            return new Flight(f.flightId(),f.flightNo(),f.origin(),f.destination(),f.originCity(),f.destinationCity(),
                f.departureTime(),f.arrivalTime(),f.status(),f.availableSeats(),f.price(),f.currency(),f.sufficientSeats(),
                f.airlineCode(),f.airlineName(),cabins,f.passengerFares(),f.ancillaries());
        }).toList();
    }
    public boolean flightExists(UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM flights WHERE id=?)",Boolean.class,id));
    }
    public boolean flightBookable(UUID id) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM flights WHERE id=? AND status='SCHEDULED' AND departure_time>now())",Boolean.class,id));
    }
    public List<Seat> seats(UUID id) {
        return jdbc.query("SELECT * FROM flight_seats WHERE flight_id=? ORDER BY seat_no",
            (rs,n)->seat(rs),id);
    }
    public Optional<Seat> lockSeat(UUID flightId,UUID seatId) {
        return jdbc.query("SELECT * FROM flight_seats WHERE id=? AND flight_id=? FOR UPDATE",
            (rs,n)->seat(rs),seatId,flightId).stream().findFirst();
    }
    private Seat seat(ResultSet rs) throws SQLException {
        return new Seat(rs.getObject("id",UUID.class),rs.getString("seat_no"),rs.getString("cabin_class"),rs.getString("status"));
    }
    public boolean reserve(UUID flightId,UUID seatId) {
        return jdbc.update("UPDATE flight_seats SET status='BOOKED',version=version+1 WHERE id=? AND flight_id=? AND status='AVAILABLE'",
            seatId,flightId)==1;
    }
    public void insertBooking(UUID id,String code,CreateBooking request,BigDecimal seatFee,Instant time) {
        jdbc.update("""
            INSERT INTO bookings(id,booking_code,flight_id,seat_id,passenger_name,passenger_email,status,created_at,request_id,request_fingerprint,baggage_kg,meal_code,seat_fee,passenger_type)
            VALUES (?,?,?,?,?,?,'CONFIRMED',?,?,?,?,?,?,?)
            """,id,code,request.flightId(),request.seatId(),request.passengerName().trim(),request.passengerEmail().trim(),Timestamp.from(time),
            request.requestId(),RequestIdentity.fingerprint(request),request.baggageKg(),request.mealCode(),seatFee,request.passengerType());
    }
    public void insertPayment(UUID bookingId,CreateBooking request,Instant time) {
        jdbc.update("""
            INSERT INTO payments(id,booking_id,amount,currency,status,provider,created_at) VALUES (?,?,?,?,'SUCCESS','DEMO',?)
            """,UUID.randomUUID(),bookingId,request.payment().amount(),request.payment().currency(),Timestamp.from(time));
    }
    public void insertEvent(UUID eventId,UUID bookingId,String type,String payload,Instant time) {
        jdbc.update("""
            INSERT INTO outbox_events(id,aggregate_type,aggregate_id,event_type,payload,payload_version,occurred_at)
            VALUES (?,'BOOKING',?,?,CAST(? AS JSONB),1,?)
            """,eventId,bookingId,type,payload,Timestamp.from(time));
    }
    public Optional<Booking> booking(UUID id) {
        return jdbc.query("""
            SELECT b.*,f.flight_no,s.seat_no,s.cabin_class,p.amount,p.currency FROM bookings b
            JOIN flights f ON b.flight_id=f.id JOIN flight_seats s ON b.seat_id=s.id
            JOIN payments p ON p.booking_id=b.id WHERE b.id=?
            """,(rs,n)->new Booking(rs.getObject("id",UUID.class),rs.getString("booking_code"),
            rs.getObject("flight_id",UUID.class),rs.getString("flight_no"),rs.getObject("seat_id",UUID.class),
            rs.getString("seat_no"),rs.getString("passenger_name"),rs.getString("passenger_email"),
            rs.getString("status"),rs.getTimestamp("created_at").toInstant(),rs.getBigDecimal("amount"),rs.getString("currency"),
            nullableInteger(rs,"baggage_kg"),rs.getString("meal_code"),rs.getBigDecimal("seat_fee"),
            rs.getString("passenger_type"),rs.getString("cabin_class"),
            BookingPolicy.cabinPrice(rs.getString("cabin_class"))),id)
            .stream().findFirst();
    }

    private Integer nullableInteger(ResultSet rs,String column) throws SQLException {
        Object value=rs.getObject(column);
        return value==null?null:((Number)value).intValue();
    }

    public record ExistingRequest(UUID bookingId, String fingerprint) {}
    public Optional<ExistingRequest> findRequest(UUID requestId) {
        if(requestId==null) return Optional.empty();
        return jdbc.query("SELECT id,request_fingerprint FROM bookings WHERE request_id=?",
            (rs,n)->new ExistingRequest(rs.getObject("id",UUID.class),rs.getString("request_fingerprint")),requestId).stream().findFirst();
    }
}
