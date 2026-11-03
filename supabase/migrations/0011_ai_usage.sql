-- One row per "Ask the club" call: who asked, the model, the tokens, what it cost, how it ended.
create table ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  cost numeric not null,
  duration_ms int not null,
  outcome text not null check (outcome in ('answered', 'fallback'))
);

create index ai_usage_user_created on ai_usage (user_id, created_at);

-- Written by the server with the secret key only. No policies: nobody reads it from the browser.
alter table ai_usage enable row level security;
