package vn.ctu.distributedflight.outbox;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import vn.ctu.distributedflight.repository.*;
class OutboxDispatcherTest {
    @Test void malformedEventDoesNotBlockValidEventsBehindIt() {
        var outbox=mock(OutboxRepository.class);var events=mock(EventRepository.class);var bad=event();var good=event();
        when(outbox.claim(any(),anyInt())).thenReturn(List.of(bad,good));when(outbox.renew(any(),any())).thenReturn(true);
        when(outbox.published(any(),any())).thenReturn(true);
        doThrow(new vn.ctu.distributedflight.domain.InvalidEventException(new IllegalArgumentException())).when(events).publish(bad);
        new OutboxDispatcher(outbox,events,20,true).dispatch();
        verify(outbox,never()).published(eq(bad),any());verify(events).publish(good);verify(outbox).published(eq(good),any());
    }
    private OutboxRepository.Event event() { return new OutboxRepository.Event(UUID.randomUUID(),UUID.randomUUID(),"BOOKING_CONFIRMED","{}",1,Instant.now(),1); }
    @Test void acknowledgementOnlyFollowsSuccessfulProjection() {
        var outbox=mock(OutboxRepository.class);var events=mock(EventRepository.class);var e=event();
        when(outbox.claim(any(),anyInt())).thenReturn(List.of(e));
        when(outbox.renew(any(),any())).thenReturn(true);
        when(outbox.published(any(),any())).thenReturn(true);
        new OutboxDispatcher(outbox,events,20,true).dispatch();
        var order=inOrder(events,outbox);order.verify(events).publish(e);order.verify(outbox).published(eq(e),any());
    }
    @Test void failedProjectionIsRetryableAndNeverAcknowledged() {
        var outbox=mock(OutboxRepository.class);var events=mock(EventRepository.class);var e=event();
        when(outbox.claim(any(),anyInt())).thenReturn(List.of(e));
        when(outbox.renew(any(),any())).thenReturn(true);
        doThrow(new IllegalStateException("Projection failed")).when(events).publish(e);
        new OutboxDispatcher(outbox,events,20,true).dispatch();
        verify(outbox,never()).published(any(),any());verify(outbox).failed(eq(e),any(),eq("IllegalStateException"));
    }
    @Test void outageReleasesRemainingBatchWithoutRepeatedConnectionStorm() {
        var outbox=mock(OutboxRepository.class);var events=mock(EventRepository.class);var a=event();var b=event();
        when(outbox.claim(any(),anyInt())).thenReturn(List.of(a,b));
        when(outbox.renew(any(),any())).thenReturn(true);
        doThrow(new IllegalStateException("Offline")).when(events).publish(a);
        new OutboxDispatcher(outbox,events,20,true).dispatch();
        verify(events,never()).publish(b);verify(outbox).failed(eq(b),any(),anyString());
    }
}
