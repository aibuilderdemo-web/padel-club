-- Members: profiles linked to Supabase Auth, bookings linked to users, RLS from PERMISSIONS.md.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null check (phone ~ '^\+?[0-9 ]{7,15}$'),
  role text not null default 'member' check (role in ('member', 'staff', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Profile created automatically at sign-up. The role is never read from the
-- sign-up data, so nobody can make themselves staff or admin.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Role of the logged-in user. Security definer so policies can ask it
-- without recursing into the profiles policies.
create function current_user_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Only an admin (or the server/SQL editor, where auth.uid() is null) may change a role.
create function profiles_protect_role() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.current_user_role() is distinct from 'admin' then
    raise exception 'Only an admin can change a role';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on profiles
  for each row execute function profiles_protect_role();

-- profiles: a logged-in user can read only their own profile row.
create policy "profiles: read own" on profiles
  for select to authenticated using (id = auth.uid());

-- profiles: staff and admins can read every profile.
create policy "profiles: staff read all" on profiles
  for select to authenticated using (current_user_role() in ('staff', 'admin'));

-- profiles: a user can edit their own row (the trigger above keeps the role fixed).
create policy "profiles: update own" on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- profiles: an admin can edit any profile, including the role.
create policy "profiles: admin update any" on profiles
  for update to authenticated
  using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- bookings: link to the user. Guests keep user_id null.
alter table bookings add column user_id uuid references auth.users (id);
create index bookings_user_id_idx on bookings (user_id);

-- bookings: a logged-in user can read only their own bookings.
create policy "bookings: read own" on bookings
  for select to authenticated using (user_id = auth.uid());

-- bookings: staff and admins can read every booking.
create policy "bookings: staff read all" on bookings
  for select to authenticated using (current_user_role() in ('staff', 'admin'));

-- bookings: a logged-in user can insert a booking only for themselves.
-- (No policy for anon: guests book through the server.)
create policy "bookings: insert own" on bookings
  for insert to authenticated with check (user_id = auth.uid());

-- bookings: a user can cancel their own booking; staff and admins can cancel anyone's.
create policy "bookings: cancel own or staff" on bookings
  for update to authenticated
  using (user_id = auth.uid() or current_user_role() in ('staff', 'admin'))
  with check (user_id = auth.uid() or current_user_role() in ('staff', 'admin'));

-- Cancelling is the only change a logged-in user can make to a booking.
revoke update on bookings from authenticated;
grant update (cancelled_at) on bookings to authenticated;

-- Booking horizon: guests up to 2 days ahead, members up to 7 (Milan dates).
create function bookings_horizon() returns trigger
language plpgsql as $$
declare
  max_days int := case when new.user_id is null then 2 else 7 end;
begin
  if (new.starts_at at time zone 'Europe/Rome')::date
     > (now() at time zone 'Europe/Rome')::date + max_days then
    raise exception 'You can book up to % days ahead%', max_days,
      case when new.user_id is null then ' as a guest. Log in to book up to 7 days ahead' else '' end;
  end if;
  return new;
end;
$$;

create trigger bookings_horizon
  before insert on bookings
  for each row execute function bookings_horizon();
