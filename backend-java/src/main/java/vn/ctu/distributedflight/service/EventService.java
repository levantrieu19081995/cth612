package vn.ctu.distributedflight.service;

import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vn.ctu.distributedflight.dto.EventDtos.Timeline;
import vn.ctu.distributedflight.repository.*;

@Service
public class EventService {
    private final BookingService bookings;
    private final EventRepository events;
    private final OutboxRepository outbox;
    public EventService(BookingService bookings,EventRepository events,OutboxRepository outbox) {
        this.bookings=bookings;this.events=events;this.outbox=outbox;
    }
    public Timeline timeline(UUID bookingId) {
        bookings.booking(bookingId);
        try {
            var rows=events.timeline(bookingId);
            long pending=outbox.pendingFor(bookingId);
            return new Timeline(rows,pending,pending==0&&rows.size()>=4,Instant.now().toString());
        } catch(org.springframework.dao.DataAccessException ex) { throw ex; }
        catch(RuntimeException ex) { throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"EVENT_STORE_UNAVAILABLE","Lịch sử sự kiện đang tạm gián đoạn. Vé đã lưu trong CockroachDB vẫn có hiệu lực."); }
    }
}
