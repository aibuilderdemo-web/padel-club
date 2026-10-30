-- The booking page must show which slots are taken to everyone, guests
-- included. RLS on bookings (rightly) hides other people's rows, so a plain
-- select returns an empty list for guests and every slot looks free.
--
-- This function runs with the owner's rights (security definer) and returns
-- only court_id and starts_at: no names, phones or user ids leave the table.
-- search_path is empty so nothing can hijack the table lookup.
create or replace function taken_slots(from_ts timestamptz, to_ts timestamptz)
returns table (court_id bigint, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.court_id, b.starts_at
  from public.bookings b
  where b.cancelled_at is null
    and b.starts_at >= from_ts
    and b.starts_at < to_ts
$$;

revoke execute on function taken_slots(timestamptz, timestamptz) from public;
grant execute on function taken_slots(timestamptz, timestamptz) to anon, authenticated;
