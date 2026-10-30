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
    public void insertGroupRequest(UUID requestId,UUID flightId,String fingerprint,Instant time) {
        String code="GR-"+requestId.toString().replace("-","").substring(0,10).toUpperCase(Locale.ROOT);
        jdbc.update("""
            INSERT INTO booking_groups(request_id,flight_id,request_fingerprint,created_at,id,group_code,
                trip_type,contact_email,total_amount,currency,status)
            VALUES (?,?,?,?,?,?,'ONE_WAY','',0,'VND','PENDING')
            """,requestId,flightId,fingerprint,Timestamp.from(time),requestId,code);
    }
    public void completeGroupRequest(UUID requestId,String contactEmail,BigDecimal total) {
        jdbc.update("UPDATE booking_groups SET contact_email=?,total_amount=?,status='CONFIRMED' WHERE request_id=?",
            contactEmail,total,requestId);
    }
    public Optional<ExistingGroupRequest> findGroupRequest(UUID requestId) {
        if(requestId==null) return Optional.empty();
        return jdbc.query("SELECT request_id,request_fingerprint FROM booking_groups WHERE request_id=?",
            (rs,n)->new ExistingGroupRequest(rs.getObject("request_id",UUID.class),rs.getString("request_fingerprint")),
            requestId).stream().findFirst();
    }
    public void insertGroupBooking(UUID id,String code,UUID flightId,UUID seatId,String passengerName,
            String passengerEmail,PassengerType passengerType,Integer baggageKg,String mealCode,
            BigDecimal seatFee,UUID groupRequestId,int groupIndex,Instant time) {
        jdbc.update("""
            INSERT INTO bookings(id,booking_code,flight_id,seat_id,passenger_name,passenger_email,status,created_at,
                                 passenger_type,baggage_kg,meal_code,seat_fee,group_request_id,group_index,
                                 group_id,leg_no,passenger_no)
            VALUES (?,?,?,?,?,?,'CONFIRMED',?,?,?,?,?,?,?,?,1,?)
            """,id,code,flightId,seatId,passengerName.trim(),passengerEmail.trim(),Timestamp.from(time),
            passengerType.name(),baggageKg,mealCode,seatFee,groupRequestId,groupIndex,groupRequestId,groupIndex+1);
    }
    public void insertPayment(UUID bookingId,BigDecimal amount,String currency,Instant time) {
        jdbc.update("""
            INSERT INTO payments(id,booking_id,amount,currency,status,provider,created_at) VALUES (?,?,?,?,'SUCCESS','DEMO',?)
            """,UUID.randomUUID(),bookingId,amount,currency,Timestamp.from(time));
    }
    public void insertPayment(UUID bookingId,CreateBooking request,Instant time) {
        insertPayment(bookingId,request.payment().amount(),request.payment().currency(),time);
    }
    public void insertEvent(UUID eventId,UUID bookingId,String type,String payload,Instant time) {
        jdbc.update("""
            INSERT INTO outbox_events(id,aggregate_type,aggregate_id,event_type,payload,payload_version,occurred_at)
            VALUES (?,'BOOKING',?,?,CAST(? AS JSONB),1,?)
            """,eventId,bookingId,type,payload,Timestamp.from(time));
    }
    public Optional<Booking> booking(UUID id) {
        return tickets("WHERE b.id=?",id).stream().findFirst();
    }
    private List<Booking> tickets(String where,Object... args) {
        return jdbc.query("""
            SELECT b.*,f.flight_no,f.departure_time,f.arrival_time,oa.code origin,da.code destination,s.seat_no,s.cabin_class,p.amount,p.currency,g.group_code FROM bookings b
            JOIN flights f ON b.flight_id=f.id JOIN airports oa ON oa.id=f.origin_airport_id JOIN airports da ON da.id=f.destination_airport_id
            LEFT JOIN flight_seats s ON b.seat_id=s.id
            JOIN payments p ON p.booking_id=b.id LEFT JOIN booking_groups g ON g.id=b.group_id
            """+where,(rs,n)->{
                String cabinClass=rs.getString("cabin_class");
                return new Booking(rs.getObject("id",UUID.class),rs.getString("booking_code"),
                    rs.getObject("flight_id",UUID.class),rs.getString("flight_no"),rs.getObject("seat_id",UUID.class),
                    rs.getString("seat_no"),rs.getString("passenger_name"),rs.getString("passenger_email"),
                    rs.getString("status"),rs.getTimestamp("created_at").toInstant(),rs.getBigDecimal("amount"),rs.getString("currency"),
                    nullableInteger(rs,"baggage_kg"),rs.getString("meal_code"),rs.getBigDecimal("seat_fee"),
                    rs.getString("passenger_type"),cabinClass,cabinClass==null?BigDecimal.ZERO:BookingPolicy.cabinPrice(cabinClass),
                    rs.getString("group_code"),nullableInteger(rs,"leg_no"),rs.getString("infant_name"),
                    rs.getObject("group_request_id",UUID.class),rs.getString("origin"),rs.getString("destination"),
                    rs.getTimestamp("departure_time").toInstant(),rs.getTimestamp("arrival_time").toInstant());
            },args);
    }
    public List<Booking> bookingsForGroup(UUID requestId) {
        return tickets("WHERE b.group_request_id=? ORDER BY b.group_index",requestId);
    }
    public record FlightLeg(UUID id,String origin,String destination,Instant departure,Instant arrival,boolean bookable) {}
    public Optional<FlightLeg> flightLeg(UUID id) {
        return jdbc.query("""
            SELECT f.id,a.code origin,b.code destination,f.departure_time,f.arrival_time,
            (f.status='SCHEDULED' AND f.departure_time>now()) bookable
            FROM flights f JOIN airports a ON a.id=f.origin_airport_id JOIN airports b ON b.id=f.destination_airport_id
            WHERE f.id=?
            """,(rs,n)->new FlightLeg(rs.getObject("id",UUID.class),rs.getString("origin"),rs.getString("destination"),
            rs.getTimestamp("departure_time").toInstant(),rs.getTimestamp("arrival_time").toInstant(),rs.getBoolean("bookable")),id)
            .stream().findFirst();
    }
    public void insertGroup(UUID id,String code,String tripType,CreateBookingGroup request,BigDecimal total,String fingerprint,Instant time) {
        jdbc.update("""
            INSERT INTO booking_groups(id,group_code,trip_type,contact_email,total_amount,currency,status,
                request_id,request_fingerprint,created_at,flight_id)
            VALUES (?,?,?,?,?,?,'CONFIRMED',?,?,?,?)
            """,id,code,tripType,request.contactEmail().trim(),total,request.payment().currency(),
            request.requestId(),fingerprint,Timestamp.from(time),request.flightIds().get(0));
    }
    public void insertGroupTicket(UUID id,String code,UUID groupId,int legNo,int passengerNo,UUID flightId,UUID seatId,
            TripPassenger passenger,String email,BigDecimal seatFee,Instant time) {
        jdbc.update("""
            INSERT INTO bookings(id,booking_code,flight_id,seat_id,passenger_name,passenger_email,status,created_at,
                baggage_kg,meal_code,seat_fee,passenger_type,group_id,leg_no,passenger_no,infant_name)
            VALUES (?,?,?,?,?,?,'CONFIRMED',?,?,?,?,?,?,?,?,?)
            """,id,code,flightId,seatId,passenger.passengerName().trim(),email.trim(),Timestamp.from(time),
            passenger.baggageFor(legNo-1),passenger.mealFor(legNo-1),seatFee,passenger.passengerType(),groupId,legNo,passengerNo,
            passenger.infantName()==null?null:passenger.infantName().trim());
    }
    private Optional<BookingGroup> group(String where,Object arg) {
        return jdbc.query("SELECT * FROM booking_groups WHERE ("+where+") AND group_code IS NOT NULL",(rs,n)->
            new BookingGroup(rs.getObject("id",UUID.class),rs.getString("group_code"),rs.getString("trip_type"),
                rs.getString("contact_email"),rs.getString("status"),rs.getTimestamp("created_at").toInstant(),
                rs.getBigDecimal("total_amount"),rs.getString("currency"),List.of()),arg)
            .stream().findFirst().map(group->new BookingGroup(group.groupId(),group.groupCode(),group.tripType(),
                group.contactEmail(),group.status(),group.createdAt(),group.totalAmount(),group.currency(),
                tickets("WHERE b.group_id=? ORDER BY b.leg_no,b.passenger_no",group.groupId())));
    }
    public Optional<BookingGroup> groupByCode(String code) { return group("group_code=?",code); }
    public Optional<BookingGroup> groupByRequest(UUID requestId) { return group("request_id=?",requestId); }
    public Optional<String> groupFingerprint(UUID requestId) {
        return jdbc.query("SELECT request_fingerprint FROM booking_groups WHERE request_id=?",
            (rs,n)->rs.getString(1),requestId).stream().findFirst();
    }

    private Integer nullableInteger(ResultSet rs,String column) throws SQLException {
        Object value=rs.getObject(column);
        return value==null?null:((Number)value).intValue();
    }

    public record ExistingRequest(UUID bookingId, String fingerprint) {}
    public record ExistingGroupRequest(UUID requestId, String fingerprint) {}
    public Optional<ExistingRequest> findRequest(UUID requestId) {
        if(requestId==null) return Optional.empty();
        return jdbc.query("SELECT id,request_fingerprint FROM bookings WHERE request_id=?",
            (rs,n)->new ExistingRequest(rs.getObject("id",UUID.class),rs.getString("request_fingerprint")),requestId).stream().findFirst();
    }
}
