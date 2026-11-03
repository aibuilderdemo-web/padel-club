-- A short code per member for reports (m_01, m_02, ...): names stay out of cost queries.
alter table profiles add column code text unique;

-- Members as the reports know them: the profile's id and code.
create view members with (security_invoker = true) as
  select id, code, full_name from profiles where role = 'member';
