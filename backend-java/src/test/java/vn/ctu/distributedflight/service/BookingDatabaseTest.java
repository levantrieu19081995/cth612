package vn.ctu.distributedflight.service;
import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.repository.BookingRepository;

// Opt in explicitly: this test uses real CockroachDB and cleans only its own fixture IDs.
@EnabledIfSystemProperty(named="flight.integration",matches="true")
class BookingDatabaseTest {
    private JdbcTemplate jdbc;
    private DataSourceTransactionManager manager;
    private UUID origin,destination,flight,seat;
    @BeforeEach void setup() {
        DriverManagerDataSource source=new DriverManagerDataSource(
            System.getProperty("flight.jdbc","jdbc:postgresql://127.0.0.1:26257/flight_booking?sslmode=disable"),"root","");
        source.setDriverClassName("org.postgresql.Driver");
        new ResourceDatabasePopulator(new ClassPathResource("db/cockroach-schema.sql")).execute(source);
        jdbc=new JdbcTemplate(source); manager=new DataSourceTransactionManager(source);
        origin=UUID.randomUUID(); destination=UUID.randomUUID(); flight=UUID.randomUUID(); seat=UUID.randomUUID();
        jdbc.update("INSERT INTO airports(id,code,name,city) VALUES (?,?,?,?)",origin,"TEST-"+origin,"Test origin","Test");
        jdbc.update("INSERT INTO airports(id,code,name,city) VALUES (?,?,?,?)",destination,"TEST-"+destination,"Test destination","Test");
        jdbc.update("""
            INSERT INTO flights(id,flight_no,origin_airport_id,destination_airport_id,departure_time,arrival_time,status)
            VALUES (?,'TEST',?,?,?,?,'SCHEDULED')
            """,flight,origin,destination,Timestamp.from(Instant.now().plusSeconds(86400)),Timestamp.from(Instant.now().plusSeconds(93600)));
        jdbc.update("INSERT INTO flight_seats(id,flight_id,seat_no,cabin_class,status) VALUES (?,?,'03B','ECONOMY','AVAILABLE')",seat,flight);
    }
    private CreateBooking request(String name) {
        return new CreateBooking(flight,seat,name,"test@example.com",new Payment(new BigDecimal("1500000"),"VND"));
    }
    @Test void simultaneousRequestsConfirmExactlyOneBookingAndOnePayment() throws Exception {
        BookingService service=new BookingService(new BookingRepository(jdbc),JsonMapper.builder().build(),manager);
        CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            Callable<String> contender=()->{
                ready.countDown(); if(!start.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("No start signal");
                try { service.create(request("Concurrent passenger")); return "CONFIRMED"; }
                catch(ApiException ex) { return ex.code(); }
            };
            Future<String> a=pool.submit(contender),b=pool.submit(contender);
            assertTrue(ready.await(10,TimeUnit.SECONDS)); start.countDown();
            List<String> results=List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS));
            assertEquals(1,Collections.frequency(results,"CONFIRMED"));
            assertEquals(1,Collections.frequency(results,"SEAT_ALREADY_BOOKED"));
            assertEquals(1L,jdbc.queryForObject("SELECT count(*) FROM bookings WHERE seat_id=?",Long.class,seat));
            assertEquals(1L,jdbc.queryForObject("SELECT count(*) FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE seat_id=?)",Long.class,seat));
            assertEquals(4L,jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE aggregate_id IN (SELECT id FROM bookings WHERE seat_id=?)",Long.class,seat));
            assertEquals("BOOKED",jdbc.queryForObject("SELECT status FROM flight_seats WHERE id=?",String.class,seat));
        } finally { start.countDown(); pool.shutdownNow(); pool.awaitTermination(10,TimeUnit.SECONDS); }
    }
    @Test void failedPaymentLeavesSeatAvailableAndNoBookingOrOutbox() {
        BookingRepository failing=new BookingRepository(jdbc) {
            @Override public void insertPayment(UUID id,CreateBooking request,Instant time) {
                throw new DataIntegrityViolationException("Injected payment write failure");
            }
        };
        BookingService service=new BookingService(failing,JsonMapper.builder().build(),manager);
        assertThrows(DataIntegrityViolationException.class,()->service.create(request("Rollback passenger")));
        assertEquals("AVAILABLE",jdbc.queryForObject("SELECT status FROM flight_seats WHERE id=?",String.class,seat));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM bookings WHERE seat_id=?",Long.class,seat));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE payload->'payload'->>'flightId'=?",Long.class,flight.toString()));
    }
    @Test void groupCreatesOrderedAdultAndZeroPaymentInfantAtomically() {
        BookingService service=new BookingService(new BookingRepository(jdbc),JsonMapper.builder().build(),manager);
        UUID requestId=UUID.randomUUID();
        GroupBookingRequest request=new GroupBookingRequest(flight,requestId,List.of(
            new GroupPassenger("Adult","adult@example.com",PassengerType.ADULT,seat,null,null),
            new GroupPassenger("Infant","infant@example.com",PassengerType.INFANT,null,null,null)));

        List<Booking> bookings=service.createGroup(request);

        assertEquals(2,bookings.size());
        assertEquals("ADULT",bookings.get(0).passengerType());
        assertEquals("INFANT",bookings.get(1).passengerType());
        assertNull(bookings.get(1).seatId());
        assertNull(bookings.get(1).seatNo());
        assertEquals(new BigDecimal("1500000.00"),bookings.get(0).amount());
        assertEquals(0,BigDecimal.ZERO.compareTo(bookings.get(1).amount()));
        assertEquals(2L,jdbc.queryForObject("SELECT count(*) FROM bookings WHERE group_request_id=?",Long.class,requestId));
        assertEquals(8L,jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE aggregate_id IN (SELECT id FROM bookings WHERE group_request_id=?)",Long.class,requestId));
        assertEquals(requestId,service.createGroup(request).get(1).groupRequestId());
    }
    @Test void invalidSeatRollsBackWholeGroupAndGroupKey() {
        BookingService service=new BookingService(new BookingRepository(jdbc),JsonMapper.builder().build(),manager);
        UUID requestId=UUID.randomUUID();
        GroupBookingRequest request=new GroupBookingRequest(flight,requestId,List.of(
            new GroupPassenger("Adult","adult@example.com",PassengerType.ADULT,seat,null,null),
            new GroupPassenger("Other adult","other@example.com",PassengerType.ADULT,UUID.randomUUID(),null,null)));
        assertEquals("SEAT_NOT_FOUND",assertThrows(ApiException.class,()->service.createGroup(request)).code());
        assertEquals("AVAILABLE",jdbc.queryForObject("SELECT status FROM flight_seats WHERE id=?",String.class,seat));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM bookings WHERE group_request_id=?",Long.class,requestId));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM booking_groups WHERE request_id=?",Long.class,requestId));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE payload->'payload'->>'flightId'=?",Long.class,flight.toString()));
    }
    private UUID extraSeat() {
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO flight_seats(id,flight_id,seat_no,cabin_class,status) VALUES (?,?,'03C','ECONOMY','AVAILABLE')",id,flight);
        return id;
    }
    private CreateBookingGroup party(UUID second) {
        return new CreateBookingGroup(List.of(flight),"party@example.com",List.of(
            new TripPassenger("First adult","ADULT",null,null,"Baby",List.of(seat)),
            new TripPassenger("Second adult","ADULT",null,null,null,List.of(second))),
            new Payment(new BigDecimal("3000000"),"VND"),UUID.randomUUID());
    }
    @Test void partyGetsOneGroupCodeAndAllRowsInOneCommit() {
        UUID second=extraSeat();
        BookingService service=new BookingService(new BookingRepository(jdbc),JsonMapper.builder().build(),manager);
        CreateBookingGroup request=party(second);
        BookingGroup group=service.createGroup(request);
        assertEquals(2,group.tickets().size());
        assertTrue(group.tickets().stream().allMatch(ticket->group.groupCode().equals(ticket.groupCode())));
        assertEquals("Baby",group.tickets().get(0).infantName());
        assertEquals(0,new BigDecimal("3000000").compareTo(group.totalAmount()));
        assertEquals(2L,jdbc.queryForObject("SELECT count(*) FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE group_id=?)",Long.class,group.groupId()));
        assertEquals(8L,jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE aggregate_id IN (SELECT id FROM bookings WHERE group_id=?)",Long.class,group.groupId()));
        assertEquals(group.groupId(),service.createGroup(request).groupId());
        assertEquals(1L,jdbc.queryForObject("SELECT count(*) FROM booking_groups WHERE request_id=?",Long.class,request.requestId()));
    }
    @Test void oneTakenSeatCancelsTheWholeParty() {
        UUID second=extraSeat();
        BookingService service=new BookingService(new BookingRepository(jdbc),JsonMapper.builder().build(),manager);
        jdbc.update("UPDATE flight_seats SET status='BOOKED' WHERE id=?",second);
        CreateBookingGroup request=party(second);
        assertEquals("SEAT_ALREADY_BOOKED",assertThrows(ApiException.class,()->service.createGroup(request)).code());
        assertEquals("AVAILABLE",jdbc.queryForObject("SELECT status FROM flight_seats WHERE id=?",String.class,seat));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM bookings WHERE flight_id=?",Long.class,flight));
        assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM booking_groups WHERE request_id=?",Long.class,request.requestId()));
    }
    @AfterEach void cleanup() {
        if(jdbc==null||flight==null) return;
        jdbc.update("DELETE FROM outbox_events WHERE aggregate_id IN (SELECT id FROM bookings WHERE flight_id=?)",flight);
        jdbc.update("DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE flight_id=?)",flight);
        jdbc.update("DELETE FROM bookings WHERE flight_id=?",flight);
        jdbc.update("DELETE FROM booking_groups WHERE flight_id=?",flight);
        jdbc.update("DELETE FROM flight_seats WHERE flight_id=?",flight);
        jdbc.update("DELETE FROM flights WHERE id=?",flight);
        jdbc.update("DELETE FROM airports WHERE id IN (?,?)",origin,destination);
    }
}
