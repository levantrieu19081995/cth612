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
    private static final BigDecimal CHILD_FARE=new BigDecimal("1125000");
    private static final Map<Integer,BigDecimal> BAGGAGE_FEES=Map.of(
        15,new BigDecimal("150000"),20,new BigDecimal("200000"),25,new BigDecimal("300000"));
    private static final Map<String,BigDecimal> MEAL_FEES=Map.of(
        "CHICKEN",new BigDecimal("90000"),"VEGETARIAN",new BigDecimal("75000"),"SANDWICH",new BigDecimal("60000"));
    private static final BigDecimal ROW_ONE_SEAT_FEE=new BigDecimal("100000");
    private static final BigDecimal PREMIUM_SEAT_FEE=new BigDecimal("50000");
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
    public List<Booking> createGroup(GroupBookingRequest request) {
        validateGroup(request);
        for(int attempt=0;attempt<5;attempt++) {
            try {
                return Objects.requireNonNull(transaction.execute(status->createGroupInTransaction(request)));
            } catch(RuntimeException ex) {
                if(sqlState(ex,"23505")) {
                    var existing=repository.findGroupRequest(request.requestId());
                    if(existing.isPresent()) return previousGroup(request,existing.get());
                }
                if(!isSerializationFailure(ex)) throw ex;
                if(attempt==4) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"TRANSACTION_RETRY_EXHAUSTED","Database đang bận. Vui lòng thử lại.");
                sleepBeforeRetry(attempt);
            }
        }
        throw new IllegalStateException("Unreachable retry branch");
    }
    private List<Booking> createGroupInTransaction(GroupBookingRequest request) {
        var previous=repository.findGroupRequest(request.requestId());
        if(previous.isPresent()) return previousGroup(request,previous.get());
        requireFlight(request.flightId());
        if(!repository.flightBookable(request.flightId()))
            throw new ApiException(HttpStatus.CONFLICT,"FLIGHT_NOT_BOOKABLE","Chuyến bay không còn nhận đặt vé.");

        String fingerprint=RequestIdentity.fingerprint(request);
        Instant now=Instant.now();
        repository.insertGroupRequest(request.requestId(),request.flightId(),fingerprint,now);

        Map<UUID,Seat> lockedSeats=new HashMap<>();
        request.passengers().stream().map(GroupPassenger::seatId).filter(Objects::nonNull).distinct()
            .sorted(Comparator.comparing(UUID::toString)).forEach(seatId->{
                Seat seat=repository.lockSeat(request.flightId(),seatId).orElseThrow(()->
                    new ApiException(HttpStatus.NOT_FOUND,"SEAT_NOT_FOUND","Ghế không thuộc chuyến bay này."));
                lockedSeats.put(seatId,seat);
            });
        for(GroupPassenger passenger:request.passengers()) {
            if(passenger.seatId()==null) continue;
            Seat seat=lockedSeats.get(passenger.seatId());
            if(!"AVAILABLE".equals(seat.status())||!repository.reserve(request.flightId(),passenger.seatId()))
                throw new ApiException(HttpStatus.CONFLICT,"SEAT_ALREADY_BOOKED","Ghế "+seat.seatNo()+" đã được đặt.");
        }

        List<Booking> confirmed=new ArrayList<>();
        BigDecimal total=BigDecimal.ZERO;
        for(int index=0;index<request.passengers().size();index++) {
            GroupPassenger passenger=request.passengers().get(index);
            Seat seat=passenger.seatId()==null?null:lockedSeats.get(passenger.seatId());
            BigDecimal seatFee=seat==null?BigDecimal.ZERO:seatFee(seat.seatNo());
            BigDecimal amount=ticketFare(passenger.passengerType())
                .add(passenger.baggageKg()==null?BigDecimal.ZERO:BAGGAGE_FEES.get(passenger.baggageKg()))
                .add(passenger.mealCode()==null?BigDecimal.ZERO:MEAL_FEES.get(passenger.mealCode()))
                .add(seatFee)
                .add(seat==null?BigDecimal.ZERO:BookingPolicy.cabinPrice(seat.cabinClass()));
            UUID id=UUID.randomUUID();
            String code="BK-"+id.toString().replace("-","").toUpperCase(Locale.ROOT);
            repository.insertGroupBooking(id,code,request.flightId(),passenger.seatId(),passenger.passengerName(),
                passenger.passengerEmail(),passenger.passengerType(),passenger.baggageKg(),passenger.mealCode(),
                seatFee,request.requestId(),index,now);
            repository.insertPayment(id,amount,"VND",now);
            insertBookingEvents(id,request.flightId(),seat==null?null:seat.seatNo(),code,passenger,amount,now);
            confirmed.add(repository.booking(id).orElseThrow(()->new IllegalStateException("Inserted booking missing")));
            total=total.add(amount);
        }
        repository.completeGroupRequest(request.requestId(),request.passengers().get(0).passengerEmail().trim(),total);
        return List.copyOf(confirmed);
    }
    private void insertBookingEvents(UUID id,UUID flightId,String seatNo,String code,GroupPassenger passenger,
            BigDecimal amount,Instant time) {
        String[] types={"BOOKING_CREATED",seatNo==null?"INFANT_NO_SEAT_REQUIRED":"SEAT_RESERVED",
            "PAYMENT_RECORDED","BOOKING_CONFIRMED"};
        for(int i=0;i<types.length;i++) {
            UUID eventId=UUID.randomUUID(); Instant occurred=time.plusMillis(i);
            try {
                Map<String,Object> payload=new LinkedHashMap<>();
                payload.put("flightId",flightId);
                payload.put("seatNo",seatNo);
                payload.put("bookingCode",code);
                payload.put("passengerType",passenger.passengerType().name());
                payload.put("baggageKg",passenger.baggageKg());
                payload.put("mealCode",passenger.mealCode());
                payload.put("amount",amount);
                String event=json.writeValueAsString(Map.of("eventId",eventId,"eventType",types[i],
                    "aggregateType","BOOKING","aggregateId",id,"occurredAt",occurred.toString(),"payloadVersion",1,
                    "payload",payload));
                repository.insertEvent(eventId,id,types[i],event,occurred);
            } catch(JacksonException ex) { throw new IllegalStateException("Cannot encode booking event",ex); }
        }
    }
    private void validateGroup(GroupBookingRequest request) {
        if(request==null||request.flightId()==null||request.requestId()==null||request.passengers()==null
                ||request.passengers().isEmpty()||request.passengers().size()>9)
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_BOOKING_GROUP","Nhóm đặt vé phải có từ 1 đến 9 hành khách.");
        boolean hasAdult=request.passengers().stream().filter(Objects::nonNull)
            .anyMatch(passenger->passenger.passengerType()==PassengerType.ADULT);
        boolean hasInfant=request.passengers().stream().filter(Objects::nonNull)
            .anyMatch(passenger->passenger.passengerType()==PassengerType.INFANT);
        if(hasInfant&&!hasAdult)
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PASSENGER","Trẻ dưới 2 tuổi phải đặt cùng ít nhất một người lớn.");
        for(GroupPassenger passenger:request.passengers()) {
            if(passenger==null||passenger.passengerType()==null)
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PASSENGER","Thông tin hành khách không hợp lệ.");
            if(passenger.passengerType()==PassengerType.INFANT&&passenger.seatId()!=null)
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PASSENGER","INFANT không được chọn ghế.");
            if(passenger.passengerType()!=PassengerType.INFANT&&passenger.seatId()==null)
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PASSENGER","ADULT/CHILD phải chọn ghế.");
            if(passenger.baggageKg()!=null&&!BAGGAGE_FEES.containsKey(passenger.baggageKg()))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ADD_ON","Hành lý phải là 15, 20 hoặc 25 kg.");
            if(passenger.mealCode()!=null&&!MEAL_FEES.containsKey(passenger.mealCode()))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ADD_ON","Suất ăn không hợp lệ.");
        }
    }
    private BigDecimal ticketFare(PassengerType type) {
        return switch(type) {
            case INFANT -> BigDecimal.ZERO;
            case CHILD -> CHILD_FARE;
            case ADULT -> BookingPolicy.DEMO_FARE;
        };
    }
    private BigDecimal seatFee(String seatNo) {
        if(seatNo.matches("^01[A-F]$")) return ROW_ONE_SEAT_FEE;
        if(seatNo.endsWith("A")||seatNo.endsWith("F")) return PREMIUM_SEAT_FEE;
        return BigDecimal.ZERO;
    }
    private List<Booking> previousGroup(GroupBookingRequest request,BookingRepository.ExistingGroupRequest previous) {
        if(!Objects.equals(previous.fingerprint(),RequestIdentity.fingerprint(request)))
            throw new ApiException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Yêu cầu đã được dùng với thông tin khác.");
        return repository.bookingsForGroup(previous.requestId());
    }
    private void sleepBeforeRetry(int attempt) {
        try { Thread.sleep(25L*(attempt+1)); }
        catch(InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"REQUEST_INTERRUPTED","Yêu cầu bị gián đoạn.");
        }
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
        writeEvents(id,bookingPayload,now);
        return repository.booking(id).orElseThrow(()->new IllegalStateException("Inserted booking missing"));
    }
    private void writeEvents(UUID bookingId,Map<String,Object> bookingPayload,Instant now) {
        String[] types={"BOOKING_CREATED","SEAT_RESERVED","PAYMENT_RECORDED","BOOKING_CONFIRMED"};
        for(int i=0;i<types.length;i++) {
            UUID eventId=UUID.randomUUID(); Instant occurred=now.plusMillis(i);
            try {
                String payload=json.writeValueAsString(Map.of("eventId",eventId,"eventType",types[i],
                    "aggregateType","BOOKING","aggregateId",bookingId,"occurredAt",occurred.toString(),"payloadVersion",1,
                    "payload",bookingPayload));
                repository.insertEvent(eventId,bookingId,types[i],payload,occurred);
            } catch(JacksonException ex) { throw new IllegalStateException("Cannot encode booking event",ex); }
        }
    }

    // ---- Party / round-trip booking: one transaction, one group code ----
    public BookingGroup group(String code) {
        return repository.groupByCode(code==null?"":code.trim().toUpperCase(Locale.ROOT)).orElseThrow(()->
            new ApiException(HttpStatus.NOT_FOUND,"BOOKING_GROUP_NOT_FOUND","Không tìm thấy mã đặt chỗ."));
    }
    public BookingGroup groupByRequest(UUID requestId) {
        return repository.groupByRequest(requestId).orElseThrow(()->
            new ApiException(HttpStatus.NOT_FOUND,"BOOKING_GROUP_NOT_FOUND","Yêu cầu chưa có mã đặt chỗ được xác nhận."));
    }
    public BookingGroup createGroup(CreateBookingGroup request) {
        validateGroupShape(request);
        for(int attempt=0;attempt<5;attempt++) {
            try { return Objects.requireNonNull(transaction.execute(status->createGroupInTransaction(request))); }
            catch(RuntimeException ex) {
                if(sqlState(ex,"23505")) {
                    var existing=repository.groupByRequest(request.requestId());
                    if(existing.isPresent()) return previousGroup(request,existing.get());
                    if(repository.findGroupRequest(request.requestId()).isPresent())
                        throw new ApiException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Yêu cầu đã được dùng với thông tin khác.");
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
    private void validateGroupShape(CreateBookingGroup request) {
        int legs=request.flightIds().size();
        if(!"VND".equals(request.payment().currency()))
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PAYMENT","Đơn vị thanh toán phải là VND.");
        if(legs==2&&request.flightIds().get(0).equals(request.flightIds().get(1)))
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_TRIP","Chuyến đi và chuyến về phải khác nhau.");
        Set<UUID> seats=new HashSet<>();
        for(TripPassenger p:request.passengers()) {
            if((p.baggageKgs()!=null&&p.baggageKgs().size()!=legs)||(p.mealCodes()!=null&&p.mealCodes().size()!=legs))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ANCILLARY","baggageKgs và mealCodes (nếu gửi) phải có đúng "+legs+" phần tử, mỗi chặng một giá trị (null = không mua).");
            try {
                for(int leg=0;leg<legs;leg++) {
                    BookingPolicy.baggagePrice(p.baggageFor(leg));
                    BookingPolicy.mealPrice(p.mealFor(leg));
                }
            } catch(IllegalArgumentException ex) { throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ANCILLARY",ex.getMessage()); }
            if(p.seatIds().size()!=legs)
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_SEATS","Mỗi hành khách phải chọn đúng "+legs+" ghế (mỗi chặng một ghế).");
            if(p.infantName()!=null&&!"ADULT".equals(p.passengerType()))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_INFANT","Chỉ người lớn mới được kèm em bé (tối đa 1 em bé mỗi người lớn).");
            for(UUID seat:p.seatIds())
                if(!seats.add(seat)) throw new ApiException(HttpStatus.BAD_REQUEST,"DUPLICATE_SEAT","Một ghế không thể gán cho hai hành khách.");
        }
        if(request.passengers().stream().noneMatch(p->"ADULT".equals(p.passengerType())))
            throw new ApiException(HttpStatus.BAD_REQUEST,"ADULT_REQUIRED","Cần ít nhất một người lớn trong đoàn.");
    }
    private BookingGroup createGroupInTransaction(CreateBookingGroup request) {
        String fingerprint=RequestIdentity.fingerprint(request);
        var existingKey=repository.findGroupRequest(request.requestId());
        if(existingKey.isPresent()&&!Objects.equals(existingKey.get().fingerprint(),fingerprint))
            throw new ApiException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Yêu cầu đã được dùng với thông tin khác.");
        var previous=repository.groupByRequest(request.requestId());
        if(previous.isPresent()) return previousGroup(request,previous.get());
        int legs=request.flightIds().size();
        List<BookingRepository.FlightLeg> flights=new ArrayList<>();
        for(UUID flightId:request.flightIds()) {
            var leg=repository.flightLeg(flightId).orElseThrow(()->
                new ApiException(HttpStatus.NOT_FOUND,"FLIGHT_NOT_FOUND","Không tìm thấy chuyến bay."));
            if(!leg.bookable()) throw new ApiException(HttpStatus.CONFLICT,"FLIGHT_NOT_BOOKABLE","Chuyến bay không còn nhận đặt vé.");
            flights.add(leg);
        }
        if(legs==2) {
            var out=flights.get(0); var back=flights.get(1);
            if(!out.origin().equals(back.destination())||!out.destination().equals(back.origin()))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_TRIP","Chuyến về phải đi ngược lại chặng đi.");
            if(!back.departure().isAfter(out.arrival()))
                throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_TRIP","Chuyến về phải khởi hành sau khi chuyến đi đến nơi.");
        }
        // Lock every seat in a fixed order so two overlapping parties cannot wait on each other.
        record Pick(int passenger,int leg,UUID seatId) {}
        List<Pick> picks=new ArrayList<>();
        for(int p=0;p<request.passengers().size();p++)
            for(int l=0;l<legs;l++) picks.add(new Pick(p,l,request.passengers().get(p).seatIds().get(l)));
        Map<Pick,Seat> seats=new HashMap<>();
        for(Pick pick:picks.stream().sorted(Comparator.comparing(x->x.seatId().toString())).toList()) {
            Seat seat=repository.lockSeat(request.flightIds().get(pick.leg()),pick.seatId()).orElseThrow(()->
                new ApiException(HttpStatus.NOT_FOUND,"SEAT_NOT_FOUND","Ghế không thuộc chuyến bay đã chọn."));
            if(!"AVAILABLE".equals(seat.status()))
                throw new ApiException(HttpStatus.CONFLICT,"SEAT_ALREADY_BOOKED","Ghế "+seat.seatNo()+" đã được đặt.");
            seats.put(pick,seat);
        }
        Map<Pick,BigDecimal> fees=new HashMap<>(), prices=new HashMap<>();
        BigDecimal total=BigDecimal.ZERO;
        for(Pick pick:picks) {
            TripPassenger p=request.passengers().get(pick.passenger());
            Seat seat=seats.get(pick);
            try {
                fees.put(pick,BookingPolicy.seatPrice(seat.seatNo()));
                BigDecimal price=BookingPolicy.totalPrice(p.baggageFor(pick.leg()),p.mealFor(pick.leg()),seat.seatNo(),seat.cabinClass(),p.passengerType());
                prices.put(pick,price); total=total.add(price);
            } catch(IllegalArgumentException ex) { throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_ANCILLARY",ex.getMessage()); }
        }
        if(request.payment().amount().compareTo(total)!=0)
            throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PAYMENT","Tổng thanh toán không khớp với giá vé, ghế và dịch vụ đã chọn.");
        for(Pick pick:picks)
            if(!repository.reserve(request.flightIds().get(pick.leg()),pick.seatId()))
                throw new ApiException(HttpStatus.CONFLICT,"SEAT_ALREADY_BOOKED","Ghế "+seats.get(pick).seatNo()+" đã được đặt.");
        UUID groupId=UUID.randomUUID();
        String groupCode="GR-"+groupId.toString().replace("-","").substring(0,10).toUpperCase(Locale.ROOT);
        Instant now=Instant.now();
        repository.insertGroup(groupId,groupCode,legs==2?"ROUND_TRIP":"ONE_WAY",request,total,fingerprint,now);
        for(Pick pick:picks) {
            TripPassenger p=request.passengers().get(pick.passenger());
            Seat seat=seats.get(pick);
            UUID id=UUID.randomUUID();
            String code="BK-"+id.toString().replace("-","").toUpperCase(Locale.ROOT);
            UUID flightId=request.flightIds().get(pick.leg());
            repository.insertGroupTicket(id,code,groupId,pick.leg()+1,pick.passenger()+1,flightId,pick.seatId(),p,request.contactEmail(),fees.get(pick),now);
            repository.insertPayment(id,prices.get(pick),request.payment().currency(),now);
            Map<String,Object> payload=new LinkedHashMap<>();
            payload.put("flightId",flightId);
            payload.put("seatNo",seat.seatNo());
            payload.put("bookingCode",code);
            payload.put("groupCode",groupCode);
            payload.put("tripType",legs==2?"ROUND_TRIP":"ONE_WAY");
            payload.put("legNo",pick.leg()+1);
            payload.put("baggageKg",p.baggageFor(pick.leg()));
            payload.put("mealCode",p.mealFor(pick.leg()));
            payload.put("seatFee",fees.get(pick));
            payload.put("passengerType",p.passengerType());
            payload.put("infantName",p.infantName());
            payload.put("totalAmount",prices.get(pick));
            writeEvents(id,payload,now);
        }
        return repository.groupByCode(groupCode).orElseThrow(()->new IllegalStateException("Inserted booking group missing"));
    }
    private BookingGroup previousGroup(CreateBookingGroup request,BookingGroup existing) {
        String stored=repository.groupFingerprint(request.requestId()).orElse(null);
        if(!Objects.equals(stored,RequestIdentity.fingerprint(request)))
            throw new ApiException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Yêu cầu đã được dùng với thông tin khác.");
        return existing;
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
