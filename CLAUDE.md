# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"여행 로그" — a Korean trip planner (itinerary by day, map route, checklist, reservations, expenses) shared by the site owner and invited companions. Plain ES modules with **no bundler, no framework, no build step for the web**: GitHub Pages serves the app files as-is, and **pushing to `main` deploys the website once CI passes** (lint, unit, rules and browser tests gate the `deploy` job in `.github/workflows/test.yml`). Backend is Firebase (Firestore + Google sign-in, free Spark plan); maps are Google Maps Platform (a separate Cloud project). The Android app wraps the same web code with Capacitor 8.

`README.md` (structure, ops) and `docs/data-model.md` (Firestore schema) are the authoritative docs, both in Korean. Read them before changing data or deployment behavior.

Everything in the repo is written in Korean: code comments, UI copy (friendly 해요체), test names, commit messages. Keep new text in Korean. Commits follow `type(scope): 한국어 요약` (feat/fix/perf/refactor/design/docs/ci/test), with a bullet body describing the user-visible behavior. See `git log` for examples.

## Commands

```bash
npm test                                                     # unit tests (node --test "tests/**/*.test.js"), no npm install needed
npm run lint                                                 # ESLint (mistake-catching rules only, no formatting)
npm run test:ui                                              # browser smoke tests on harness/ (playwright-core + installed Chrome/Edge, no network)
node --test tests/dates.test.js                              # one file
node --test --test-name-pattern="addDays" tests/dates.test.js  # one test by name
npm run test:rules        # Firestore rules tests on the emulator (needs npm install + Java 21; project demo-travel-log, port 8181)
npm run serve             # http://localhost:8080/ (also .claude/launch.json "travel-log"); sign-in works only for invited accounts
npm run sw:precache       # regenerate PRECACHE in sw.js after adding/removing any file under js/
npm run deploy:rules      # publish firestore.rules (manual; first run `npx firebase login`)
npm run cap:sync          # build dist/ (scripts/build-web.js) and sync into android/
node scripts/make-icons.js  # regenerate icons/ from favicon.svg
```

Run tests from the repo root; several of them read files by cwd-relative paths. CI (`.github/workflows/test.yml`) runs lint, `npm test`, `npm run test:rules` and `npm run test:ui` on every push to any branch, and **deploys the site only when all of them pass on `main`** (`deploy` job, `scripts/build-site.js` copies just the app files; Pages source must be "GitHub Actions"). Rules tests need Java 21 locally; if it is missing they only run in CI. Android releases are built by CI when a `vX.Y.Z` tag is pushed (`android-release.yml`, signing in `docs/android-signing.md`).

## Architecture

**Boot and routing.** `index.html` → `js/app.js` picks a screen from the auth state (login / not invited / app) → `js/router.js` does hash routing (`#/`, `#/trip/:id/:tab[/:placeId|:reservationId]`, `#/share`, `#/admin`) → `js/views/*.js`. Top-level views export `render(container, route)` and return a cleanup function, which the router calls before it swaps views. `views/trip.js` mounts the tab views (planner, checklist, reservations, expenses) via `mount(content, ctx)` with the same cleanup contract. The DOM is built by hand with `el(tag, attrs, ...children)` from `js/ui.js`. Dialogs and sheets register on the `overlays` stack so the Android back button closes the topmost one first.

