package vn.ctu.distributedflight.controller;

import java.time.Instant;
import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
@Tag(name="Hệ thống",description="Kiểm tra backend còn sống")
public class SystemController {

    @Operation(summary="Ping backend",description="Không chạm database; dùng cho ma trận máy trên trang giám sát.")
    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of(
                "service", "distributed-flight-booking",
                "status", "UP",
                "timestamp", Instant.now().toString());
    }
}
