package vn.ctu.distributedflight.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.ctu.distributedflight.service.BookingService;
class BookingApiTest {
    private MockMvc mvc;
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.standaloneSetup(new BookingController(mock(BookingService.class))).setControllerAdvice(new ApiErrorHandler()).build();
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
}
