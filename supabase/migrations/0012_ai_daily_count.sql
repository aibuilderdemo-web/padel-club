-- Questions per member per club day (Europe/Rome), for the daily limit on "Ask the club".
create table ai_daily_count (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  n int not null,
  primary key (user_id, day)
);

-- Written by the server with the secret key only. No policies: nobody reads it from the browser.
alter table ai_daily_count enable row level security;

-- Counts one question and returns the new total, in one statement,
-- so two requests at the same moment can't both get the same number.
create function ai_count_question(p_user uuid) returns int
language sql
security definer
set search_path = public
as $$
  insert into ai_daily_count (user_id, day, n)
  values (p_user, (now() at time zone 'Europe/Rome')::date, 1)
  on conflict (user_id, day) do update set n = ai_daily_count.n + 1
  returning n;
$$;

revoke execute on function ai_count_question(uuid) from public, anon, authenticated;
grant execute on function ai_count_question(uuid) to service_role;
