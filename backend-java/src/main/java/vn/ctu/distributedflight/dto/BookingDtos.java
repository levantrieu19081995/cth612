package vn.ctu.distributedflight.dto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class BookingDtos {
    private BookingDtos() {}
    public record Payment(@NotNull @DecimalMin("0.01") @Digits(integer=16, fraction=2) BigDecimal amount,
                          @NotBlank @Pattern(regexp="VND") String currency) {}
    public record CreateBooking(@NotNull UUID flightId, @NotNull UUID seatId,
            @NotBlank @Size(max=120) String passengerName, @NotBlank @Email @Size(max=254) String passengerEmail,
                                  @NotNull @Valid Payment payment, UUID requestId,
                                  @Min(15) @Max(25) Integer baggageKg, @Pattern(regexp="CHICKEN|VEGETARIAN|SANDWICH") String mealCode,
                                  @Pattern(regexp="ADULT|CHILD") String passengerType) {
                              public CreateBooking {
                                  if (passengerType == null) passengerType = "ADULT";
                              }
                              public CreateBooking(UUID flightId, UUID seatId, String passengerName, String passengerEmail, Payment payment) {
                                  this(flightId, seatId, passengerName, passengerEmail, payment, null, null, null, "ADULT");
                              }
                              public CreateBooking(UUID flightId, UUID seatId, String passengerName, String passengerEmail,
                                      Payment payment, UUID requestId, Integer baggageKg, String mealCode) {
                                  this(flightId, seatId, passengerName, passengerEmail, payment, requestId, baggageKg, mealCode, "ADULT");
                              }
                          }
    public record Flight(UUID flightId, String flightNo, String origin, String destination,
            String originCity, String destinationCity, Instant departureTime, Instant arrivalTime,
            String status, long availableSeats, BigDecimal price, String currency, boolean sufficientSeats) {}
    public record Seat(UUID seatId, String seatNo, String cabinClass, String status) {}
    public record Booking(UUID bookingId, String bookingCode, UUID flightId, String flightNo,
            UUID seatId, String seatNo, String passengerName, String passengerEmail,
            String status, Instant createdAt, BigDecimal amount, String currency,
            Integer baggageKg, String mealCode, BigDecimal seatFee, String passengerType,
            String cabinClass, BigDecimal cabinFee) {
        public Booking(UUID bookingId, String bookingCode, UUID flightId, String flightNo,
                UUID seatId, String seatNo, String passengerName, String passengerEmail,
                String status, Instant createdAt, BigDecimal amount, String currency,
                Integer baggageKg, String mealCode, BigDecimal seatFee) {
            this(bookingId, bookingCode, flightId, flightNo, seatId, seatNo, passengerName,
                passengerEmail, status, createdAt, amount, currency, baggageKg, mealCode, seatFee, "ADULT", "ECONOMY", BigDecimal.ZERO);
        }
        public Booking(UUID bookingId, String bookingCode, UUID flightId, String flightNo,
                UUID seatId, String seatNo, String passengerName, String passengerEmail,
                String status, Instant createdAt, BigDecimal amount, String currency) {
            this(bookingId, bookingCode, flightId, flightNo, seatId, seatNo, passengerName,
                passengerEmail, status, createdAt, amount, currency, null, null, BigDecimal.ZERO, "ADULT", "ECONOMY", BigDecimal.ZERO);
        }
    }
}
