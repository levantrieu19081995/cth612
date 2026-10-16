package vn.ctu.distributedflight.controller;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;
import vn.ctu.distributedflight.monitoring.MonitoringService;
import vn.ctu.distributedflight.monitoring.ReplicationService;
@RestController
@RequestMapping("/api/monitoring")
@Tag(name="Giám sát cụm",description="Trạng thái thật của các node và vị trí dữ liệu, đo trực tiếp từ hai cụm")
public class MonitoringController {
    private final MonitoringService service;
    private final ReplicationService replication;
    public MonitoringController(MonitoringService service,ReplicationService replication) { this.service=service;this.replication=replication; }
    @Operation(summary="Tổng quan cụm",description="Từng node CockroachDB/Cassandra ONLINE/OFFLINE, HEALTHY/DEGRADED/UNAVAILABLE, outbox đang chờ, các lần đổi trạng thái. Backend đo lại mỗi 4 giây.")
    @GetMapping("/overview") public MonitoringService.Overview overview() { return service.overview(); }
    @Operation(summary="Phân tán dữ liệu",description="Số bản sao thực tế/cấu hình, range nào nằm trên node nào, range mất đa số, Cassandra còn ghi được ở mức nhất quán đang dùng không, và 5 vé mới nhất nằm trên node nào. Cache 5 giây.")
    @GetMapping("/replication") public ReplicationService.Snapshot replication() { return replication.snapshot(); }
}
