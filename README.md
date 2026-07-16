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

## Automated refresh (Task Scheduler on this PC)
- **FourVenues** — daily at **8:30 AM** (`RDG DJ FourVenues Daily 830`)
- **Toast** — **Mondays** at **8:30 AM** (`RDG DJ Toast Monday 830`)
- Status is written to Firebase and shown in the dashboard **System Status** page

PC must be powered on at run time (or move jobs to a cloud VM later).

## Related repos (not this app)
- `rdg-ai-dashboard` — separate project
- `boh-dashboard` — BOH / kitchen tooling, not the DJ dashboard
