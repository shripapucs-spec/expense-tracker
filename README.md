# Expense Tracker (PWA · INR)

A simple, elegant, **local-first** personal expense tracker in **Indian Rupees (₹)**.
No accounts, no servers, no subscriptions, no analytics — your data lives only in your
device's browser. Installable on the iPhone Home Screen and works offline.

## Feature summary

| Area | What's included |
|---|---|
| Dashboard | Today / month / year totals, transaction count, avg daily spend, top category, month-vs-last-month hero card, category doughnut, 12-month bar chart, recent transactions, 6-month summary |
| Add Expense | Date (defaults to today), ₹ amount, category (14 built-in + custom), description, payment method (Cash/UPI/Debit/Credit/Net Banking/Other), inline custom categories, rapid re-entry |
| Transactions | Search, month / date-range / category / payment filters, group by day or month, sort newest/oldest, edit modal, delete with confirmation, running totals |
| Reports | Today / week / month / year cards, daily chart per month, weekly (8 weeks), category-wise doughnut + bars, month-to-month comparison, yearly table |
| Settings | CSV export, JSON export, full JSON backup, merge-only JSON restore (never overwrites), custom category management, light/dark theme, clear-all with double confirmation, privacy notes |
| PWA | `manifest.webmanifest` + service worker, offline after first load, iOS safe-area layout, bottom nav on mobile / sidebar on desktop |

## Run locally

You don't need Node.js. Any static file server works.

**Option A — included PowerShell server (recommended on this PC):**

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
# then open http://localhost:8642/
```

**Option B — Python:**

```
python -m http.server 8642
```

**Option C — VS Code** with the *Live Server* extension.

> Note: don't open `index.html` directly from Explorer (`file://`) — ES modules,
> IndexedDB and service workers need a real `http://localhost` origin.

## Use on iPhone 17 (Safari)

1. Host it on GitHub Pages (below) or any HTTPS host.
2. Open the URL in Safari, tap **Share → Add to Home Screen**.
3. Launch it from the Home Screen icon — it runs full-screen, offline, with ₹ data stored on device.

*(Same-PC-LAN testing: the included `serve.ps1` binds to `localhost` only. For phone-on-Wi-Fi testing, `python -m http.server 0.0.0.0 8642` works; note that iOS requires HTTPS for service-worker/PWA install, so GitHub Pages is the reliable path.)*

## Deploy free on GitHub Pages

1. Create a free account/repo on GitHub (e.g. `expense-tracker`).
2. Upload **all files in this folder** (keep the structure) or push with git:

   ```bash
   git init && git add -A && git commit -m "Expense tracker PWA"
   git branch -M main
   git remote add origin https://github.com/<you>/expense-tracker.git
   git push -u origin main
   ```

3. Repo → **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` / *(root)* → Save.
4. Your app is live at `https://<you>.github.io/expense-tracker/` — free, no backend, no cost.

## Data & privacy

- Storage: browser **IndexedDB** (`expense-tracker-db`), created on first visit.
- Nothing leaves the device: there's no fetch/analytics/CDN in the app — Chart.js is bundled locally.
- **Limitations:** iOS Safari may eventually clear website data under storage pressure or if you
  clear browser data; IndexedDB space on iOS is roughly 50%-quota based and can be limited.
  Treat **Settings → Full backup** as your safety net and keep the JSON file in iCloud/Drive.
- Restoring a backup **never overwrites** existing records — duplicates are skipped and the
  counts are reported to you.

## Architecture

```
index.html                  app shell, nav
manifest.webmanifest        PWA manifest
sw.js                       offline cache (app shell)
css/styles.css              design system (iOS safe-areas, dark mode)
vendor/chart.umd.min.js     Chart.js 4, bundled locally
js/db.js                    IndexedDB wrapper (transactions, meta)
js/store.js                 data layer: CRUD, validation, backup/restore
js/stats.js                 aggregations (pure functions)
js/charts.js                Chart.js helpers (₹ tooltips, auto destroy)
js/ui.js                    formatting (₹/dates), modals, toasts
js/components.js            shared expense form + transaction row
js/views/*.js               dashboard / add / transactions / reports / settings
serve.ps1                   dependency-free local server
make_icons.ps1              regenerates the PWA icons
```

Every read/write goes through `js/store.js` only. The planned **Google Sheets sync**
(future phase) will plug into that single layer with OAuth — no credentials will ever be
hardcoded, stored in the app, or required for offline use.

## Included files license note

Chart.js is bundled under the MIT license (© Chart.js contributors) from
`chart.js@4.4.7/dist/chart.umd.min.js` — bundled locally so the app has **zero runtime CDN
requests** (privacy + offline).
