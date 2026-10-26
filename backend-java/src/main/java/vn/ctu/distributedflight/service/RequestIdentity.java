package vn.ctu.distributedflight.service;

import java.security.*;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;
import vn.ctu.distributedflight.dto.BookingDtos.*;

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
    public static String fingerprint(CreateBookingGroup request) {
        try {
            List<Object> parts=new ArrayList<>();
            request.flightIds().forEach(id->parts.add(id.toString()));
            parts.add(request.contactEmail().trim());
            parts.add(request.payment().amount().stripTrailingZeros().toPlainString());
            parts.add(request.payment().currency());
            for(TripPassenger passenger:request.passengers()) {
                parts.add(Arrays.asList(passenger.passengerName().trim(),passenger.passengerType(),
                    Objects.toString(passenger.baggageKg(),""),Objects.toString(passenger.mealCode(),""),
                    Objects.toString(passenger.infantName(),""),passenger.seatIds().stream().map(UUID::toString).toList()));
            }
            byte[] bytes=JsonMapper.builder().build().writeValueAsBytes(parts);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch(Exception ex) { throw new IllegalStateException("Cannot fingerprint booking group request",ex); }
    }
}
