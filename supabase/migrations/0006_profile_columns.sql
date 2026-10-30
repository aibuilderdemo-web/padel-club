-- Members may change only their name and phone, never their role (or id/created_at).
-- Column-level privilege: a forbidden column is refused before any row/trigger logic runs.
-- The existing profiles_protect_role trigger (migration 0005) stays as the row-level backstop.
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;
