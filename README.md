# Los Blancos FC — New Professional Portal

This is a clean rebuild of the Los Blancos FC website and club portal. It has one public club site plus separate owner and player workspaces, with the major actions exposed as visible buttons and connected to backend routes.

## Main areas

### Public site
- Home
- Squad
- Matches
- Results
- Stats
- News
- Contact
- Public match centre
- Public player profiles

### Owner portal
- Dashboard
- Player Requests with notification badge
- Approve / reject player requests
- Add / edit / delete players
- Add / edit / delete matches
- Match lineup workspace
- Match statistics workspace
- Teams manager
- News manager
- Background & media library
- Activate a new homepage background without editing CSS/server code
- Settings
- Activity log
- Notifications

### Player portal
- Dashboard
- My Profile
- Upload / replace photo directly from computer
- Submit profile changes for owner approval
- My Matches
- My Stats
- My Lineup
- Notifications

## Local setup

1. Copy `.env.example` to `.env`.
2. Put the real Aiven/MySQL details into `.env`.
3. Set `OWNER_EMAIL` and `OWNER_PASSWORD` to the owner account you want created.
4. Run:

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd start
```

5. Open:

```text
http://localhost:3000
```

## Important

The setup script is designed to create the complete schema and add missing columns where the database already exists. It is intentionally run separately from the server so database changes are visible and repeatable.

## Design reference

This release is a clean visual redesign, not a copy of the previous interface. The existing database/API/authentication contract is preserved while the frontend is rebuilt around a new football-editorial visual system.

Highlights:
- Cinematic opening sequence: player → strike → goal → badge → club entry.
- New match-first homepage with an editorial/football-broadcast feel.
- New squad rail with large player photography and profile actions.
- New performance and result presentation.
- New full-pitch public match lineup with player photos, numbers and captain marker.
- Existing owner Lineup Studio remains connected to the real lineup API and database, with drag/drop and position selection.
- Owner/player portals retain their existing backend operations but use the new visual system.
- Responsive layouts are included for desktop and mobile.
- Historical backup frontend files were removed from this clean distribution so the project is easier to maintain.

The redesign intentionally keeps club data and backend functionality as the source of truth rather than copying the old visual layout.

## Free public deployment

Recommended free stack: Render Free for the Node/Express web service, Aiven Free MySQL for the database, and Cloudinary Free for persistent player photos, match backgrounds, logos, and news images. Render Free web services have an ephemeral filesystem, so local uploads are not suitable for persistent production media.

### Render environment variables
Set the values from `.env` in the Render service Environment page. Set `MEDIA_STORAGE=cloudinary` and add your Cloudinary `CLOUDINARY_URL`. Do not commit `.env` to Git.

### Render
Build command: `npm install`
Start command: `npm start`
Plan: `Free`

`render.yaml` is included as a starting Blueprint.
