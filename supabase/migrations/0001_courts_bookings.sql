create table courts (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table bookings (
  id bigint generated always as identity primary key,
  court_id bigint not null references courts (id),
  starts_at timestamptz not null,
  guest_name text not null check (length(trim(guest_name)) > 0),
  phone text not null check (length(trim(phone)) > 0),
  created_at timestamptz not null default now()
);

alter table courts enable row level security;
alter table bookings enable row level security;

-- Anyone can read courts. Nobody but the secret key can write them.
create policy "courts are readable" on courts
  for select to anon, authenticated using (true);

-- bookings: no policies on purpose. Only server code with the secret key can use it.

insert into courts (name) values ('Court 1'), ('Court 2'), ('Court 3'), ('Court 4');
