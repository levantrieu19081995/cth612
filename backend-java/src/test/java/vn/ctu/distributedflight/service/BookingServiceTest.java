package vn.ctu.distributedflight.service;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.CannotSerializeTransactionException;
import org.springframework.transaction.*;
import org.springframework.transaction.support.SimpleTransactionStatus;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.repository.BookingRepository;

class BookingServiceTest {
    private BookingRepository repository;
    private PlatformTransactionManager manager;
    private BookingService service;
    private final UUID flight=UUID.randomUUID(), seat=UUID.randomUUID();
    private CreateBooking request;
    @BeforeEach void setup() {
        repository=mock(BookingRepository.class); manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenAnswer(invocation->new SimpleTransactionStatus());
        service=new BookingService(repository,JsonMapper.builder().build(),manager);
        request=new CreateBooking(flight,seat,"Test Passenger","test@example.com",new Payment(new BigDecimal("1500000"),"VND"));
        when(repository.flightExists(flight)).thenReturn(true);
        when(repository.flightBookable(flight)).thenReturn(true);
        when(repository.lockSeat(flight,seat)).thenReturn(Optional.of(new Seat(seat,"03B","ECONOMY","AVAILABLE")));
        when(repository.reserve(flight,seat)).thenReturn(true);
        when(repository.booking(any())).thenReturn(Optional.of(new Booking(UUID.randomUUID(),"BK-TEST",flight,"TEST",seat,"01A",
            "Test Passenger","test@example.com","CONFIRMED",Instant.now(),new BigDecimal("1500000"),"VND")));
    }
    @Test void soldSeatReturnsConflictAndDoesNotWriteBooking() {
        when(repository.lockSeat(flight,seat)).thenReturn(Optional.of(new Seat(seat,"01A","ECONOMY","BOOKED")));
        ApiException ex=assertThrows(ApiException.class,()->service.create(request));
        assertEquals("SEAT_ALREADY_BOOKED",ex.code());
        verify(repository,never()).insertBooking(any(),anyString(),any(),any(),any());
        verify(manager).rollback(any()); verify(manager,never()).commit(any());
    }
    @Test void alteredFareIsRejectedByServerPriceCalculation() {
        CreateBooking wrong=new CreateBooking(flight,seat,"Passenger","p@example.com",new Payment(BigDecimal.ONE,"VND"));
        assertEquals("INVALID_PAYMENT",assertThrows(ApiException.class,()->service.create(wrong)).code());
        verify(manager).rollback(any());
        verify(repository,never()).insertBooking(any(),anyString(),any(),any(),any());
    }
    @Test void selectedAddonsAreIncludedInServerCalculatedPrice() {
        when(repository.lockSeat(flight,seat)).thenReturn(Optional.of(new Seat(seat,"01A","ECONOMY","AVAILABLE")));
        CreateBooking withAddons=new CreateBooking(flight,seat,"Passenger","p@example.com",
            new Payment(new BigDecimal("1840000"),"VND"),null,15,"CHICKEN");
        assertEquals("CONFIRMED",service.create(withAddons).status());
        verify(repository).insertBooking(any(),anyString(),eq(withAddons),eq(new BigDecimal("100000")),any());
        verify(repository).insertPayment(any(),eq(withAddons),any());
    }
    @Test void childFareIsValidatedOnTheServer() {
        CreateBooking child=new CreateBooking(flight,seat,"Child passenger","child@example.com",
            new Payment(new BigDecimal("1125000"),"VND"),null,null,null,"CHILD");
        assertEquals("CONFIRMED",service.create(child).status());
        verify(repository).insertPayment(any(),eq(child),any());
    }
    @Test void unsupportedBaggageOptionIsRejected() {
        CreateBooking invalid=new CreateBooking(flight,seat,"Passenger","p@example.com",
            new Payment(new BigDecimal("1500000"),"VND"),null,18,null);
        assertEquals("INVALID_ANCILLARY",assertThrows(ApiException.class,()->service.create(invalid)).code());
        verifyNoInteractions(manager);
    }
    @Test void outboxFailureRollsBackAndDoesNotCommit() {
        doThrow(new DataIntegrityViolationException("test failure")).when(repository).insertEvent(any(),any(),anyString(),anyString(),any());
        assertThrows(DataIntegrityViolationException.class,()->service.create(request));
        verify(manager).rollback(any()); verify(manager,never()).commit(any());
    }
    @Test void serializationFailureRetriesInNewTransaction() {
        when(repository.reserve(flight,seat)).thenThrow(new CannotSerializeTransactionException("retry",new SQLException("retry","40001"))).thenReturn(true);
        assertEquals("CONFIRMED",service.create(request).status());
        verify(manager,times(2)).getTransaction(any());
        verify(manager).rollback(any()); verify(manager).commit(any());
        verify(repository,times(4)).insertEvent(any(),any(),anyString(),anyString(),any());
    }
    @Test void seatFromAnotherFlightIsRejected() {
        when(repository.lockSeat(flight,seat)).thenReturn(Optional.empty());
        assertEquals("SEAT_NOT_FOUND",assertThrows(ApiException.class,()->service.create(request)).code());
        verify(repository,never()).reserve(any(),any());
    }
}
