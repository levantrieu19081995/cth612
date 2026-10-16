package vn.ctu.distributedflight.domain;
import java.math.BigDecimal;
public final class BookingPolicy {
    // Fixed demo fare, validated on the server.
    public static final BigDecimal DEMO_FARE = new BigDecimal("1500000.00");
    private BookingPolicy() {}
}
