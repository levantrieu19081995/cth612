-- Choose replication settings only after testing the real 4-node cluster.
-- Example local dev keyspace; DO NOT copy RF blindly to final cluster.
CREATE KEYSPACE IF NOT EXISTS flight_booking_events
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

CREATE TABLE IF NOT EXISTS flight_booking_events.booking_events_by_booking (
    booking_id uuid,
    occurred_at timestamp,
    event_id uuid,
    event_type text,
    flight_id uuid,
    seat_no text,
    payload text,
    payload_version int,
    PRIMARY KEY ((booking_id), occurred_at, event_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC, event_id ASC);

CREATE TABLE IF NOT EXISTS flight_booking_events.booking_events_by_day (
    event_date date,
    occurred_at timestamp,
    event_id uuid,
    booking_id uuid,
    event_type text,
    payload text,
    payload_version int,
    PRIMARY KEY ((event_date), occurred_at, event_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC, event_id ASC);
