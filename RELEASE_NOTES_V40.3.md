EPS PILOT V40.3 — FINAL HARDENING

- EPS Engine workflow retained.
- EPS Copilot, Student Progress, Sport Safety, Smart Planning, Smart Reports, Intelligence dashboards, Mode Terrain, teacher transfer, audit and owner backup retained.
- Protected health documents remain private and authenticated.
- Added security response headers and API rate limiting.
- Password reset no longer returns a temporary password in production responses; development-only local test output remains available when NODE_ENV=development.
- Clean database is generated on first startup; no test records included.
- Generic Node.js hosting package; no provider-specific deployment files.
- EPS PILOT Score and gamification intentionally excluded.
