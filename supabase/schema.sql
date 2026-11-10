-- Padel Club Navigli schema.
-- Paste the whole file into the Supabase SQL Editor and run it.
-- Safe to run again.

-- Courts ------------------------------------------------------------------

create table if not exists public.courts (
  id smallint primary key,
  name text not null unique
);

insert into public.courts (id, name) values
  (1, 'Court 1'),
  (2, 'Court 2'),
  (3, 'Court 3'),
  (4, 'Court 4')
on conflict (id) do nothing;

alter table public.courts enable row level security;

drop policy if exists "Anyone can read courts" on public.courts;
create policy "Anyone can read courts"
  on public.courts for select
  to anon, authenticated
  using (true);

-- Bookings ----------------------------------------------------------------
-- No rule against overlapping bookings yet: that comes in task 3.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  court_id smallint not null references public.courts (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guest_name text not null,
  phone text not null,
  cancel_code text not null unique,
  created_at timestamptz not null default now(),

  constraint bookings_last_90_minutes
    check (ends_at = starts_at + interval '90 minutes'),
  constraint bookings_start_on_the_hour_or_half_hour
    check (
      date_trunc('minute', starts_at) = starts_at
      and extract(minute from starts_at at time zone 'Europe/Rome') in (0, 30)
    ),
  constraint bookings_start_between_8_and_21_30_milan_time
    check ((starts_at at time zone 'Europe/Rome')::time between time '08:00' and time '21:30'),
  constraint bookings_cancel_code_6_characters
    check (char_length(cancel_code) = 6),
  constraint bookings_guest_name_not_blank
    check (btrim(guest_name) <> ''),
  constraint bookings_phone_not_blank
    check (btrim(phone) <> '')
);

-- RLS on and no policies: the public can't read or write bookings.
alter table public.bookings enable row level security;

-- Free slots --------------------------------------------------------------
-- Every start from 8:00 to 21:30 Milan time on for_day, per court, that is
-- not past and does not overlap a booking. Returns only court and time.
-- Empty for days outside today + 13 (Milan time).

create or replace function public.free_slots(for_day date)
returns table (court_id smallint, court_name text, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, s.starts_at
  from public.courts c
  cross join lateral (
    select g.local_start at time zone 'Europe/Rome' as starts_at
    from generate_series(
      for_day + time '08:00',
      for_day + time '21:30',
      interval '30 minutes'
    ) as g (local_start)
  ) s
  where for_day between (now() at time zone 'Europe/Rome')::date
                    and (now() at time zone 'Europe/Rome')::date + 13
    and s.starts_at > now()
    and not exists (
      select 1
      from public.bookings b
      where b.court_id = c.id
        and b.starts_at < s.starts_at + interval '90 minutes'
        and b.ends_at > s.starts_at
    )
  order by c.id, s.starts_at;
$$;

revoke execute on function public.free_slots(date) from public;
grant execute on function public.free_slots(date) to anon, authenticated;

-- Book -------------------------------------------------------------------
-- The only way the public writes a booking. Refuses past starts and days
-- beyond today + 13 (Milan time); the table's checks do the rest.
-- Makes the 6-character cancel code and returns the new booking's id.

create or replace function public.book(
  p_court_id smallint,
  p_starts_at timestamptz,
  p_guest_name text,
  p_phone text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- No 0/O or 1/I, so the code is easy to read back.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  today date := (now() at time zone 'Europe/Rome')::date;
  random_bytes bytea;
  code text;
  clash text;
  new_id uuid;
begin
  if coalesce(btrim(p_guest_name), '') = '' then
    raise exception 'Please enter your name.';
  end if;
  if coalesce(btrim(p_phone), '') = '' then
    raise exception 'Please enter your phone number.';
  end if;
  if p_starts_at <= now() then
    raise exception 'That start time has already passed.';
  end if;
  if (p_starts_at at time zone 'Europe/Rome')::date > today + 13 then
    raise exception 'Bookings open 14 days ahead. Please pick an earlier day.';
  end if;

  loop
    -- Bytes 0-5 of a v4 uuid are random.
    random_bytes := uuid_send(gen_random_uuid());
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, get_byte(random_bytes, i) % 32 + 1, 1);
    end loop;

    begin
      insert into public.bookings (court_id, starts_at, ends_at, guest_name, phone, cancel_code)
      values (p_court_id, p_starts_at, p_starts_at + interval '90 minutes',
              btrim(p_guest_name), btrim(p_phone), code)
      returning id into new_id;
      return new_id;
    exception when unique_violation then
      -- Only a cancel code clash is retried; anything else goes to the page.
      get stacked diagnostics clash = constraint_name;
      if clash <> 'bookings_cancel_code_key' then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.book(smallint, timestamptz, text, text) from public;
grant execute on function public.book(smallint, timestamptz, text, text) to anon, authenticated;

-- Confirmation ------------------------------------------------------------
-- Court, start and cancel code for one booking, by its id (a random uuid).
-- Never returns the guest's name or phone.

create or replace function public.confirmation(p_id uuid)
returns table (court_name text, starts_at timestamptz, cancel_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, b.starts_at, b.cancel_code
  from public.bookings b
  join public.courts c on c.id = b.court_id
  where b.id = p_id;
$$;

revoke execute on function public.confirmation(uuid) from public;
grant execute on function public.confirmation(uuid) to anon, authenticated;
