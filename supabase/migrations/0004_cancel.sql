-- Cancel with a code. A cancelled booking keeps its row but frees its slot.

alter table bookings add column cancelled_at timestamptz;

-- Random code shown on the confirmation page. 10 hex characters, unique.
-- Existing rows get a code too (the default runs for each row).
alter table bookings
  add column cancel_code text not null
  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  unique;

-- The overlap rule now ignores cancelled rows.
alter table bookings drop constraint bookings_no_overlap;
alter table bookings add constraint bookings_no_overlap
  exclude using gist (court_id with =, booking_range(starts_at) with &&)
  where (cancelled_at is null);
