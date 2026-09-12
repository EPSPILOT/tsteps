# EPS PILOT V41.3

## Annual Planning Reliability
- Fixed the annual planning workflow so coordinator saves persist the plan, teacher assignment, and units atomically.
- Prevented the no-refresh UI from interrupting a multi-request annual-plan form.
- Added strict validation for teacher, class, institution, cycle, session count, duration, and date range.
- Teacher accounts now receive and can retrieve only their assigned annual plans and units.
- Rollback is automatic if any part of the save fails.

No EPS PILOT Score or gamification was added.
