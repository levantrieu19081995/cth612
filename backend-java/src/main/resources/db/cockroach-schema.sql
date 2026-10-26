-- Initial CockroachDB schema draft. Review before production/demo migration usage.

CREATE TABLE IF NOT EXISTS airports (
    id UUID PRIMARY KEY,
    code STRING NOT NULL UNIQUE,
    name STRING NOT NULL,
    city STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS flights (
    id UUID PRIMARY KEY,
    flight_no STRING NOT NULL,
    origin_airport_id UUID NOT NULL REFERENCES airports(id),
    destination_airport_id UUID NOT NULL REFERENCES airports(id),
    departure_time TIMESTAMPTZ NOT NULL,
    arrival_time TIMESTAMPTZ NOT NULL,
    status STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS flight_seats (
    id UUID PRIMARY KEY,
    flight_id UUID NOT NULL REFERENCES flights(id),
    seat_no STRING NOT NULL,
    cabin_class STRING NOT NULL,
    status STRING NOT NULL,
    version INT8 NOT NULL DEFAULT 0,
    UNIQUE (flight_id, seat_no)
);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY,
    booking_code STRING NOT NULL UNIQUE,
    flight_id UUID NOT NULL REFERENCES flights(id),
    seat_id UUID NULL REFERENCES flight_seats(id),
    passenger_name STRING NOT NULL,
    passenger_email STRING NOT NULL,
    status STRING NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    passenger_type STRING NOT NULL DEFAULT 'ADULT',
    baggage_kg INT4 NULL,
    meal_code STRING NULL,
    seat_fee DECIMAL(18,2) NOT NULL DEFAULT 0,
    group_request_id UUID NULL,
    group_index INT4 NULL
);

CREATE TABLE IF NOT EXISTS booking_groups (
    request_id UUID PRIMARY KEY,
    flight_id UUID NOT NULL REFERENCES flights(id),
    request_fingerprint STRING NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id),
    amount DECIMAL(18,2) NOT NULL,
    currency STRING NOT NULL,
    status STRING NOT NULL,
    provider STRING NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Database-level safety in addition to transactional seat reservation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_confirmed_booking_per_seat
ON bookings (seat_id) WHERE status = 'CONFIRMED';

CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type STRING NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type STRING NOT NULL,
    payload JSONB NOT NULL,
    payload_version INT8 NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    published_at TIMESTAMPTZ NULL,
    attempt_count INT8 NOT NULL DEFAULT 0,
    last_error STRING NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
ON outbox_events (published_at, occurred_at);

-- Additive migrations preserve existing local/demo bookings.
ALTER TABLE bookings ALTER COLUMN seat_id DROP NOT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_request_id UUID NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_index INT4 NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS request_id UUID NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS request_fingerprint STRING NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS baggage_kg INT8 NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meal_code STRING NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat_fee DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_type STRING NOT NULL DEFAULT 'ADULT';
ALTER TABLE flights ADD COLUMN IF NOT EXISTS airline_code STRING NOT NULL DEFAULT 'VN';
ALTER TABLE flights ADD COLUMN IF NOT EXISTS airline_name STRING NOT NULL DEFAULT 'Vietnam Airlines';
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_request_id ON bookings(request_id) WHERE request_id IS NOT NULL;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS lease_owner UUID NULL;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ NULL;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox_events(next_attempt_at, occurred_at) WHERE published_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_booking ON payments(booking_id);

-- Extend the existing group table for shared codes and round trips.
-- Older one-way groups may have no metadata; their request IDs and tickets stay intact.
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS flight_id UUID NULL REFERENCES flights(id);
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS group_code STRING NULL;
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS trip_type STRING NULL;
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS contact_email STRING NULL;
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS total_amount DECIMAL(18,2) NULL;
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS currency STRING NULL;
ALTER TABLE booking_groups ADD COLUMN IF NOT EXISTS status STRING NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_group_id ON booking_groups(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_group_code ON booking_groups(group_code) WHERE group_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_request_id ON booking_groups(request_id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_id UUID NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS leg_no INT8 NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_no INT8 NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS infant_name STRING NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_group ON bookings(group_id) WHERE group_id IS NOT NULL;
