-- Paid membership, written only by the verified Stripe webhook (service key).
-- Users cannot change these columns: 0006 grants authenticated update on full_name, phone only.
alter table profiles
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column membership_status text;

create index profiles_stripe_subscription_id_idx on profiles (stripe_subscription_id);

-- Processed Stripe event ids, so a repeated delivery is skipped.
-- RLS on with no policies: only the service key can read or write it.
create table stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
alter table stripe_events enable row level security;

-- Booking horizon: 7 days only for logged-in users whose membership is active, otherwise 2.
create or replace function bookings_horizon() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  is_member boolean := false;
  max_days int;
begin
  if new.user_id is not null then
    select p.membership_status in ('active', 'trialing') or p.role in ('staff', 'admin') into is_member
    from public.profiles p where p.id = new.user_id;
  end if;
  max_days := case when coalesce(is_member, false) then 7 else 2 end;
  if (new.starts_at at time zone 'Europe/Rome')::date
     > (now() at time zone 'Europe/Rome')::date + max_days then
    raise exception 'You can book up to % days ahead%', max_days,
      case
        when new.user_id is null then ' as a guest. Log in and become a member to book up to 7 days ahead'
        when max_days = 2 then ' without an active membership. Become a member to book up to 7 days ahead'
        else ''
      end;
  end if;
  return new;
end;
$$;
