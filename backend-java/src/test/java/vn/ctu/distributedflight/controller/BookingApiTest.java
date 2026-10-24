package vn.ctu.distributedflight.controller;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.YearMonth;
import vn.ctu.distributedflight.service.BookingService;
class BookingApiTest {
    private MockMvc mvc;
    private BookingService service;
    @BeforeEach void setup() {
        service=mock(BookingService.class);
        mvc=MockMvcBuilders.standaloneSetup(new BookingController(service)).setControllerAdvice(new ApiErrorHandler()).build();
    }
    @Test void malformedUuidIsStructuredBadRequest() throws Exception {
        mvc.perform(get("/api/flights/not-uuid/seats")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST")).andExpect(jsonPath("$.traceId").isNotEmpty());
    }
    @Test void emptyBookingCannotReachBusinessService() throws Exception {
        mvc.perform(post("/api/bookings").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }
    @Test void invalidEmailAndNegativePaymentAreRejected() throws Exception {
        String body="""
            {"flightId":"00000000-0000-0000-0000-000000000001","seatId":"00000000-0000-0000-0000-000000000002",
            "passengerName":"Passenger","passengerEmail":"invalid","payment":{"amount":-1,"currency":"VND"}}
            """;
        mvc.perform(post("/api/bookings").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
    }
    @Test void unsupportedMethodReturns405() throws Exception {
        mvc.perform(delete("/api/flights")).andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }
    @Test void monthFilterIsAccepted() throws Exception {
        BookingService service=mock(BookingService.class);
        mvc=MockMvcBuilders.standaloneSetup(new BookingController(service)).setControllerAdvice(new ApiErrorHandler()).build();
        mvc.perform(get("/api/flights").param("month","2026-10"))
            .andExpect(status().isOk());
        verify(service).flights(null,null,null,YearMonth.of(2026,10),1);
    }
    @Test void dayAndMonthFiltersCannotBeCombined() throws Exception {
        mvc.perform(get("/api/flights").param("date","2026-10-22").param("month","2026-10"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DATE_FILTER"));
    }
    @Test void requiredSeatCountIsValidated() throws Exception {
        mvc.perform(get("/api/flights").param("requiredSeats","10"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_PARTY_SIZE"));
    }
}
