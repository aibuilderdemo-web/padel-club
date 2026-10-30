-- Unguessable id for the confirmation URL.
alter table bookings
  add column public_id uuid not null default gen_random_uuid() unique;

-- Starts on the hour or half hour, 08:00 to 21:30 Milan time (90 minutes ends by 23:00).
alter table bookings add constraint bookings_start_slot check (
  extract(second from (starts_at at time zone 'Europe/Rome')) = 0
  and extract(minute from (starts_at at time zone 'Europe/Rome')) in (0, 30)
  and (starts_at at time zone 'Europe/Rome')::time between time '08:00' and time '21:30'
);

alter table bookings add constraint bookings_phone_format check (
  phone ~ '^\+?[0-9 ]{7,15}$'
);

-- Nobody books in the past. A trigger, because now() is not allowed in a CHECK.
create function bookings_not_in_past() returns trigger
language plpgsql as $$
begin
  if new.starts_at <= now() then
    raise exception 'Booking start % is in the past', new.starts_at;
  end if;
  return new;
end;
$$;

create trigger bookings_not_in_past
  before insert on bookings
  for each row execute function bookings_not_in_past();
