# EPS PILOT V40.5 — Annual Planning Assignment Fix

## Fixed
- Coordinator-created annual plans are now strictly assigned to the selected teacher.
- Teacher `/api/plans` now returns only plans assigned to that teacher.
- Teacher `/api/units` now returns only units belonging to plans assigned to that teacher.
- The system validates that the selected teacher belongs to the same institution.
- Creating a plan sends an in-app notification to the assigned teacher.
- Reassigning an existing plan sends a notification to the new teacher.
- Teacher planning remains read-only for coordinator-assigned plans.

## QA
- Fresh database startup tested.
- Coordinator created an annual plan assigned to a teacher: assignment confirmed.
- Teacher login returned the assigned plan.
- Unit created under that plan appeared for the assigned teacher.
- Teacher received assignment notification.
- `server.js` and `app.js` syntax checks passed.
- Test database removed before packaging.
