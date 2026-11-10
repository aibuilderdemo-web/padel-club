# Grill log

## SPEC.md, 2026-11-10

**Q: Can bookings on the same court overlap?** "Once per slot" with
90-minute bookings every 30 minutes lets 18:00 and 18:30 both be booked.
Recommended: no overlaps, enforced by an exclusion constraint.
**A:** Two bookings on the same court can't overlap. 18:00 blocks starts
from 17:00 to 19:00.

**Q: Is 23:00 the closing time or the last start time?**
Recommended: closing time, so the last start is 21:30.
**A:** Closing time. Last start 21:30.

**Q: Who can see guest names and phones, and how is the staff page
protected before login?** Recommended: the public sees only court and time
(RLS blocks reading bookings); staff view runs on the server with the secret
key behind one shared password until day 17.
**A:** The public sees only court and start time; the staff view runs on the server behind one shared password until day 17.

**Unprompted decisions given during the grill:**
- Guests can cancel with a code from the confirmation.
- Bookings open 14 days ahead, none in the past.
- Four courts, Court 1 to Court 4.

## Accounts slice (briefs/demo1-plan.txt), 2026-11-10

**Q: PERMISSIONS.md says guests book up to 2 days ahead and members 7;
SPEC.md said 14 for everyone. Which does book() enforce?**
Recommended: PERMISSIONS.md, the newer document.
**A:** PERMISSIONS.md: 2 for guests, 7 for members.

**Q: Members may cancel their own booking. Add a Cancel button to My
bookings now, before slice 5?** Recommended: yes, delete own booking before
it starts; guest cancel by code stays in slice 5.
**A:** Yes, delete own.

**Q: Keep Supabase's email confirmation at sign-up?** Recommended: keep it
on, with an /auth/confirm route.
**A:** Keep it on.

**Q: Where do name and phone on a member's booking come from?**
Recommended: prefilled from the profile, editable; every booking still gets
a cancel code.
**A:** Prefilled from the profile.
