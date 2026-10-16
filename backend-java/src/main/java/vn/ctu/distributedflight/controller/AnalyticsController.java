package vn.ctu.distributedflight.controller;
import java.time.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import vn.ctu.distributedflight.repository.*;
@RestController
@RequestMapping("/api/analytics")
@Tag(name="Thống kê",description="Số liệu đọc từ cả CockroachDB và Cassandra")
public class AnalyticsController {
    private final AnalyticsRepository sql;
    private final OutboxRepository outbox;
    private final EventRepository events;
    public AnalyticsController(AnalyticsRepository sql,OutboxRepository outbox,EventRepository events) { this.sql=sql;this.outbox=outbox;this.events=events; }
    public record Summary(AnalyticsRepository.Summary business,OutboxRepository.Stats outbox,Long eventsToday,String eventStoreStatus,String eventDateUtc,String observedAt) {}
    @Operation(summary="Tổng hợp vé, thanh toán và sự kiện",description="Vé/thanh toán/ghế từ CockroachDB, outbox đang chờ, số sự kiện trong ngày UTC từ Cassandra (null khi Cassandra không đọc được).")
    @GetMapping("/summary") public Summary summary() {
        var business=sql.summary();var backlog=outbox.stats();
        LocalDate day=LocalDate.now(ZoneOffset.UTC);
        Long count=null;String state="AVAILABLE";
        try { count=events.countByDay(day); } catch(RuntimeException ex) { state="UNAVAILABLE"; }
        return new Summary(business,backlog,count,state,day.toString(),Instant.now().toString());
    }
}
