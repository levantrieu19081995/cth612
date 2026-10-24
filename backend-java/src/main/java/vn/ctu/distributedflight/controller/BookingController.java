package vn.ctu.distributedflight.controller;
import java.net.URI;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.ctu.distributedflight.dto.BookingDtos.*;
import vn.ctu.distributedflight.service.ApiException;
import vn.ctu.distributedflight.service.BookingService;

@RestController
@RequestMapping("/api")
@Tag(name="Đặt vé (CockroachDB)",description="Chuyến bay, ghế và vé; ghi trong giao dịch SERIALIZABLE của CockroachDB")
public class BookingController {
    private final BookingService service;
    public BookingController(BookingService service) { this.service=service; }
    @Operation(summary="Tìm chuyến bay",description="Chuyến còn khởi hành trong tương lai, tối đa 100 chuyến; mỗi kết quả cho biết đủ số ghế yêu cầu hay không. Dùng date (yyyy-MM-dd) để tìm theo ngày hoặc month (yyyy-MM) để tìm cả tháng; ngày tính theo giờ Việt Nam.")
    @GetMapping("/flights")
    public List<Flight> flights(@Parameter(description="Mã sân bay đi, ví dụ SGN") @RequestParam(required=false) String origin,
            @Parameter(description="Mã sân bay đến, ví dụ HAN") @RequestParam(required=false) String destination,
            @Parameter(description="Ngày khởi hành (yyyy-MM-dd), không dùng cùng month") @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate date,
            @Parameter(description="Tháng khởi hành (yyyy-MM), không dùng cùng date") @RequestParam(required=false) @DateTimeFormat(pattern="yyyy-MM") YearMonth month,
            @Parameter(description="Số ghế cần có, từ 1 đến 9") @RequestParam(defaultValue="1") int requiredSeats) {
        if(requiredSeats<1||requiredSeats>9) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_PARTY_SIZE","Số ghế yêu cầu phải từ 1 đến 9.");
        if(date!=null&&month!=null) throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_DATE_FILTER","Chỉ được tìm theo ngày hoặc theo tháng.");
        return service.flights(origin,destination,date,month,requiredSeats);
    }
    @Operation(summary="Danh sách ghế của chuyến bay",description="Trạng thái AVAILABLE hoặc BOOKED. 404 FLIGHT_NOT_FOUND nếu chuyến không tồn tại.")
    @GetMapping("/flights/{flightId}/seats")
    public List<Seat> seats(@PathVariable UUID flightId) { return service.seats(flightId); }
    @Operation(summary="Đặt vé",description="""
        Một giao dịch CockroachDB: khóa ghế, lưu dịch vụ, tạo vé và ghi nhận thanh toán demo cùng 4 sự kiện outbox.
        Giá cơ bản 1500000 VND gồm ghế tiêu chuẩn. Hành lý: 15kg 150000, 20kg 200000, 25kg 300000 VND.
        Suất ăn: CHICKEN 90000, VEGETARIAN 75000, SANDWICH 60000 VND.
        Ghế hàng 01 phụ thu 100000 VND; ghế A/F ở hàng khác phụ thu 50000 VND; chỉ áp dụng mức cao nhất.
        Hạng ghế: ECONOMY không phụ thu, PREMIUM_ECONOMY +500000, BUSINESS +1000000 VND.
        ADULT trả giá cơ bản; CHILD trả 75% giá cơ bản. Trẻ dưới 2 tuổi không có booking ghế trong luồng mô phỏng này.
        payment.amount phải bằng tổng do server tính. Đây là thanh toán mô phỏng, chưa thu tiền thật.
        Gửi lại cùng requestId trả về đúng vé cũ; cùng requestId nhưng khác nội dung → 409 IDEMPOTENCY_KEY_REUSED.
        Ghế đã có người đặt → 409 SEAT_ALREADY_BOOKED.""")
    @PostMapping("/bookings")
    public ResponseEntity<Booking> create(@RequestBody @Valid CreateBooking request) {
        Booking result=service.create(request);
        return ResponseEntity.created(URI.create("/api/bookings/"+result.bookingId())).body(result);
    }
    @Operation(summary="Xem một vé",description="404 BOOKING_NOT_FOUND nếu không có.")
    @GetMapping("/bookings/{bookingId}")
    public Booking booking(@PathVariable UUID bookingId) { return service.booking(bookingId); }
    @Operation(summary="Tìm vé theo requestId",description="Dùng khi mất kết nối sau lúc gửi đặt vé: kiểm tra yêu cầu đó đã thành vé chưa.")
    @GetMapping("/bookings/requests/{requestId}")
    public Booking request(@PathVariable UUID requestId) { return service.byRequest(requestId); }
}
