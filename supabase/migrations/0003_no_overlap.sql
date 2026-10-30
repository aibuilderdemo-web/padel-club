-- Two bookings on the same court can't overlap. A booking lasts 90 minutes,
-- so a booking at 18:00 blocks starts from 17:00 to 19:00 on that court.
--
-- If rows that already overlap exist (from hand-made tests), this fails with
-- "could not create exclusion constraint". Delete the extra rows and run it again.

create extension if not exists btree_gist;

-- timestamptz + interval is only STABLE, which an index can't use. Minutes
-- never depend on the time zone, so a wrapper marked IMMUTABLE is safe here.
create function booking_range(start_ts timestamptz) returns tstzrange
language sql immutable as $$
  select tstzrange(start_ts, start_ts + interval '90 minutes')
$$;

alter table bookings add constraint bookings_no_overlap
  exclude using gist (court_id with =, booking_range(starts_at) with &&);
