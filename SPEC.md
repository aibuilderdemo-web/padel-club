# Padel Club Navigli: booking app

## Problem
Bookings come by WhatsApp and phone. Courts get double booked, and the owner
answers messages at night.

## Users
Guests (no account), members, staff and admins. Who may do what:
PERMISSIONS.md. Members sign up with email and password.

## User stories
- As a guest, I want to see which courts are free on Saturday, so that I can book one.
- As a guest, I want to book without an account, so that I can try the club.
- As staff, I want all of today's bookings on one page, so that I can prepare the courts.
- As a guest, I want to cancel with the code from my confirmation, so that I can free the court.

## Screens
Home with today's courts, booking page, confirmation, staff view.

## Look
- Who: players on their phone, the evening before a game.
- Feels like: a local club's site. Big court photos, one plain Book button.
- Colours: club green for buttons and links. The rest white, grey and black.
- Type: one heading font, one text font, readable without zooming.
- It must not look like: a bank, a template, a startup page with gradients.

## Data
courts (name), bookings (court, start time, guest name, phone, cancel code,
user if logged in), profiles (full name, phone, role: member, staff or admin;
made at sign-up, default member)

Four courts: Court 1, Court 2, Court 3, Court 4.

## Rules
- A booking lasts 90 minutes and starts on the hour or half hour.
- Two bookings on the same court can't overlap. A booking at 18:00 blocks
  starts from 17:00 to 19:00 on that court. The database enforces this.
- The club closes at 23:00, Milan time. Starts run from 8:00 to 21:30.
- Up to 7 days ahead (today + 7): members with an active paid membership,
  staff and admins. Everyone else, guests and logged-in users without a
  membership, books up to 2 days ahead (today + 2). Milan time. Nobody can
  book in the past. The database enforces this.
- A member sees their bookings on My bookings and can cancel one until it
  starts.
- A guest cancels with the code shown on the confirmation page.
- The public sees only court and start time. Names, phones and cancel codes
  stay on the server (RLS blocks public reads of bookings). The staff view runs
  on the server with the secret key behind one shared password until day 17.
- Cancel code: 6 characters, shown on the confirmation page. A guest can cancel
  until the booking starts and enters the code on the booking page.

## Decisions
- Photos: none yet. Each court shows a plain grey block with its name; real photos come later in public/courts/.
- SQL: one file, supabase/schema.sql, that I paste into the Supabase SQL Editor. No migrations tool, no CLI.
- Booking window: PERMISSIONS.md wins over the old 14 days for everyone.
- Sign-up needs email confirmation (link to /auth/confirm).
- A member's booking form is prefilled from their profile and can be edited.
- Language: the whole site is in English.
- Paid membership: a Stripe subscription (STRIPE_PRICE_ID), separate from the
  "member" role every account gets at sign-up. Logged-in users start it with
  "Become a member" on My bookings. A Stripe webhook (/api/stripe/webhook,
  signature checked with STRIPE_WEBHOOK_SECRET) saves the Stripe customer id,
  subscription id and status in profiles. Each event is applied once
  (stripe_events). Active means status active or trialing; past_due, unpaid
  or canceled are not. The success page only says the membership will be
  active in a moment. Active members see "You are a member" instead of the
  button and book 7 days ahead.

## Out of scope
Payments for bookings, tournaments, coaching, an app store app.

## Acceptance checks
- I open tomorrow. I see 4 courts and their free slots.
- I book court 1 at 18:00. It leaves the free slots. A row appears in the Table Editor.
- In a second browser I book court 1 at 18:00. I get an error. No second row.
