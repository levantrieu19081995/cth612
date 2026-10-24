package vn.ctu.distributedflight.domain;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class BookingPolicyTest {
    @Test void calculatesDemoFareWithSelectedAncillaries() {
        assertEquals(new BigDecimal("1840000.00"),
            BookingPolicy.totalPrice(15,"CHICKEN","01A"));
    }

    @Test void standardSeatsAreIncludedAndWindowSeatsHaveSurcharge() {
        assertEquals(new BigDecimal("0"),BookingPolicy.seatPrice("03B"));
        assertEquals(new BigDecimal("50000"),BookingPolicy.seatPrice("03F"));
        assertEquals(new BigDecimal("100000"),BookingPolicy.seatPrice("01F"));
    }

    @Test void rejectsUnsupportedAncillaryOptions() {
        assertThrows(IllegalArgumentException.class,()->BookingPolicy.baggagePrice(18));
        assertThrows(IllegalArgumentException.class,()->BookingPolicy.mealPrice("NOODLES"));
    }

    @Test void addsCabinFareToTheBasePrice() {
        assertEquals(new BigDecimal("2000000.00"),
            BookingPolicy.totalPrice(null,null,"03B","PREMIUM_ECONOMY"));
        assertEquals(new BigDecimal("2500000.00"),
            BookingPolicy.totalPrice(null,null,"03B","BUSINESS"));
        assertThrows(IllegalArgumentException.class,()->BookingPolicy.cabinPrice("FIRST"));
    }

    @Test void appliesChildDiscountToBaseFareOnly() {
        assertEquals(new BigDecimal("1125000.00"),BookingPolicy.passengerBaseFare("CHILD"));
        assertEquals(new BigDecimal("1625000.00"),
            BookingPolicy.totalPrice(null,null,"03B","PREMIUM_ECONOMY","CHILD"));
        assertThrows(IllegalArgumentException.class,()->BookingPolicy.passengerBaseFare("INFANT"));
    }
}
