# EPS PILOT V41.6 — Annual Planning Cycle Fix

- Annual planning now uses exactly **two school-year cycles** in the coordinator editor.
- Teacher annual planning now displays exactly the same two cycles.
- Removed the misleading visual concatenation where `Cycle 1` + `0 activities` could appear as `Cycle 10 activities` in RTL.
- Server validation now accepts only cycle 1 or cycle 2 for annual-plan units.
- Preserved teacher assignment, units, no-refresh behavior, mobile/desktop support, and all existing features.
- Removed test SQLite data before packaging.
