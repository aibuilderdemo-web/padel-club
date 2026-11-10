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

-- Profiles and roles ------------------------------------------------------
-- One row per account, made by a trigger at sign-up. Roles from
-- PERMISSIONS.md: member (default), staff, admin. A guest has no profile.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),

  constraint profiles_role_known
    check (role in ('member', 'staff', 'admin')),
  constraint profiles_full_name_not_blank
    check (btrim(full_name) <> ''),
  constraint profiles_phone_not_blank
    check (btrim(phone) <> '')
);

alter table public.profiles enable row level security;

-- Users can change only their name and phone. The role column can't be
-- written from the client at all; only set_role() changes it.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- Makes the profile when someone signs up. Name and phone come from the
-- sign-up form; the role is always the default, whatever the form sends.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    btrim(coalesce(new.raw_user_meta_data ->> 'phone', ''))
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The logged-in user's role, or null for a guest. Security definer so
-- policies can call it without going through the profiles policies again.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.my_role() from public, anon, authenticated;
grant execute on function public.my_role() to anon, authenticated;

-- Policy: a logged-in user can read only their own profile.
drop policy if exists "Users read their own profile" on public.profiles;
create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Policy: an admin can read every profile, to find whose role to change.
drop policy if exists "Admins read every profile" on public.profiles;
create policy "Admins read every profile"
  on public.profiles for select
  to authenticated
  using ((select public.my_role()) = 'admin');

-- Policy: a logged-in user can update their own row; the column grants
-- above limit that to full_name and phone.
drop policy if exists "Users update their own name and phone" on public.profiles;
create policy "Users update their own name and phone"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policies: the trigger makes profiles, nobody removes one.

-- Paid membership (Stripe subscription), separate from the role. Only the
-- Stripe webhook writes these, through apply_stripe_event() below: the
-- column grants above give users no way to write them.
-- membership_status is Stripe's subscription status; null = never paid.
-- Active means 'active' or 'trialing'.
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists membership_status text;

-- Slice 9 kept a paid_member flag; the status replaces it.
alter table public.profiles drop constraint if exists profiles_paid_member_has_subscription;
alter table public.profiles drop column if exists paid_member;

alter table public.profiles drop constraint if exists profiles_membership_status_known;
alter table public.profiles add constraint profiles_membership_status_known
  check (membership_status in ('active', 'trialing', 'past_due', 'unpaid', 'canceled',
                               'incomplete', 'incomplete_expired', 'paused'));
alter table public.profiles drop constraint if exists profiles_membership_status_has_subscription;
alter table public.profiles add constraint profiles_membership_status_has_subscription
  check (membership_status is null or stripe_subscription_id is not null);

create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id);

-- Stripe events already handled, so a resent event changes nothing twice.
-- Nobody reads or writes it from the browser.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- Applies one verified Stripe event, once. Called only by the webhook on the
-- server with the secret key. Returns false for an event already handled.
-- One transaction: if the profile update fails, the event isn't recorded
-- either, and Stripe sends it again.
create or replace function public.apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_status text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.stripe_events (id, type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  if not found then
    return false;
  end if;

  if p_event_type = 'checkout.session.completed' then
    update public.profiles
    set stripe_customer_id = p_customer_id,
        stripe_subscription_id = p_subscription_id,
        membership_status = p_status
    where id = p_user_id;
    if not found then
      raise exception 'There is no profile for user %.', p_user_id;
    end if;
  elsif p_event_type in ('customer.subscription.updated', 'customer.subscription.deleted') then
    -- Only the user's current subscription: events for an older one change nothing.
    update public.profiles
    set membership_status = p_status
    where id = p_user_id and stripe_subscription_id = p_subscription_id;
  else
    raise exception 'Unknown Stripe event type %.', p_event_type;
  end if;

  return true;
end;
$$;

revoke execute on function public.apply_stripe_event(text, text, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_event(text, text, uuid, text, text, text)
  to service_role;

-- How many days after today someone may book (PERMISSIONS.md): 7 for staff,
-- admins, and users with an active paid membership; 2 for everyone else,
-- guests included. book() and free_slots() both use it.
create or replace function public.booking_days_ahead()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('staff', 'admin') or p.membership_status in ('active', 'trialing'))
  ) then 7 else 2 end;
$$;

