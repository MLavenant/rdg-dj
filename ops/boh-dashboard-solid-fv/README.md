# Solid FourVenues cloud — files to copy into `boh-dashboard`

This agent cannot push to `MLavenant/boh-dashboard` from here. Copy these into your local automation repo (`C:\Cursor\toast-mcp-server` / `boh-dashboard`), then commit and push.

## Copy map

| This file | Destination in boh-dashboard |
|-----------|------------------------------|
| `ms-graph-mail.cjs` | `ms-graph-mail.cjs` |
| `fv-trigger-exports.cjs` | `fv-trigger-exports.cjs` (new) |
| `fv-daily-cloud.cjs` | `fv-daily-cloud.cjs` (new) |
| `fv-refresh-graph.cjs` | `fv-refresh-graph.cjs` |
| `fv-sales-export-lib.cjs` | `fv-sales-export-lib.cjs` |
| `fv-google.cjs` | `fv-google.cjs` (password removed; uses env) |
| `test-graph-mail.cjs` | `test-graph-mail.cjs` |
| `setup-azure-graph-secrets.ps1` | `setup-azure-graph-secrets.ps1` |
| `CLOUD-SETUP.md` | `CLOUD-SETUP.md` |
| `rdg-daily.yml.workflow` | `.github/workflows/rdg-daily.yml` |

## PowerShell (from this folder)

```powershell
$src = "C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard\ops\boh-dashboard-solid-fv"
$dst = "C:\Cursor\toast-mcp-server"
Copy-Item "$src\ms-graph-mail.cjs","$src\fv-trigger-exports.cjs","$src\fv-daily-cloud.cjs","$src\fv-refresh-graph.cjs","$src\fv-sales-export-lib.cjs","$src\fv-google.cjs","$src\test-graph-mail.cjs","$src\setup-azure-graph-secrets.ps1","$src\CLOUD-SETUP.md" -Destination $dst -Force
Copy-Item "$src\rdg-daily.yml.workflow" "$dst\.github\workflows\rdg-daily.yml" -Force
cd $dst
git add -A
git commit -m "Solid FourVenues cloud: trigger Sales Export then Graph to Firebase."
git push
```

## Secrets still required on boh-dashboard

1. Fix **`GRAPH_MAILBOX`** = exact Entra **User principal name** (Users blade) — fixes the 404
2. Add **`FV_EMAIL`** + **`FV_PASSWORD`** (Google login for FourVenues Export trigger)
3. Keep existing Azure + Toast secrets

Then: Actions → **RDG Daily Forecast + Toast** → Run → `fourvenues`
