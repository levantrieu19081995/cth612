package vn.ctu.distributedflight.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.ctu.distributedflight.monitoring.DistributionService;
import vn.ctu.distributedflight.repository.DistributionRepository;
class DistributionApiTest {
    MockMvc mvc;
    @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new DistributionController(new DistributionService(mock(DistributionRepository.class)))).setControllerAdvice(new ApiErrorHandler()).build();}
    @Test void invalidTableReturnsStructured400() throws Exception {
        mvc.perform(get("/api/monitoring/distribution/records").param("table","invalid"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DISTRIBUTION_FILTER"));
    }
    @Test void malformedPageSizeReturns400() throws Exception {
        mvc.perform(get("/api/monitoring/distribution/records").param("limit","abc")).andExpect(status().isBadRequest());
    }
    @Test void emptyCassandraPartitionReturns400() throws Exception {
        mvc.perform(get("/api/monitoring/distribution/records").param("database","cassandra").param("table","booking_events_by_booking"))
            .andExpect(status().isBadRequest());
    }
}
