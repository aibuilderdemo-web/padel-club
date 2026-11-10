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

## [ ] 3. No double booking, refused by the database
An exclusion constraint on bookings: two bookings on the same court can't
overlap.
Checks:
- In a second browser, with the page opened before the first booking, I book
  Court 1 tomorrow at 18:00. I get an error on the page. No second row.
- Same with 18:30 or 17:00 on Court 1: refused. 18:00 on Court 2: works.
- An insert in the SQL Editor that overlaps is refused too.

## [ ] 4. Staff page with today's bookings (open for now)
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

## Open questions (ask before the slice)
- Slice 2: are bookings written by a database function called with the
  publishable key (rules stay in the database), or by the server with the
  secret key? Recommended: database function.
- Slice 4: add the shared password from SPEC.md now, or keep it open?
- Slice 5: does cancelling delete the row or mark it cancelled?
  Recommended: delete.
