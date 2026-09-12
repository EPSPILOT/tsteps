# EPS PILOT V40.4 — FINAL QA / RELEASE HARDENING

- Removed development-only demo timetable seeding from startup.
- Removed bundled SQLite runtime database and WAL/SHM files from release.
- Blocked public access to runtime data directory as well as database/schema paths.
- Verified fresh database creation on startup.
- Verified root application response and protected static paths.
- Server and frontend syntax checks passed.
- Preserved V40.3 security, EPS Engine, Copilot, Progress, Safety, Terrain, Planning, Reports, Transfer, Audit and Backup features.
- EPS PILOT Score and Gamification remain intentionally excluded.
