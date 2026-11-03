-- Total AI cost per member, for the admin page's "AI cost per member" (it takes the median).
-- Read with the secret key only: nobody reads it from the browser.
create view ai_cost_per_member as
  select user_id, count(*) as questions, sum(cost) as total_cost
  from ai_usage
  group by user_id;

revoke all on ai_cost_per_member from anon, authenticated;
