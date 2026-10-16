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
        when(repository.lockSeat(flight,seat)).thenReturn(Optional.of(new Seat(seat,"01A","ECONOMY","AVAILABLE")));
        when(repository.reserve(flight,seat)).thenReturn(true);
        when(repository.booking(any())).thenReturn(Optional.of(new Booking(UUID.randomUUID(),"BK-TEST",flight,"TEST",seat,"01A",
            "Test Passenger","test@example.com","CONFIRMED",Instant.now(),new BigDecimal("1500000"),"VND")));
    }
    @Test void soldSeatReturnsConflictAndDoesNotWriteBooking() {
        when(repository.lockSeat(flight,seat)).thenReturn(Optional.of(new Seat(seat,"01A","ECONOMY","BOOKED")));
        ApiException ex=assertThrows(ApiException.class,()->service.create(request));
        assertEquals("SEAT_ALREADY_BOOKED",ex.code());
        verify(repository,never()).insertBooking(any(),anyString(),any(),any());
        verify(manager).rollback(any()); verify(manager,never()).commit(any());
    }
    @Test void alteredFareIsRejectedBeforeOpeningTransaction() {
        CreateBooking wrong=new CreateBooking(flight,seat,"Passenger","p@example.com",new Payment(BigDecimal.ONE,"VND"));
        assertEquals("INVALID_PAYMENT",assertThrows(ApiException.class,()->service.create(wrong)).code());
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
