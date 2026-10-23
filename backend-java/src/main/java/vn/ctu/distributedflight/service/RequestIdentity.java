package vn.ctu.distributedflight.service;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;
import vn.ctu.distributedflight.dto.BookingDtos.CreateBooking;

public final class RequestIdentity {
    private RequestIdentity() {}
    public static String fingerprint(CreateBooking request) {
        try {
            byte[] bytes=JsonMapper.builder().build().writeValueAsBytes(Arrays.asList(
                request.flightId().toString(),request.seatId().toString(),request.passengerName().trim(),
                request.passengerEmail().trim(),request.payment().amount().stripTrailingZeros().toPlainString(),
                request.payment().currency(),Objects.toString(request.baggageKg(),""),Objects.toString(request.mealCode(),""),
                request.passengerType()));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch(Exception ex) { throw new IllegalStateException("Cannot fingerprint booking request",ex); }
    }
}
