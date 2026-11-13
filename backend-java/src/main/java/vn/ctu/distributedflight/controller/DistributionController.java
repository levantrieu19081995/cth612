package vn.ctu.distributedflight.controller;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;
import vn.ctu.distributedflight.monitoring.DistributionService;
@RestController
@RequestMapping("/api/monitoring/distribution")
public class DistributionController {
    private final DistributionService service;
    public DistributionController(DistributionService service){this.service=service;}
    @Operation(summary="Dữ liệu và vị trí replica, phân trang theo cursor",description="SQL: bookings/payments/outbox_events/flight_seats; lọc node là node ID, mỗi lượt quét tối đa 100 dòng. Cassandra: bắt buộc partition mã vé/UUID hoặc ngày UTC; node là địa chỉ. Metadata không xác nhận replica đã nhận từng bản ghi.")
    @GetMapping("/records") public DistributionService.Page records(
        @RequestParam(defaultValue="cockroach") String database,@RequestParam(defaultValue="bookings") String table,
        @RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String date,
        @RequestParam(defaultValue="") String node,@RequestParam(required=false) String cursor,
        @RequestParam(defaultValue="20") int limit) {return service.browse(database,table,query.trim(),date.trim(),node.trim(),cursor,limit);}
    @Operation(summary="Đếm dòng hai bảng Cassandra theo yêu cầu",description="Cache 60 giây, timeout 3 giây mỗi truy vấn; lỗi trả rows=null, không suy ra từ outbox. Không gọi bằng polling.")
    @GetMapping("/counts") public DistributionService.Counts counts(){return service.counts();}
}
