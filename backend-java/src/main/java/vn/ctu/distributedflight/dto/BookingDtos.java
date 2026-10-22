package vn.ctu.distributedflight.dto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class BookingDtos {
    private BookingDtos() {}
    public record Payment(@NotNull @DecimalMin("0.01") @Digits(integer=16, fraction=2) BigDecimal amount,
                          @NotBlank @Pattern(regexp="VND") String currency) {}
    public record CreateBooking(@NotNull UUID flightId, @NotNull UUID seatId,
            @NotBlank @Size(max=120) String passengerName, @NotBlank @Email @Size(max=254) String passengerEmail,
            @NotNull @Valid Payment payment, UUID requestId) {
        public CreateBooking(UUID flightId, UUID seatId, String passengerName, String passengerEmail, Payment payment) {
            this(flightId, seatId, passengerName, passengerEmail, payment, null);
        }
    }
    public enum PassengerType { ADULT, CHILD, INFANT }
    public record GroupPassenger(@NotBlank @Size(max=120) String passengerName,
            @NotBlank @Email @Size(max=254) String passengerEmail,
            @NotNull PassengerType passengerType, UUID seatId,
            @Min(1) @Max(25) Integer baggageKg,
            @Pattern(regexp="CHICKEN|VEGETARIAN|SANDWICH") String mealCode) {}
    public record GroupBookingRequest(@NotNull UUID flightId, @NotNull UUID requestId,
            @NotEmpty @Size(min=1,max=9) List<@NotNull @Valid GroupPassenger> passengers) {}
    public record Flight(UUID flightId, String flightNo, String origin, String destination,
            String originCity, String destinationCity, Instant departureTime, Instant arrivalTime,
            String status, long availableSeats, BigDecimal price, String currency) {}
    public record Seat(UUID seatId, String seatNo, String cabinClass, String status) {}
    public record Booking(UUID bookingId, String bookingCode, UUID flightId, String flightNo,
            UUID seatId, String seatNo, String passengerName, String passengerEmail,
            String status, Instant createdAt, BigDecimal amount, String currency,
            PassengerType passengerType, Integer baggageKg, String mealCode,
            BigDecimal seatFee, UUID groupRequestId) {
        public Booking(UUID bookingId, String bookingCode, UUID flightId, String flightNo,
                UUID seatId, String seatNo, String passengerName, String passengerEmail,
                String status, Instant createdAt, BigDecimal amount, String currency) {
            this(bookingId,bookingCode,flightId,flightNo,seatId,seatNo,passengerName,passengerEmail,
                status,createdAt,amount,currency,PassengerType.ADULT,null,null,BigDecimal.ZERO,null);
        }
    }
}
