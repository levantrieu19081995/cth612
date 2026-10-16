package vn.ctu.distributedflight.repository;
import java.math.BigDecimal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class AnalyticsRepository {
    public record Summary(long bookings,long confirmed,long payments,BigDecimal demoRevenue,long flights,long availableSeats) {}
    private final JdbcTemplate jdbc;
    public AnalyticsRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Summary summary() {
        return jdbc.queryForObject("""
            SELECT (SELECT count(*) FROM bookings) bookings,
            (SELECT count(*) FROM bookings WHERE status='CONFIRMED') confirmed,
            (SELECT count(*) FROM payments WHERE status='SUCCESS') payments,
            (SELECT COALESCE(sum(amount),0) FROM payments WHERE status='SUCCESS') revenue,
            (SELECT count(*) FROM flights WHERE departure_time>now()) flights,
            (SELECT count(*) FROM flight_seats s JOIN flights f ON s.flight_id=f.id WHERE s.status='AVAILABLE' AND f.departure_time>now()) seats
            """,(rs,n)->new Summary(rs.getLong("bookings"),rs.getLong("confirmed"),rs.getLong("payments"),
                rs.getBigDecimal("revenue"),rs.getLong("flights"),rs.getLong("seats")));
    }
    public boolean sqlReady() { return Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1",Integer.class)); }
    public int cockroachMembership() { return jdbc.queryForObject("SELECT count(*) FROM crdb_internal.gossip_nodes",Integer.class); }
}