revoke execute on function public.booking_days_ahead() from public, anon, authenticated;
grant execute on function public.booking_days_ahead() to anon, authenticated;

-- Change someone's role: admins only. In the SQL Editor (no logged-in user)
-- this refuses too; make the first admin with a plain UPDATE there.
create or replace function public.set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.my_role() is distinct from 'admin' then
    raise exception 'Only an admin can change roles.'
      using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'There is no account with that id.';
  end if;
end;
$$;

revoke execute on function public.set_role(uuid, text) from public, anon, authenticated;
grant execute on function public.set_role(uuid, text) to authenticated;

-- Bookings ----------------------------------------------------------------
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

-- No overlap: two bookings on the same court can't share any minute.
-- Ranges are [start, end), so an 18:00 booking blocks starts from 17:00 to
-- 19:00, while 16:30 and 19:30 still fit. Dropped and added again so the
-- file stays safe to rerun; adding fails if overlapping rows already exist.
create extension if not exists btree_gist with schema extensions;

alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (court_id with =, tstzrange(starts_at, ends_at) with &&);

-- The account that made the booking; null for a guest booking.
alter table public.bookings
  add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists bookings_user_id_idx on public.bookings (user_id);

-- RLS on. Guests can't read or write bookings at all. Logged-in users may
-- select and delete, and the policies below pick which rows. Nobody inserts
-- or updates directly: book() is the only way in, and it sets user_id itself.
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select, delete on public.bookings to authenticated;

-- Policy: a logged-in user can read their own bookings.
drop policy if exists "Members read their own bookings" on public.bookings;
create policy "Members read their own bookings"
  on public.bookings for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Policy: staff and admins can read every booking, with name and phone.
drop policy if exists "Staff read every booking" on public.bookings;
create policy "Staff read every booking"
  on public.bookings for select
  to authenticated
  using ((select public.my_role()) in ('staff', 'admin'));

-- Policy: a logged-in user can cancel their own booking until it starts.
drop policy if exists "Members cancel their own bookings before they start" on public.bookings;
create policy "Members cancel their own bookings before they start"
  on public.bookings for delete
  to authenticated
  using (user_id = (select auth.uid()) and starts_at > now());

-- Policy: staff and admins can cancel any booking.
drop policy if exists "Staff cancel any booking" on public.bookings;
create policy "Staff cancel any booking"
  on public.bookings for delete
  to authenticated
  using ((select public.my_role()) in ('staff', 'admin'));

-- Free slots --------------------------------------------------------------
-- Every start from 8:00 to 21:30 Milan time on for_day, per court, that is
-- not past and does not overlap a booking. Returns only court and time.
-- Empty for days after today + booking_days_ahead() (Milan time): 2, or 7
-- for staff, admins and paid members.

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
                    and (now() at time zone 'Europe/Rome')::date + public.booking_days_ahead()
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
-- The only way anyone writes a booking. Refuses past starts and days beyond
-- today + booking_days_ahead() (Milan time); the table's checks do the rest.
-- Links the booking to the logged-in user, if any. Makes the 6-character
-- cancel code and returns the new booking's id.

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
  if (p_starts_at at time zone 'Europe/Rome')::date > today + public.booking_days_ahead() then
    if auth.uid() is null then
      raise exception 'Guests can book up to 2 days ahead. Log in to book up to 7 days ahead.';
    end if;
    if public.booking_days_ahead() = 2 then
      raise exception 'Members with an active membership can book up to 7 days ahead. Become a member on My bookings.';
    end if;
    raise exception 'You can book up to 7 days ahead. Please pick an earlier day.';
  end if;

  loop
    -- Bytes 0-5 of a v4 uuid are random.
    random_bytes := uuid_send(gen_random_uuid());
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, get_byte(random_bytes, i) % 32 + 1, 1);
    end loop;

    begin
      insert into public.bookings (court_id, starts_at, ends_at, guest_name, phone, cancel_code, user_id)
      values (p_court_id, p_starts_at, p_starts_at + interval '90 minutes',
              btrim(p_guest_name), btrim(p_phone), code, auth.uid())
      returning id into new_id;
      return new_id;
    exception
    when exclusion_violation then
      raise exception using
        errcode = 'exclusion_violation',
        message = 'Sorry, someone has just booked this court at that time. Please pick another time.';
    when unique_violation then
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
