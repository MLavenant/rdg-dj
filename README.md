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

## Nightly refresh
Windows Task Scheduler runs `C:\Cursor\toast-mcp-server\refresh-dashboard.bat`, which:
- Pulls FourVenues forecast bookings
- Updates Toast bottle-service actuals
- Writes pacing snapshots to Firebase
- Commits and pushes to this repo

## Related repos (not this app)
- `rdg-ai-dashboard` — separate project
- `boh-dashboard` — BOH / kitchen tooling, not the DJ dashboard
