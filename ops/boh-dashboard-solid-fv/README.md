# Fix pack (Graph 403 + session-only Export)

## What failed last run
1. **Google login on Actions** — blocked (timeout on email field). Do not use Google in cloud.
2. **Graph 403** — code tried `/users/{id}?$select=...` which needs User.Read.All. **Mail.Read** only needs `/users/{UPN}/messages`.

## Copy these 4 files into toast-mcp-server (cmd)

```bat
cd /d C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard
git pull

cd /d C:\Users\MatthiasLavenant\Documents\rdg-dj-dashboard\ops\boh-dashboard-solid-fv
copy /Y ms-graph-mail.cjs C:\Cursor\toast-mcp-server\
copy /Y fv-trigger-exports.cjs C:\Cursor\toast-mcp-server\
copy /Y CLOUD-SETUP.md C:\Cursor\toast-mcp-server\
copy /Y rdg-daily.yml.workflow C:\Cursor\toast-mcp-server\.github\workflows\rdg-daily.yml

cd /d C:\Cursor\toast-mcp-server
git add ms-graph-mail.cjs fv-trigger-exports.cjs CLOUD-SETUP.md .github\workflows\rdg-daily.yml
git commit -m "Fix Graph Mail.Read path and session-only FV export trigger."
git push
```

## Refresh FourVenues session (required — yours expired)

```bat
cd /d C:\Cursor\toast-mcp-server
node fv-relogin-save.cjs
```

Log in in the browser. Then update GitHub secret **`FV_SESSION_B64`** from `fv-final-session.json` (or run `set-fv-secret.ps1` if you have it).

## Re-run
Actions → RDG Daily Forecast + Toast → **fourvenues**
