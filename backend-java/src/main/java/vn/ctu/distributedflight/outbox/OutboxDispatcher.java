package vn.ctu.distributedflight.outbox;

import java.util.*;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.ctu.distributedflight.repository.*;
import vn.ctu.distributedflight.domain.InvalidEventException;

@Component
public class OutboxDispatcher {
    private static final Logger log=LoggerFactory.getLogger(OutboxDispatcher.class);
    private final OutboxRepository outbox;
    private final EventRepository events;
    private final UUID owner=UUID.randomUUID();
    private final int size;
    private final boolean enabled;
    public OutboxDispatcher(OutboxRepository outbox,EventRepository events,
            @Value("${app.outbox.batch-size:20}") int size,@Value("${app.outbox.enabled:true}") boolean enabled) {
        if(size<1||size>100) throw new IllegalArgumentException("Outbox batch size must be 1..100");
        this.outbox=outbox; this.events=events; this.size=size; this.enabled=enabled;
    }
    @Scheduled(fixedDelayString="${app.outbox.poll-ms:1000}",initialDelay=5000)
    public void dispatch() {
        if(!enabled) return;
        try {
            var batch=outbox.claim(owner,size);
            String failure=null;
            for(var event:batch) {
                if(failure!=null) { outbox.failed(event,owner,failure);continue; }
                try {
                    if(!outbox.renew(event,owner)) continue;
                    events.publish(event);
                    if(!outbox.published(event,owner)) log.warn("Event lease changed before acknowledgement; eventId={}",event.id());
                } catch(RuntimeException ex) {
                    String reason=ex.getClass().getSimpleName();
                    if(!(ex instanceof InvalidEventException)) failure=reason;
                    outbox.failed(event,owner,reason);
                    log.warn("Outbox publication deferred; eventId={}, type={}",event.id(),reason);
                }
            }
        } catch(RuntimeException ex) { log.warn("Outbox cycle deferred; type={}",ex.getClass().getSimpleName()); }
    }
}
