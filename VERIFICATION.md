# Los Blancos FC — Clean Premium Rebuild Verification

## Scope
- Frontend visual system rebuilt from scratch.
- Existing server.js, db.js, authentication, database queries and API endpoints retained.
- Historical backup frontend files removed from the clean distribution.
- Existing uploaded asset directories retained.

## Checks completed
- `node --check public/js/app.js` — PASS
- `node --check server.js` — PASS
- Every `data-action` in app.js has a matching action handler — PASS
- Lineup slot global-click conflict removed — PASS
- Owner lineup save continues to use `PUT /api/owner/matches/:matchId/lineup` — PASS
- Public match centre now renders a full football-pitch lineup from the existing lineup data — PASS
- Homepage consumes existing `/api/public/home` and `/api/public/stats` data — PASS

## Runtime note
Dependencies are intentionally not bundled. Run `npm.cmd install` before starting locally.

A live database-backed runtime test requires the project's real environment variables and database credentials, so those were not invented or embedded in this build.
