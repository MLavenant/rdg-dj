# RDG DJ Dashboard

Live app: **https://mlavenant.github.io/rdg-dj/**

Local folder (source of truth):
`C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard`

## What this repo is
Single-file HTML dashboard for Riviera Dining Group DJ / bottle-service performance across:
- Casa Neos Beach Club
- MILA Lounge
- Casa Neos Lounge

## How hosting works
1. Edit / update `index.html` in the local folder above
2. Commit and push to `main` on this repo (`MLavenant/rdg-dj`)
3. GitHub Pages serves it at https://mlavenant.github.io/rdg-dj/

## Automated refresh
- **Cloud (laptop off):** GitHub Actions `RDG Daily Forecast + Toast` ~**8:30 AM ET**
  - **FourVenues** — daily (Integrations API → Firebase)
  - **Toast BS** — Wed–Sun → GitHub Pages
- **Local backup (this PC):** Task Scheduler at **8:30 / 8:35 AM** runs the same Integrations API + Toast path
- Status is written to Firebase and shown on the dashboard **System** page

PC does **not** need to be on for cloud jobs. Local tasks are a backup if Actions is delayed.

## Related repos (not this app)
- `rdg-ai-dashboard` — separate project
- `boh-dashboard` — BOH / kitchen tooling, not the DJ dashboard
