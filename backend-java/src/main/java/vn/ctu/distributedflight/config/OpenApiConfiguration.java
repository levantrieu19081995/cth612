package vn.ctu.distributedflight.config;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Title and description of the generated API docs: Swagger UI at /swagger-ui.html, JSON at /v3/api-docs. */
@Configuration
public class OpenApiConfiguration {
    @Bean
    public OpenAPI flightBookingOpenApi() {
        return new OpenAPI().info(new Info()
            .title("Distributed Flight Booking API")
            .version("0.0.1")
            .description("""
                Ứng dụng đặt vé máy bay phân tán (đồ án CTH612).
                CockroachDB lưu chuyến bay, ghế, vé, thanh toán (giao dịch ACID); Cassandra lưu lịch sử sự kiện của vé,
                được chuyển từ outbox trong CockroachDB. Trạng thái giám sát và phân tán dữ liệu đọc trực tiếp từ hai cụm.
                Thanh toán là mô phỏng: giá cố định 1.500.000 VND."""));
    }
}
