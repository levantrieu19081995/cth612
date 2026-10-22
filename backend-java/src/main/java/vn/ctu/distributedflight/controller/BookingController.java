package vn.ctu.distributedflight.controller;
import java.net.URI;
import java.time.LocalDate;
import java.util.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.service.BookingService;

@RestController
@RequestMapping("/api")
@Tag(name="Đặt vé (CockroachDB)",description="Chuyến bay, ghế và vé; ghi trong giao dịch SERIALIZABLE của CockroachDB")
public class BookingController {
    private final BookingService service;
    public BookingController(BookingService service) { this.service=service; }
    @Operation(summary="Tìm chuyến bay",description="Chuyến còn khởi hành trong tương lai, tối đa 100 chuyến. Ngày tính theo giờ Việt Nam.")
    @GetMapping("/flights")
    public List<Flight> flights(@Parameter(description="Mã sân bay đi, ví dụ SGN") @RequestParam(required=false) String origin,
            @Parameter(description="Mã sân bay đến, ví dụ HAN") @RequestParam(required=false) String destination,
            @Parameter(description="Ngày khởi hành (yyyy-MM-dd)") @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.flights(origin,destination,date);
    }
    @Operation(summary="Danh sách ghế của chuyến bay",description="Trạng thái AVAILABLE hoặc BOOKED. 404 FLIGHT_NOT_FOUND nếu chuyến không tồn tại.")
    @GetMapping("/flights/{flightId}/seats")
    public List<Seat> seats(@PathVariable UUID flightId) { return service.seats(flightId); }
    @Operation(summary="Đặt vé",description="""
        Một giao dịch CockroachDB: khóa ghế, tạo vé, thanh toán demo và 4 sự kiện outbox (chuyển sang Cassandra sau).
        Giá demo bắt buộc 1500000 VND. Gửi lại cùng requestId trả về đúng vé cũ; cùng requestId nhưng khác nội dung → 409 IDEMPOTENCY_KEY_REUSED.
        Ghế đã có người đặt → 409 SEAT_ALREADY_BOOKED.""")
    @PostMapping("/bookings")
    public ResponseEntity<Booking> create(@RequestBody @Valid CreateBooking request) {
        Booking result=service.create(request);
        return ResponseEntity.created(URI.create("/api/bookings/"+result.bookingId())).body(result);
    }
    @Operation(summary="Đặt vé cho nhiều hành khách",description="Đặt đồng bộ 1–9 vé trong cùng giao dịch; requestId hỗ trợ idempotency.")
    @PostMapping("/bookings/group")
    public List<Booking> createGroup(@RequestBody @Valid GroupBookingRequest request) {
        return service.createGroup(request);
    }
    @Operation(summary="Xem một vé",description="404 BOOKING_NOT_FOUND nếu không có.")
    @GetMapping("/bookings/{bookingId}")
    public Booking booking(@PathVariable UUID bookingId) { return service.booking(bookingId); }
    @Operation(summary="Tìm vé theo requestId",description="Dùng khi mất kết nối sau lúc gửi đặt vé: kiểm tra yêu cầu đó đã thành vé chưa.")
    @GetMapping("/bookings/requests/{requestId}")
    public Booking request(@PathVariable UUID requestId) { return service.byRequest(requestId); }
}
