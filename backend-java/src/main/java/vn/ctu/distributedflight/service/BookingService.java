package vn.ctu.distributedflight.service;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.time.*;
import java.util.*;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import vn.ctu.distributedflight.domain.BookingPolicy;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.repository.BookingRepository;

@Service
public class BookingService {
    private final BookingRepository repository;
    private final JsonMapper json;
    private final TransactionTemplate transaction;
    public BookingService(BookingRepository repository,JsonMapper json,PlatformTransactionManager manager) {
        this.repository=repository; this.json=json;
        transaction=new TransactionTemplate(manager);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_SERIALIZABLE);
    }
    public List<Flight> flights(String origin,String destination,LocalDate date,YearMonth month,int requiredSeats) {
        return repository.flights(origin,destination,date,month,requiredSeats);
    }
    public List<Seat> seats(UUID id) { requireFlight(id); return repository.seats(id); }
    public Booking booking(UUID id) {
        return repository.booking(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"BOOKING_NOT_FOUND","Không tìm thấy vé."));
    }
    public Booking create(CreateBooking request) {
        if(!"VND".equals(request.payment().currency())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PAYMENT","Đơn vị thanh toán phải là VND.");
        }
        try {
            BookingPolicy.baggagePrice(request.baggageKg());
            BookingPolicy.mealPrice(request.mealCode());
        } catch(IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ANCILLARY",ex.getMessage());
        }
        // Retry the whole transaction, including errors raised during commit.
        for(int attempt=0;attempt<5;attempt++) {
            try { return Objects.requireNonNull(transaction.execute(status->createInTransaction(request))); }
            catch(RuntimeException ex) {
                if(request.requestId()!=null&&sqlState(ex,"23505")) {
                    var existing=repository.findRequest(request.requestId());
                    if(existing.isPresent()) return previousBooking(request,existing.get());
                }
                if(!isSerializationFailure(ex)) throw ex;
                if(attempt==4) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"TRANSACTION_RETRY_EXHAUSTED","Database đang bận. Vui lòng thử lại.");
                try { Thread.sleep(25L*(attempt+1)); }
                catch(InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"REQUEST_INTERRUPTED","Yêu cầu bị gián đoạn.");
                }
            }
        }
        throw new IllegalStateException("Unreachable retry branch");
    }
    private Booking createInTransaction(CreateBooking request) {
        var previous=repository.findRequest(request.requestId());
        if(previous.isPresent()) {
            return previousBooking(request,previous.get());
        }
        requireFlight(request.flightId());
        if(!repository.flightBookable(request.flightId())) throw new ApiException(HttpStatus.CONFLICT,"FLIGHT_NOT_BOOKABLE","Chuyến bay không còn nhận đặt vé.");
        Seat seat=repository.lockSeat(request.flightId(),request.seatId()).orElseThrow(()->
            new ApiException(HttpStatus.NOT_FOUND,"SEAT_NOT_FOUND","Ghế không thuộc chuyến bay này."));
        if(!"AVAILABLE".equals(seat.status())) {
            throw new ApiException(HttpStatus.CONFLICT,"SEAT_ALREADY_BOOKED","Ghế "+seat.seatNo()+" đã được đặt.");
        }
        BigDecimal seatFee;
        BigDecimal total;
        try {
            seatFee=BookingPolicy.seatPrice(seat.seatNo());
            total=BookingPolicy.totalPrice(request.baggageKg(),request.mealCode(),seat.seatNo(),seat.cabinClass(),request.passengerType());
        } catch(IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ANCILLARY",ex.getMessage());
        }
        if(request.payment().amount().compareTo(total)!=0) {
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PAYMENT","Tổng thanh toán không khớp với giá vé, ghế và dịch vụ đã chọn.");
        }
        if(!repository.reserve(request.flightId(),request.seatId())) {
            throw new ApiException(HttpStatus.CONFLICT,"SEAT_ALREADY_BOOKED","Ghế "+seat.seatNo()+" đã được đặt.");
        }
        UUID id=UUID.randomUUID();
        String code="BK-"+id.toString().replace("-","").toUpperCase(Locale.ROOT);
        Instant now=Instant.now();
        repository.insertBooking(id,code,request,seatFee,now);
        repository.insertPayment(id,request,now);
        Map<String,Object> bookingPayload=new LinkedHashMap<>();
        bookingPayload.put("flightId",request.flightId());
        bookingPayload.put("seatNo",seat.seatNo());
        bookingPayload.put("bookingCode",code);
        bookingPayload.put("baggageKg",request.baggageKg());
        bookingPayload.put("mealCode",request.mealCode());
        bookingPayload.put("seatFee",seatFee);
        bookingPayload.put("passengerType",request.passengerType());
        bookingPayload.put("totalAmount",request.payment().amount());
        String[] types={"BOOKING_CREATED","SEAT_RESERVED","PAYMENT_RECORDED","BOOKING_CONFIRMED"};
        for(int i=0;i<types.length;i++) {
            UUID eventId=UUID.randomUUID(); Instant occurred=now.plusMillis(i);
            try {
                String payload=json.writeValueAsString(Map.of("eventId",eventId,"eventType",types[i],
                    "aggregateType","BOOKING","aggregateId",id,"occurredAt",occurred.toString(),"payloadVersion",1,
                    "payload",bookingPayload));
                repository.insertEvent(eventId,id,types[i],payload,occurred);
            } catch(JacksonException ex) { throw new IllegalStateException("Cannot encode booking event",ex); }
        }
        return repository.booking(id).orElseThrow(()->new IllegalStateException("Inserted booking missing"));
    }
    private void requireFlight(UUID id) {
        if(!repository.flightExists(id)) throw new ApiException(HttpStatus.NOT_FOUND,"FLIGHT_NOT_FOUND","Không tìm thấy chuyến bay.");
    }
    public static boolean isSerializationFailure(Throwable ex) {
        return sqlState(ex,"40001");
    }
    private Booking previousBooking(CreateBooking request,BookingRepository.ExistingRequest previous) {
        if(!Objects.equals(previous.fingerprint(),RequestIdentity.fingerprint(request)))
            throw new ApiException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Yêu cầu đã được dùng với thông tin khác.");
        return booking(previous.bookingId());
    }
    private static boolean sqlState(Throwable ex,String state) {
        for(Throwable cause=ex;cause!=null;cause=cause.getCause()) {
            if(cause instanceof SQLException sql&&state.equals(sql.getSQLState())) return true;
        }
        return false;
    }
    public Booking byRequest(UUID id) {
        return repository.findRequest(id).map(r->booking(r.bookingId())).orElseThrow(()->
            new ApiException(HttpStatus.NOT_FOUND,"BOOKING_NOT_FOUND","Yêu cầu chưa có vé được xác nhận."));
    }
}
