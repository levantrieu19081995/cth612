package vn.ctu.distributedflight.controller;
import static org.junit.jupiter.api.Assertions.*;
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
import org.mockito.ArgumentCaptor;
import vn.ctu.distributedflight.dto.BookingDtos.*;
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
    @Test void legacyGroupRouteKeepsSeatlessInfantContract() throws Exception {
        UUID flightId=UUID.randomUUID();
        UUID requestId=UUID.randomUUID();
        UUID seatId=UUID.randomUUID();
        when(service.createGroup(any(GroupBookingRequest.class))).thenReturn(List.of());
        String body="""
            {"flightId":"%s","requestId":"%s","passengers":[
              {"passengerName":"Adult One","passengerEmail":"adult@example.com","passengerType":"ADULT","seatId":"%s"},
              {"passengerName":"Infant One","passengerEmail":"adult@example.com","passengerType":"INFANT"}
            ]}
            """.formatted(flightId,requestId,seatId);

        mvc.perform(post("/api/bookings/group").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(content().json("[]"));

        ArgumentCaptor<GroupBookingRequest> captor=ArgumentCaptor.forClass(GroupBookingRequest.class);
        verify(service).createGroup(captor.capture());
        assertEquals(PassengerType.INFANT,captor.getValue().passengers().get(1).passengerType());
        assertNull(captor.getValue().passengers().get(1).seatId());
    }
    @Test void richGroupRouteKeepsRoundTripAndSharedCodeContract() throws Exception {
        UUID outboundId=UUID.randomUUID();
        UUID returnId=UUID.randomUUID();
        UUID requestId=UUID.randomUUID();
        UUID outboundSeat=UUID.randomUUID();
        UUID returnSeat=UUID.randomUUID();
        BookingGroup result=new BookingGroup(UUID.randomUUID(),"GR-ROUNDTRIP","ROUND_TRIP","group@example.com",
            "CONFIRMED",Instant.now(),new BigDecimal("3000000.00"),"VND",List.of());
        when(service.createGroup(any(CreateBookingGroup.class))).thenReturn(result);
        String body="""
            {"flightIds":["%s","%s"],"contactEmail":"group@example.com",
             "passengers":[{"passengerName":"Adult One","passengerType":"ADULT","seatIds":["%s","%s"]}],
             "payment":{"amount":3000000,"currency":"VND"},"requestId":"%s"}
            """.formatted(outboundId,returnId,outboundSeat,returnSeat,requestId);

        mvc.perform(post("/api/booking-groups").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location","/api/booking-groups/GR-ROUNDTRIP"))
            .andExpect(jsonPath("$.groupCode").value("GR-ROUNDTRIP"));

        ArgumentCaptor<CreateBookingGroup> captor=ArgumentCaptor.forClass(CreateBookingGroup.class);
        verify(service).createGroup(captor.capture());
        assertEquals(List.of(outboundId,returnId),captor.getValue().flightIds());
        assertEquals(List.of(outboundSeat,returnSeat),captor.getValue().passengers().get(0).seatIds());
    }
    @Test void bothGroupRoutesValidateTheirOwnNestedPassengerShape() throws Exception {
        String invalidLegacy="""
            {"flightId":"00000000-0000-0000-0000-000000000001",
             "requestId":"00000000-0000-0000-0000-000000000002",
             "passengers":[{"passengerName":"Adult","passengerEmail":"not-an-email","passengerType":"ADULT"}]}
            """;
        String invalidRich="""
            {"flightIds":["00000000-0000-0000-0000-000000000001"],"contactEmail":"group@example.com",
             "passengers":[],"payment":{"amount":1,"currency":"VND"},
             "requestId":"00000000-0000-0000-0000-000000000002"}
            """;

        mvc.perform(post("/api/bookings/group").contentType(MediaType.APPLICATION_JSON).content(invalidLegacy))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/booking-groups").contentType(MediaType.APPLICATION_JSON).content(invalidRich))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(service);
    }
}
