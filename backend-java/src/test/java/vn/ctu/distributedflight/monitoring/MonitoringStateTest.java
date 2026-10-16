package vn.ctu.distributedflight.monitoring;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
class MonitoringStateTest {
    @Test void allNodesAndQueriesAreRequiredForHealthy() {
        assertEquals("HEALTHY",MonitoringService.state(true,4,4));
        assertEquals("DEGRADED",MonitoringService.state(true,3,4));
        assertEquals("UNAVAILABLE",MonitoringService.state(false,4,4));
    }
}
