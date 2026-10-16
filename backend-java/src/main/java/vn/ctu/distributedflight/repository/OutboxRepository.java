package vn.ctu.distributedflight.repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OutboxRepository {
    public record Event(UUID id,UUID bookingId,String eventType,String payload,int version,Instant occurredAt,int attempts) {}
    public record Stats(long pending,long published,long failed,long oldestPendingAgeMs) {}
    private final JdbcTemplate jdbc;
    public OutboxRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public List<Event> claim(UUID owner,int size) {
        return jdbc.query("""
            UPDATE outbox_events SET lease_owner=?,lease_until=now()+INTERVAL '60 seconds',attempt_count=attempt_count+1
            WHERE id IN (SELECT id FROM outbox_events WHERE published_at IS NULL AND next_attempt_at<=now()
                AND (lease_until IS NULL OR lease_until<now()) ORDER BY occurred_at LIMIT ?)
            AND published_at IS NULL AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
            RETURNING *
            """,(rs,n)->new Event(rs.getObject("id",UUID.class),rs.getObject("aggregate_id",UUID.class),
                rs.getString("event_type"),rs.getString("payload"),rs.getInt("payload_version"),
                rs.getTimestamp("occurred_at").toInstant(),rs.getInt("attempt_count")),owner,size);
    }
    public boolean published(Event event,UUID owner) {
        return jdbc.update("UPDATE outbox_events SET published_at=now(),last_error=NULL,lease_owner=NULL,lease_until=NULL WHERE id=? AND lease_owner=? AND published_at IS NULL",
            event.id(),owner)==1;
    }
    public boolean renew(Event event,UUID owner) {
        return jdbc.update("UPDATE outbox_events SET lease_until=now()+INTERVAL '60 seconds' WHERE id=? AND lease_owner=? AND published_at IS NULL",event.id(),owner)==1;
    }
    public void failed(Event event,UUID owner,String reason) {
        long seconds=Math.min(30,1L<<Math.min(5,event.attempts()));
        jdbc.update("""
            UPDATE outbox_events SET last_error=?,next_attempt_at=now()+(? * INTERVAL '1 second'),
            lease_owner=NULL,lease_until=NULL WHERE id=? AND lease_owner=? AND published_at IS NULL
            """,reason,seconds,event.id(),owner);
    }
    public long pendingFor(UUID bookingId) {
        return jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE aggregate_id=? AND published_at IS NULL",Long.class,bookingId);
    }
    public Stats stats() {
        return jdbc.queryForObject("""
            SELECT count(*) FILTER (WHERE published_at IS NULL) pending,
            count(*) FILTER (WHERE published_at IS NOT NULL) published,
            count(*) FILTER (WHERE published_at IS NULL AND last_error IS NOT NULL) failed,
            COALESCE(EXTRACT(EPOCH FROM now()-MIN(occurred_at) FILTER(WHERE published_at IS NULL))*1000,0) age
            FROM outbox_events
            """,(rs,n)->new Stats(rs.getLong("pending"),rs.getLong("published"),rs.getLong("failed"),Math.max(0,rs.getLong("age"))));
    }
}
