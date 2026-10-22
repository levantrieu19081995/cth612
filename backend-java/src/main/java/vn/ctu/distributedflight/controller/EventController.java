package vn.ctu.distributedflight.controller;
import java.util.UUID;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import vn.ctu.distributedflight.dto.EventDtos.Timeline;
import vn.ctu.distributedflight.service.EventService;
@RestController
@RequestMapping("/api/bookings")
@Tag(name="Sự kiện (Cassandra)",description="Lịch sử sự kiện của vé, đọc từ Cassandra")
public class EventController {
    private final EventService service;
    public EventController(EventService service) { this.service=service; }
    @Operation(summary="Lịch sử sự kiện của một vé",description="4 sự kiện đặt vé và thanh toán đọc từ Cassandra; vé trẻ dưới 2 tuổi ghi nhận INFANT_NO_SEAT_REQUIRED thay cho SEAT_RESERVED. Kèm số sự kiện còn chờ trong outbox. 503 EVENT_STORE_UNAVAILABLE khi Cassandra không đọc được (vé vẫn hợp lệ trong CockroachDB).")
    @GetMapping("/{id}/events") public Timeline timeline(@PathVariable UUID id) { return service.timeline(id); }
}