**Views redraw in sections.** Views rebuild DOM on every snapshot, so anything that must survive a redraw lives in state, not in elements. The planner panel is three independently drawn parts (Day tabs, the day's timeline, the pool) so tab scroll position and focus are not lost; the minute timer only refreshes the today banner. The place sheet is `views/place-sheet.js` (read-first view, edit form, save, dialog semantics with `#app` set `inert`) plus `views/place-location.js` (search and link parsing), `views/place-photos.js`, and `js/sheet-swipe.js` (swipe-to-close, reusable).

**Pure logic lives in `js/lib/`.** Modules there have no DOM, Firebase, or network access, and they are what the unit tests import. Most other modules can't load in Node because they import Firebase from https CDN URLs (`js/firebase-sdk.js`) or touch the DOM. Put any logic that needs tests into `js/lib/`.

**Data access.** All Firestore reads and writes go through `js/db.js`. Writes go through `save()` → `settleSoon` (`lib/settle.js`), which waits only 1 s for the server to acknowledge, so the UI doesn't hang offline. Failures that surface later reach `onLateWriteError` (a toast in `app.js`). Reads needed before a write fall back to the local cache (`preferWithin`). Firestore uses the persistent multi-tab cache (`js/firebase.js`). The Firebase SDK version is set only in `js/firebase-sdk.js`. The Android build vendors those URLs into `dist/vendor/firebase/`.

**Editing shared documents.** Companions edit the same trip at once, so edit forms (place sheet, reservation, expense) save only the fields the user changed since the form opened (`lib/changes.js` `changedFields`), never the whole snapshot. Checklist "각자" items (`personal: true`) toggle only the caller's entry in `doneBy` with `arrayUnion`/`arrayRemove` (`db.setMyCheck`, `lib/checklist.js`).

**Photos.** Each photo is two documents with the same id: `photos/{id}` (1280px original) and `thumbs/{id}` (240px). The place sheet listens to thumbnails only and fetches the original on tap (`views/place-photos.js`); photos without a thumbnail get one the first time the sheet opens online.

**Deleting.** Deleting a place, Day or reservation first reads its photos/thumbs/files. If that read came from the local cache (offline or slow), anything not cached stays on the server, so the delete is recorded in `localStorage` (`tl.cleanup`, `lib/cleanup.js`) and `db.sweepCleanups()` finishes it from the server on next start or when the device comes back online. `deleteTrip` reads from the server only.

**Security rules are a field whitelist.** `firestore.rules` checks every document with `hasOnly([...])` plus size and length caps. If you write a new field anywhere, update the matching rule, `tests-rules/firestore.rules.test.js`, and `docs/data-model.md`, then run `npm run deploy:rules`. Without that, the write fails with `permission-denied`. Photos and reservation files are stored as `Bytes` inside Firestore documents (no Cloud Storage), so the 1 MiB document limit applies, and size caps are enforced in both the rules and the app (`js/photo.js`, `FILE_MAX_BYTES`).

**Permissions.**
- The site owner is `OWNER_UID`. It appears in `js/firebase-config.js` and is hardcoded in the rules' `isSiteOwner()`.
- Invited accounts live in `allowedUsers/{email}`. The `canCreate` flag lets an account create trips.
- Trip access comes from `ownerUid` and `memberEmails`.
- The admin view (`#/admin`, `views/admin.js`) lets the site owner manage every trip without being a member.
- Permission helpers are in `lib/members.js` (`canManageTrip`, `isAdminViewing`, …).

**Native (Android).** All Capacitor access goes through `js/native.js`, and every call is a no-op on the web. The Java side is in `android/app/src/main/java/io/github/y1kk3love/travellog/`: `ShareActivity`, plus `SharePlugin` with share intents, `resolveLink` for short Google Maps links, and `shareText`. The Capacitor SystemBars plugin provides system-bar and keyboard insets, so never add `viewport-fit=cover` to `index.html` and never set insets in `MainActivity` (tests enforce both). To block old APKs after a breaking data change, bump `minAppVersion` in `app-config.json`. The app reads that file from GitHub Pages.

**PWA / service worker (`sw.js`).** It precaches every file under `js/` at install time. Same-origin requests are revalidated (`no-cache`) and fall back to the cache after `NETWORK_WAIT_MS`. CDN requests are cache-first. Firestore and API traffic is never touched, and query strings are stripped from cache keys. The PRECACHE list must match the actual files; `npm run sw:precache` fixes it.

**Startup guard (`js/boot-guard.js`).** A classic (non-module) script loaded before `js/app.js`. For about a minute after a deploy the CDN can serve a mix of new and old modules, which breaks the whole module graph and leaves the page on "불러오는 중…". The guard reloads once when the app fails to start (`window.__tlBooted` is set at the top of `app.js`), and shows a "다시 열기" message instead of looping if it fails again within a minute. Keep it free of `import`/`export` so it runs even when the module graph is broken.

**External services.**
- Google Maps: `js/gmaps.js` is the loader (quarterly channel) and `js/map.js` draws the map (AdvancedMarkerElement, needs `MAPS_MAP_ID`). Place search uses Places API New autocomplete; the picked place's location and address come from the Maps JS `Geocoder` by place ID (`js/places.js`), not Place Details, because Geocoding has a single pricing tier and can safely get a 320/day cap. Search decisions (when to query, Google vs OpenStreetMap, the per-sheet result cache) live in `lib/place-search.js`. The app does not call the Routes API: the map joins places with dashed straight lines, leg times are straight-line estimates (`lib/geo.js`, `lib/timeline.js`), and real walking directions open in Google Maps via the itinerary's "길찾기" link, which is free. `tests/google-api.test.js` fails if `routes.googleapis.com` comes back.
- Maps quotas: the console sets tight daily quotas, and unused Maps methods are set to 0. Don't add new Maps API methods without considering cost. When the Google quota runs out, search falls back to Nominatim (`js/geocode.js`), but only on Enter or the button: Nominatim's usage policy forbids search-as-you-type.
- Weather: Open-Meteo, only for dates within 15 days.
- Short `maps.app.goo.gl` links: the app follows them natively. The web follows them through `relay/maps-link.gs`, an Apps Script that has to be redeployed by hand in the Apps Script editor (new version, same URL).

## Tests that guard repo-wide rules

Besides the `js/lib` unit tests, several tests check source files statically. If one fails, its assertion message explains the rule:
- `css.test.js`: design tokens (`--bg #F2F2F7`, accent `#0A6CFF`). Font sizes must use `--fs-*` tokens, radii `--radius-*` (or `999px`/`50%`), and padding/gap values must be even px. "Add" buttons use `.btn-tint`; tab pages start with `tabHead()` from `ui.js`. Dark mode only overrides `:root` tokens, so no light-only colors may be hard-coded outside `:root`. Use `var(--inverse)`, not `var(--ink)`, for dark surfaces. Motion must respect `prefers-reduced-motion`.
- `sw.test.js`: the precache list must match the files.
- `harness.test.js`: `harness/fake-db.js` (and fake auth/firebase) must export every name the real module exports, and may contain only `@example.com` addresses. `harness/` serves the real view code with fake data at `/harness/` for manual checks and for `tests-ui/`; it is not deployed.
- `android-config.test.js`: system-bar and inset setup.
- `ci.test.js`: workflow secrets are passed only via `env:`, third-party actions are pinned to commit SHAs, and the Pages deploy job depends on the test jobs and uploads only `SITE_FILES` (`scripts/build-site.js`).
- `build-web.test.js`: vendoring of Firebase and fonts.

## Design history

`docs/superpowers/specs/` and `docs/superpowers/plans/` hold the original design specs and implementation plans. The 2026-09-20 planner spec is kept as a historical record, and its header lists how the current app differs from it.
