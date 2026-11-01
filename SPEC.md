**Steps**
1. Log in as member@test.com
2. Go to /book, pick tomorrow, court 2, 18:00
3. Click "Book"

**Expected**: confirmation page, booking in "My bookings".
**Actual**: nothing happens. Every time.
**Where**: bugs-demo, local and live, Chrome. Guests can book.
**Evidence**: Network: no request sent.  Console:
# Padel Club Navigli: booking app

## Problem
Bookings come by WhatsApp and phone. Courts get double booked, and the owner
answers messages at night.

## Users
Guests (no account), members and staff. Members and login: day 17.

## User stories
- As a guest, I want to see which courts are free on Saturday, so that I can book one.
- As a guest, I want to book without an account, so that I can try the club.
- As staff, I want all of today's bookings on one page, so that I can prepare the courts.

## Screens
Home with today's courts, booking page, confirmation, staff view.

## Data
courts (name), bookings (court, start time, guest name, phone)

## Rules
- A court can be booked only once per slot.
- A booking lasts 90 minutes and starts on the hour or half hour.
- Slots from 8:00 to 23:00, Milan time. Nobody can book in the past.
- Two bookings on the same court can't overlap. A booking at 18:00 blocks starts from 17:00 to 19:00.

## Out of scope
Payments beyond Stripe Checkout and its webhook (/api/stripe/webhook sets the membership status), login (day 17), tournaments, coaching, an app store app.

## Acceptance checks
- I open tomorrow. I see 4 courts and their free slots.
- I book court 1 at 18:00. It leaves the free slots. A row appears in the Table Editor.
- In a second browser I book court 1 at 18:00. I get an error. No second row.
