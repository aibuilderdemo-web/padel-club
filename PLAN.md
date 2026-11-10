# Plan

Five slices. Each one works end to end, from database to phone screen.
After each slice: how to check it in the browser, how to check it at phone
size against the Look section, a tick here, one line on what's done and
what's left.

## [x] 1. Courts and free slots for a date
Done: schema.sql, lib/booking.ts, home page with days and free times; left: your check against Supabase (I couldn't reach it from here).
supabase/schema.sql with the courts and bookings tables and a free_slots(day)
function. No rule against overlapping bookings yet: that's task 3.
Home page: 14 day links (today + 13, Milan time), 4 courts with their free
start times for the chosen day.
Checks:
- I paste supabase/schema.sql into the SQL Editor and run it twice. No errors.
- Table Editor shows Court 1 to Court 4.
- I open the home page: today, 4 courts, no starts in the past.
- I pick tomorrow: 4 courts, each with starts 8:00 to 21:30.
- I insert a booking in the SQL Editor for Court 1 tomorrow at 18:00.
  Court 1 no longer shows 17:00 to 19:00. 16:30 and 19:30 remain.
- A booking at 18:15 or 22:00 is refused by the database.
- A second booking for Court 1 tomorrow at 18:30 is still accepted. Task 3
  stops that.
- With the publishable key I cannot read the bookings table.

## [x] 2. Book a slot as a guest (name, phone)
Done: book() and confirmation() in the database, booking page, confirmation with code; left: your check against Supabase, and task 3 still allows double booking.
Tap a free time, enter name and phone, get a confirmation page with court,
day, time and a 6-character cancel code.
Checks:
- I book Court 1 tomorrow at 18:00. I see the confirmation and the code.
  The slot leaves the free list. A row appears in the Table Editor.
- Empty name or phone shows an error on the page.
- A start in the past, or more than 13 days ahead, is refused by the database.

## [x] 3. No double booking, refused by the database
Done: bookings_no_overlap exclusion constraint, book() turns it into a friendly message; left: your check against Supabase.
An exclusion constraint on bookings: two bookings on the same court can't
overlap.
Checks:
- In a second browser, with the page opened before the first booking, I book
  Court 1 tomorrow at 18:00. I get an error on the page. No second row.
- Same with 18:30 or 17:00 on Court 1: refused. 18:00 on Court 2: works.
- An insert in the SQL Editor that overlaps is refused too.

## [x] 4. Staff page with today's bookings (staff and admin only)
Done (briefs/staff-fix.txt, after slice 6): /staff redirects anyone who isn't staff or admin to the home page on the server, and reads as the logged-in user so RLS "Staff read every booking" applies, with no secret key and no shared password; left: your check against Supabase.
/staff lists today's bookings (Milan time) by court and time, with name and
phone. Read on the server with the secret key. No password yet.
Checks:
- I open /staff. I see today's bookings, sorted by court and time.
- A day with no bookings says so.
- The page source and network tab never contain the secret key.
Follow-up: SPEC.md wants one shared password until day 17. Until then
anyone with the URL sees names and phones.

## [ ] 5. Cancel with a code from the confirmation
On the booking page, a field for the cancel code.
Checks:
- I enter the code from my confirmation. The booking is gone from the Table
  Editor and /staff, and the slot is free again.
- A wrong code shows an error. Nothing changes.
- A code for a booking that has already started is refused.

## [x] 6. Accounts: sign-up, log-in, My bookings, RLS
Done: profiles + sign-up trigger, roles, 2/7-day window in book() and free_slots, RLS from PERMISSIONS.md, /signup, /login, /auth/confirm, /my-bookings with cancel; left: your check against Supabase and the two dashboard settings, the staff page (slice 4) and guest cancel by code (slice 5).
Built before slices 4 and 5 (briefs/demo1-plan.txt). Email and password
with Supabase Auth, email confirmation on. A profiles row (full_name, phone,
role, default member) is made at sign-up. Bookings made while logged in are
linked to the user. Guests book up to 2 days ahead, members 7.
Checks:
- I paste supabase/schema.sql into the SQL Editor and run it twice. No errors.
- Supabase → Authentication → URL Configuration: Site URL is the app's URL.
  Emails → Confirm signup: the link is
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
- I sign up, click the email link, land on My bookings logged in. The
  profiles table has my row with role member.
- Logged out the home page shows today + 2 days; logged in, today + 7.
- Logged in, the booking form has my name and phone. The booking shows in
  My bookings and has my user_id in the Table Editor.
- Cancel in My bookings: the row is gone, the slot is free again.
- As a member I can't read others' bookings, can't change my role, can't
  delete someone else's booking. Staff see every booking. Only an admin can
  call set_role.

## [x] 7. Members edit their name and phone
Done: /profile (logged-in only, checked on the server in page and action), link from My bookings, RLS from slice 6 limits it to own name and phone; left: your check against Supabase.
Changes the profile only. Bookings already made keep the name and phone
they were booked with; new bookings are prefilled with the new details.
Checks:
- Logged out, /profile sends me to log in.
- I change my name and phone, press Save, see "Saved." The profiles row
  changes in the Table Editor. The booking form shows the new details.
- An empty name or phone shows an error on the page. Nothing changes.

## [x] 8. Become a member: Stripe Checkout
Done (briefs/checkout-prompt.txt): lib/membership.ts startCheckout(), "Become a member" box on /my-bookings (login checked in the server action), Stripe Checkout in subscription mode linked by user id, /membership/success and /membership/cancel; left: your check with Stripe test keys, and switching the membership on after payment (webhook).
A logged-in user presses "Become a member" on My bookings. The server makes
a Stripe Checkout Session (subscription, STRIPE_PRICE_ID) with
client_reference_id and metadata user_id = the user's id, and sends them to
Stripe. STRIPE_SECRET_KEY is read on the server only. The success page
doesn't change the membership yet.
Checks:
- .env.local and Vercel have STRIPE_SECRET_KEY (sk_test_…) and
  STRIPE_PRICE_ID (price_… of a recurring price). Restart npm run dev.
- Logged out, /my-bookings, /membership/success and /membership/cancel send
  me to log in.
- Logged in, I press "Become a member" and land on Stripe with the price.
  I pay with 4242 4242 4242 4242 and land on the success page.
- In the Stripe dashboard the session has my user id as client reference.
- Going back from Stripe lands on the cancel page. Nothing charged.
- With STRIPE_PRICE_ID wrong, the error shows under the button.
- The page source and network tab never contain the secret key.

## [x] 9. The success page makes the user a paid member
Done: profiles.paid_member + Stripe ids in schema.sql (users can't write them), confirmCheckout() checks the session with Stripe (this user, our price, complete and paid) and sets them with the secret key, "You are a member" on My bookings instead of the button, a second checkout refused; left: your check with Stripe test keys, and ending the membership when the subscription is cancelled or a payment fails (needs a Stripe webhook).
Checks:
- I paste supabase/schema.sql into the SQL Editor and run it twice. No errors.
  profiles has paid_member (false), stripe_customer_id, stripe_subscription_id.
- I pay with 4242 4242 4242 4242. The success page says I'm a member. In the
  Table Editor my row has paid_member true and both Stripe ids.
- My bookings shows "You are a member", no button.
- Reloading the success page changes nothing and shows no error.
- /membership/success with no session_id, or with someone else's, shows an
  error and changes nothing.
- From the browser with the publishable key, an update of my paid_member is
  refused.
Replaced by slice 10: the success page no longer switches the membership on;
paid_member became membership_status, written by the webhook.

## [x] 10. Stripe webhook switches the membership on and off
Done (briefs/webhook-prompt.txt): /api/stripe/webhook checks the signature, handles checkout.session.completed and customer.subscription.updated/deleted, saves customer id, subscription id and status through apply_stripe_event() (one transaction, stripe_events skips duplicates); success page only says "active in a moment"; 7-day window for active/trialing members, staff and admins, 2 for everyone else; left: your check with the Stripe CLI and test keys, and the webhook endpoint in the Stripe dashboard for Vercel.
Decisions: staff and admins keep 7 days without paying; active means Stripe
status active or trialing (past_due ends the 7 days at once).
Checks:
- I paste supabase/schema.sql into the SQL Editor and run it twice. No errors.
  profiles has membership_status and no paid_member. stripe_events exists.
- `stripe listen --forward-to localhost:3000/api/stripe/webhook`. I put the
  whsec_… it prints into .env.local as STRIPE_WEBHOOK_SECRET and restart
  npm run dev.
- Logged in without a membership: the home page shows today + 2 and
  "Become a member". I pay with 4242 4242 4242 4242. The success page says
  "active in a moment". The stripe listen window shows 200s. My row has
  membership_status active and both Stripe ids. My bookings says "You are a
  member". The home page shows today + 7.
- `stripe events resend evt_…` for the checkout event: the response says
  "duplicate, skipped", and stripe_events still has one row for it.
- `curl -X POST localhost:3000/api/stripe/webhook -d '{}'` gets a 400. Nothing
  changes.
- I cancel the subscription in the Stripe dashboard (immediately): status
  becomes canceled, the "Become a member" button is back, the home page shows
  today + 2, and booking day +5 is refused with the new message.
- A staff or admin account without a membership still sees today + 7.
- With the publishable key, rpc('apply_stripe_event') is refused and
  stripe_events can't be read.
- Vercel: STRIPE_WEBHOOK_SECRET from a Stripe dashboard endpoint at
  https://<site>/api/stripe/webhook with the three events above. Redeploy.

## Open questions (ask before the slice)
- Slice 2: are bookings written by a database function called with the
  publishable key (rules stay in the database), or by the server with the
  secret key? Recommended: database function.
- Slice 4: add the shared password from SPEC.md now, or keep it open?
- Slice 5: does cancelling delete the row or mark it cancelled?
  Recommended: delete.
