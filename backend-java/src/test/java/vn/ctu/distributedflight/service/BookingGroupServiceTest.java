package vn.ctu.distributedflight.service;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.*;
import org.springframework.transaction.*;
import org.springframework.transaction.support.SimpleTransactionStatus;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.repository.BookingRepository;
import vn.ctu.distributedflight.repository.BookingRepository.FlightLeg;

class BookingGroupServiceTest {
    private BookingRepository repository;
    private PlatformTransactionManager manager;
    private BookingService service;
    private final UUID out=UUID.randomUUID(), back=UUID.randomUUID();
    private final UUID s1=UUID.randomUUID(), s2=UUID.randomUUID(), s3=UUID.randomUUID(), s4=UUID.randomUUID();
    private final Instant base=Instant.now().plusSeconds(86400);
    @BeforeEach void setup() {
        repository=mock(BookingRepository.class); manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenAnswer(invocation->new SimpleTransactionStatus());
        service=new BookingService(repository,JsonMapper.builder().build(),manager);
        when(repository.flightLeg(out)).thenReturn(Optional.of(new FlightLeg(out,"SGN","HAN",base,base.plusSeconds(7200),true)));
        when(repository.flightLeg(back)).thenReturn(Optional.of(new FlightLeg(back,"HAN","SGN",base.plusSeconds(86400),base.plusSeconds(93600),true)));
        for(UUID seat:List.of(s1,s2)) when(repository.lockSeat(out,seat)).thenReturn(Optional.of(new Seat(seat,"03B","ECONOMY","AVAILABLE")));
        for(UUID seat:List.of(s3,s4)) when(repository.lockSeat(back,seat)).thenReturn(Optional.of(new Seat(seat,"03C","ECONOMY","AVAILABLE")));
        when(repository.reserve(any(),any())).thenReturn(true);
        when(repository.groupByCode(anyString())).thenAnswer(i->Optional.of(new BookingGroup(UUID.randomUUID(),i.getArgument(0),"X","a@b.vn","CONFIRMED",Instant.now(),BigDecimal.ONE,"VND",List.of())));
    }
    private TripPassenger person(String type,String infant,UUID... seats) {
        return new TripPassenger("Passenger",type,null,null,infant,List.of(seats));
    }
    private CreateBookingGroup request(String amount,List<UUID> flights,TripPassenger... people) {
        return new CreateBookingGroup(flights,"contact@example.com",List.of(people),new Payment(new BigDecimal(amount),"VND"),UUID.randomUUID());
    }
    @Test void oneWayPartyIsWrittenAtomicallyUnderOneGroupCode() {
        BookingGroup group=service.createGroup(request("3000000",List.of(out),person("ADULT",null,s1),person("ADULT","Baby",s2)));
        assertTrue(group.groupCode().startsWith("GR-"));
        verify(repository).insertGroup(any(),anyString(),eq("ONE_WAY"),any(),eq(new BigDecimal("3000000.00")),anyString(),any());
        verify(repository,times(2)).insertGroupTicket(any(),anyString(),any(),eq(1),anyInt(),eq(out),any(),any(),anyString(),any(),any());
        verify(repository,times(8)).insertEvent(any(),any(),anyString(),anyString(),any());
        verify(manager).commit(any());
    }
    @Test void roundTripBooksBothLegsInOneTransaction() {
        service.createGroup(request("5250000",List.of(out,back),person("ADULT",null,s1,s3),person("CHILD",null,s2,s4)));
        verify(repository).insertGroup(any(),anyString(),eq("ROUND_TRIP"),any(),eq(new BigDecimal("5250000.00")),anyString(),any());
        verify(repository,times(4)).insertGroupTicket(any(),anyString(),any(),anyInt(),anyInt(),any(),any(),any(),anyString(),any(),any());
    }
    @Test void soldSeatCancelsTheWholeParty() {
        when(repository.lockSeat(out,s2)).thenReturn(Optional.of(new Seat(s2,"03B","ECONOMY","BOOKED")));
        ApiException ex=assertThrows(ApiException.class,()->service.createGroup(request("3000000",List.of(out),person("ADULT",null,s1),person("ADULT",null,s2))));
        assertEquals("SEAT_ALREADY_BOOKED",ex.code());
        verify(repository,never()).reserve(any(),any());
        verify(repository,never()).insertGroup(any(),anyString(),anyString(),any(),any(),anyString(),any());
        verify(manager).rollback(any()); verify(manager,never()).commit(any());
    }
    @Test void alteredTotalIsRejected() {
        ApiException ex=assertThrows(ApiException.class,()->service.createGroup(request("1",List.of(out),person("ADULT",null,s1))));
        assertEquals("INVALID_PAYMENT",ex.code());
        verify(repository,never()).reserve(any(),any());
    }
    @Test void returnMustLeaveAfterOutboundArrives() {
        when(repository.flightLeg(back)).thenReturn(Optional.of(new FlightLeg(back,"HAN","SGN",base.plusSeconds(60),base.plusSeconds(7000),true)));
        assertEquals("INVALID_TRIP",assertThrows(ApiException.class,()->
            service.createGroup(request("3000000",List.of(out,back),person("ADULT",null,s1,s3)))).code());
    }
    @Test void returnMustReverseTheRoute() {
        when(repository.flightLeg(back)).thenReturn(Optional.of(new FlightLeg(back,"SGN","DAD",base.plusSeconds(86400),base.plusSeconds(93600),true)));
        assertEquals("INVALID_TRIP",assertThrows(ApiException.class,()->
            service.createGroup(request("3000000",List.of(out,back),person("ADULT",null,s1,s3)))).code());
    }
    @Test void seatCountMustMatchLegs() {
        assertEquals("INVALID_SEATS",assertThrows(ApiException.class,()->
            service.createGroup(request("3000000",List.of(out,back),person("ADULT",null,s1)))).code());
    }
    @Test void infantMustTravelWithAnAdult() {
        assertEquals("INVALID_INFANT",assertThrows(ApiException.class,()->
            service.createGroup(request("3000000",List.of(out),person("ADULT",null,s1),person("CHILD","Baby",s2)))).code());
    }
    @Test void partyNeedsAnAdult() {
        assertEquals("ADULT_REQUIRED",assertThrows(ApiException.class,()->
            service.createGroup(request("1125000",List.of(out),person("CHILD",null,s1)))).code());
    }
    @Test void sameSeatCannotBeUsedTwice() {
        assertEquals("DUPLICATE_SEAT",assertThrows(ApiException.class,()->
            service.createGroup(request("3000000",List.of(out),person("ADULT",null,s1),person("ADULT",null,s1)))).code());
    }
    @Test void baggageMealAndSeatFeesAreCountedPerLeg() {
        when(repository.lockSeat(out,s1)).thenReturn(Optional.of(new Seat(s1,"03A","ECONOMY","AVAILABLE")));
        TripPassenger adult=new TripPassenger("Passenger","ADULT",List.of(15),List.of("SANDWICH"),null,List.of(s1));
        // 1.500.000 fare + 150.000 baggage + 60.000 sandwich + 50.000 window/aisle seat
        service.createGroup(new CreateBookingGroup(List.of(out),"c@example.com",List.of(adult),
            new Payment(new BigDecimal("1760000"),"VND"),UUID.randomUUID()));
        verify(repository).insertGroup(any(),anyString(),eq("ONE_WAY"),any(),eq(new BigDecimal("1760000.00")),anyString(),any());
    }
    @Test void ancillaryListsMustHaveOneEntryPerLeg() {
        TripPassenger adult=new TripPassenger("Passenger","ADULT",List.of(15,20),null,null,List.of(s1));
        assertEquals("INVALID_ANCILLARY",assertThrows(ApiException.class,()->service.createGroup(new CreateBookingGroup(
            List.of(out),"c@example.com",List.of(adult),new Payment(new BigDecimal("1500000"),"VND"),UUID.randomUUID()))).code());
    }
}
