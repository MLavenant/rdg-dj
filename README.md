# RDG DJ Dashboard

Live app: **https://mlavenant.github.io/rdg-dj/**

Local folder (source of truth):
`C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard`

## What this repo is
Static multi-file dashboard for Riviera Dining Group DJ / bottle-service performance across:
- Casa Neos Beach Club
- MILA Lounge
- Casa Neos Lounge

Layout (plain files, no build step):
- `index.html` — page shell / markup
- `css/app.css` — styles
- `data/sched-baked.js` — baked schedule seed data
- `js/` — app logic (`fiscal`, `calendar`, `budget`, `accounting`, `firebase-sync`, `modals`, …)
- `js/vendor/xlsx.js` — Excel import helper

## How hosting works
1. Edit the relevant file(s) in the local folder above
2. Commit and push to `main` on this repo (`MLavenant/rdg-dj`)
3. GitHub Pages serves it at https://mlavenant.github.io/rdg-dj/
4. After deploy, hard-refresh or open with `?v=3.62` if the browser caches old assets

## Automated refresh
- **Cloud (laptop off):** GitHub Actions `RDG Daily Forecast + Toast` (~**8:25 AM ET** dispatch)
- **FourVenues** — Integrations API → Firebase `forecastLive`
- **Toast BS + VIP tiers** — Excel methodology → Firebase `toastActuals` (day totals), `toastVipNights` (per-night Diamond/Prestige/Platinum/Gold splits), `vipTierActuals` (week rollups)
  - CN Lounge: no “No Table”; VIP columns = Diamond / Platinum / Gold
  - MILA: VIP columns = Diamond / Prestige / Gold
  - Lookback: last 14 Miami business days on every run (any week, not just a baked week)
- **Forecast flash email:** Mon–Fri **9:00 ET** (retry **9:30**) — same To/Cc as dashboard **Send all emails**, only if FourVenues is OK for that Miami day; **max one email/day**. If 9:30 still fails → alert to Matthias. Status: Firebase `rdg/scrapeStatus/forecastEmail` (System page).
- **Local backup (this PC):** Task Scheduler at **8:30 / 8:35 AM** runs the same path
- Status is written to Firebase and shown on the dashboard **System** page

PC does **not** need to be on for cloud jobs. Local tasks are a backup if Actions is delayed.

## Related repos (not this app)
- `rdg-ai-dashboard` — separate project
- `boh-dashboard` — BOH / kitchen tooling, not the DJ dashboard
