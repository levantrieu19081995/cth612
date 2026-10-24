package vn.ctu.distributedflight.domain;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import vn.ctu.distributedflight.dto.BookingDtos.*;

public final class BookingPolicy {
    public static final BigDecimal DEMO_FARE = new BigDecimal("1500000.00");
    private static final Map<Integer, BigDecimal> BAGGAGE_PRICES = Map.of(
        15, new BigDecimal("150000"),
        20, new BigDecimal("200000"),
        25, new BigDecimal("300000")
    );
    private static final Map<String, BigDecimal> MEAL_PRICES = Map.of(
        "CHICKEN", new BigDecimal("90000"),
        "VEGETARIAN", new BigDecimal("75000"),
        "SANDWICH", new BigDecimal("60000")
    );

    public static final List<String> CABIN_CLASSES = List.of("ECONOMY", "PREMIUM_ECONOMY", "BUSINESS");

    private BookingPolicy() {}

    public static Ancillaries ancillaries() {
        return new Ancillaries(
            BAGGAGE_PRICES.entrySet().stream().sorted(Map.Entry.comparingByKey())
                .map(e -> new BaggageOption(e.getKey(), e.getValue())).toList(),
            MEAL_PRICES.entrySet().stream().sorted(Map.Entry.comparingByValue())
                .map(e -> new MealOption(e.getKey(), e.getValue())).toList(),
            List.of(new SeatFeeRule("Hàng 01", seatPrice("01C")),
                new SeatFeeRule("Ghế A/F hàng khác", seatPrice("02A")),
                new SeatFeeRule("Ghế còn lại", BigDecimal.ZERO)));
    }

    public static List<PassengerFare> passengerFares() {
        return List.of(
            new PassengerFare("ADULT", passengerBaseFare("ADULT"), true, true),
            new PassengerFare("CHILD", passengerBaseFare("CHILD"), true, true),
            new PassengerFare("INFANT", BigDecimal.ZERO, false, false));
    }

    public static BigDecimal baggagePrice(Integer baggageKg) {
        if (baggageKg == null) return BigDecimal.ZERO;
        BigDecimal price = BAGGAGE_PRICES.get(baggageKg);
        if (price == null) throw new IllegalArgumentException("Gói hành lý không hợp lệ.");
        return price;
    }

    public static BigDecimal mealPrice(String mealCode) {
        if (mealCode == null) return BigDecimal.ZERO;
        BigDecimal price = MEAL_PRICES.get(mealCode);
        if (price == null) throw new IllegalArgumentException("Suất ăn không hợp lệ.");
        return price;
    }

    public static BigDecimal seatPrice(String seatNo) {
        if (seatNo == null || !seatNo.matches("\\d{2}[A-F]")) {
            throw new IllegalArgumentException("Mã ghế không hợp lệ.");
        }
        if (seatNo.startsWith("01")) return new BigDecimal("100000");
        if (seatNo.endsWith("A") || seatNo.endsWith("F")) return new BigDecimal("50000");
        return BigDecimal.ZERO;
    }

    public static BigDecimal cabinPrice(String cabinClass) {
        return switch (cabinClass) {
            case "ECONOMY" -> BigDecimal.ZERO;
            case "PREMIUM_ECONOMY" -> new BigDecimal("500000");
            case "BUSINESS" -> new BigDecimal("1000000");
            default -> throw new IllegalArgumentException("Hạng vé không hợp lệ.");
        };
    }

    public static BigDecimal passengerBaseFare(String passengerType) {
        return switch (passengerType) {
            case "ADULT" -> DEMO_FARE;
            case "CHILD" -> DEMO_FARE.multiply(new BigDecimal("0.75")).setScale(2);
            default -> throw new IllegalArgumentException("Loại hành khách không hợp lệ.");
        };
    }

    public static BigDecimal totalPrice(Integer baggageKg, String mealCode, String seatNo) {
        return DEMO_FARE.add(baggagePrice(baggageKg)).add(mealPrice(mealCode)).add(seatPrice(seatNo));
    }

    public static BigDecimal totalPrice(Integer baggageKg, String mealCode, String seatNo, String cabinClass) {
        return totalPrice(baggageKg, mealCode, seatNo).add(cabinPrice(cabinClass));
    }

    public static BigDecimal totalPrice(Integer baggageKg, String mealCode, String seatNo, String cabinClass, String passengerType) {
        return passengerBaseFare(passengerType).add(baggagePrice(baggageKg)).add(mealPrice(mealCode))
            .add(seatPrice(seatNo)).add(cabinPrice(cabinClass));
    }
}
