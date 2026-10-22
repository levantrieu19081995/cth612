package vn.ctu.distributedflight.service;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;
import vn.ctu.distributedflight.dto.BookingDtos.CreateBooking;
import vn.ctu.distributedflight.dto.BookingDtos.GroupBookingRequest;

public final class RequestIdentity {
    private RequestIdentity() {}
    public static String fingerprint(CreateBooking request) {
        try {
            byte[] bytes=JsonMapper.builder().build().writeValueAsBytes(List.of(request.flightId().toString(),request.seatId().toString(),
                request.passengerName().trim(),request.passengerEmail().trim(),request.payment().amount().stripTrailingZeros().toPlainString(),request.payment().currency()));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch(Exception ex) { throw new IllegalStateException("Cannot fingerprint booking request",ex); }
    }
    public static String fingerprint(GroupBookingRequest request) {
        try {
            List<Object> passengers=new ArrayList<>();
            for(var passenger:request.passengers()) {
                passengers.add(Arrays.asList(passenger.passengerName().trim(),passenger.passengerEmail().trim(),
                    passenger.passengerType().name(),passenger.seatId()==null?null:passenger.seatId().toString(),
                    passenger.baggageKg(),passenger.mealCode()));
            }
            byte[] bytes=JsonMapper.builder().build().writeValueAsBytes(Arrays.asList(request.flightId().toString(),passengers));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch(Exception ex) { throw new IllegalStateException("Cannot fingerprint group booking request",ex); }
    }
}
