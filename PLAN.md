# Plan

Five tasks, in order, one at a time. After each task: how to check it in the browser.

## Ground rules (from CLAUDE.md)
- Env names: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY. The secret key is server-only.
- Rules that protect data live in the database (constraints, RLS).
- Supabase errors are shown on the page.

## Task 1: Courts and free slots for a date
`courts` (4 seeded rows) and `bookings` tables. `bookings` has no overlap rule yet, that is task 3. Home takes a date (`/?date=YYYY-MM-DD`, default today in Milan). Each court shows its free start times: every half hour, 90-minute booking, Milan time, nothing in the past. A row added by hand in the Table Editor removes that exact start from the court's list (overlap neighbours stay until task 3).

Checks:
- Table Editor shows 4 courts and an empty `bookings` table.
- I add a booking by hand for court 1 at 18:00 tomorrow: 18:00 leaves court 1's list, court 2 is unchanged.
- I open tomorrow: 4 courts, each with its free slots.
- Starts fall on the hour or half hour inside the 8:00 to 23:00 window.
- Today hides slots already past, judged on Milan time.
- A wrong Supabase URL shows the error text on the page.
- With the publishable key, courts can be read but not inserted or deleted.

## Task 2: Book a slot as a guest (name, phone)
Booking page, server action, confirmation page, writing to the `bookings` table from task 1. Slot rules (hour/half hour, 8:00 to 23:00 Milan, not in the past) are CHECKs or a trigger in the database. Overlap is not enforced yet. Home reads taken slots server-side so names and phones are never public.

Checks:
- I book court 1 at 18:00: confirmation page, a row in the Table Editor, 18:00 leaves court 1's free slots.
- Direct SQL inserts with a past start, an 18:15 start, or a 7:30 start fail.
- Empty name or bad phone shows a clear message.

## Task 3: No double booking, refused by the database
First overlap rule in the project: exclusion constraint (`btree_gist`) on court + `tstzrange(start, start + 90 min)`, added as a new migration. Overlaps are refused in the database. The page shows the database error. If rows already overlap from earlier testing, delete them before adding it.

Checks:
- After 18:00 on court 1, starts 17:00 to 19:00 all fail in SQL. 16:30 and 19:30 succeed. Court 2 at 18:00 succeeds.
- Second browser (page opened before the first booking): book court 1 at 18:00, I get an error on the page, no second row.
- Free-slot list hides the 17:00 to 19:00 neighbours of a booking.

## Task 4: Staff page with today's bookings (open for now)
`/staff` lists today's bookings (Milan day): court, time, name, phone, ordered by time. No login (day 17), not linked from guest screens. Temporary: phones are visible to anyone with the URL.

Checks:
- Bookings from tasks 2 and 3 appear, today only, sorted.
- Bookings are not readable with the publishable key (RLS), only through the server.
- The page works without logging in.

## Task 5: Cancel with a code from the confirmation
Booking gets a random `cancel_code` shown on the confirmation page. A cancel page takes the code and cancels. A cancelled booking frees its slot (the exclusion constraint ignores cancelled rows, via a `cancelled_at` column; the row is kept).

Checks:
- Confirmation shows a code. Entering it cancels, and the slot is free again on home.
- A wrong code shows an error and cancels nothing.
- Cancelling twice shows an error. Rebooking the same slot works.
- Staff page no longer shows the cancelled booking.

## Open questions
- Is 23:00 the last start or the end time? Default: booking must end by 23:00, so last start 21:30.
