# CLE-64 / 11b - check-boundaries: allow metro.config.js to read KEEP_FNAMES

Repo `D:\Clever\Gift-list`, branch `chore/cle-64-named-functions`, on top of the uncommitted 11a changes (keep them). Do NOT commit, push, npm install/ci, or edit .env*.

Problem: `npm run lint` (root) fails in `node scripts/check-boundaries.mjs`:
`apps\mobile\metro.config.js: reads process.env outside src/config/env.ts`.
metro.config.js is Node build-time config (like app.config.ts), evaluated by Metro itself, it cannot import src/config/env.ts and is not bundled into the app.

Change only `scripts/check-boundaries.mjs` around lines 31-47: add `const mobileMetroConfig = path.join(root, "apps/mobile/metro.config.js");` next to `mobileAppConfig`, extend the comment (Metro evaluates metro.config.js with Node; it may read the build-time KEEP_FNAMES flag), and add `file !== mobileMetroConfig` to the condition on line 46. Do not loosen anything else. Do not touch metro.config.js.

Checks from repo root: `npm run lint` must exit 0. Report the diff.
