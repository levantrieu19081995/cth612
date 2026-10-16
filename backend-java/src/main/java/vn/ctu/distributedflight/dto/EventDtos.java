package vn.ctu.distributedflight.dto;

import java.time.Instant;
import java.util.*;
import tools.jackson.databind.JsonNode;
public final class EventDtos {
    private EventDtos() {}
    public record Event(UUID eventId,String eventType,UUID bookingId,Instant occurredAt,int payloadVersion,JsonNode payload) {}
    public record Timeline(List<Event> events,long pendingEvents,boolean synchronizedEvents,String observedAt) {}
}
