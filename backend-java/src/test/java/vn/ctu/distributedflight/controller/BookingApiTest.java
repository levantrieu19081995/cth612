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
import vn.ctu.distributedflight.dto.BookingDtos.Booking;
import vn.ctu.distributedflight.dto.BookingDtos.PassengerType;
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
    @Test void groupEndpointReturnsBookingArrayAndNullableInfantSeat() throws Exception {
        UUID flight=UUID.randomUUID(), infantId=UUID.randomUUID();
        when(service.createGroup(any())).thenReturn(List.of(new Booking(infantId,"BK-INFANT",flight,"TEST",null,null,
            "Infant","infant@example.com","CONFIRMED",Instant.now(),BigDecimal.ZERO,"VND",
            PassengerType.INFANT,null,null,BigDecimal.ZERO,UUID.randomUUID())));
        mvc.perform(post("/api/bookings/group").contentType(MediaType.APPLICATION_JSON).content("""
            {"requestId":"00000000-0000-0000-0000-000000000010","flightId":"00000000-0000-0000-0000-000000000001",
            "passengers":[{"passengerName":"Infant","passengerEmail":"infant@example.com","passengerType":"INFANT",
            "seatId":null,"baggageKg":null,"mealCode":null}]}
            """))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].bookingId").value(infantId.toString()))
            .andExpect(jsonPath("$[0].seatId").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[0].seatNo").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[0].passengerType").value("INFANT"))
            .andExpect(jsonPath("$[0].seatFee").value(0))
            .andExpect(jsonPath("$[0].baggageKg").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[0].mealCode").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$[0].amount").value(0));
        verify(service).createGroup(any());
    }
}
