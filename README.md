# Adani Ports — Daily Predictor Dashboard

A ridge regression that retrains itself every trading day on fresh Adani Ports
price history, predicts the next day's % move, and logs its own accuracy over
time. **Learning project. Not a trading signal.**

## What runs where

- `public/index.html` — the dashboard you visit. Reads the prediction log
  straight from your GitHub repo (raw.githubusercontent.com) and renders it.
- `api/cron-predict.js` — a Vercel serverless function. Runs once a day
  (see `vercel.json`), pulls fresh data from Yahoo Finance, retrains the
  model, predicts tomorrow, and commits the result back to
  `data/predictions.json` in this repo via the GitHub API.
- `lib/model.js` — the actual ML: feature engineering + ridge regression.
- `data/predictions.json` — the growing log. Starts empty (`[]`).

## Setup (same GitHub → Vercel flow you already use)

**1. Upload these files to a GitHub repo** (public or private, your call)
via the GitHub web uploader, same as your other projects.

**2. Create a GitHub Personal Access Token**
Go to github.com/settings/tokens → Generate new token (classic) →
check the `repo` scope → generate. Copy it, you'll only see it once.

**3. Import the repo into Vercel**, then in the Vercel project's
Settings → Environment Variables, add:

| Key | Value |
|---|---|
| `GITHUB_TOKEN` | the personal access token from step 2 |
| `GITHUB_OWNER` | your GitHub username |
| `GITHUB_REPO` | the repo name |
| `GITHUB_BRANCH` | `main` (or whatever your default branch is) |
| `STOCK_SYMBOL` | `ADANIPORTS.NS` (optional, this is already the default) |

**4. Edit `public/index.html`** — near the top of the `<script>` tag, set:
```js
const GITHUB_OWNER = "your-username";
const GITHUB_REPO = "your-repo-name";
```
Commit that change (through GitHub web editor is fine — small text edit).

**5. Redeploy** so Vercel picks up the env vars and `vercel.json` cron config.

**6. Trigger the first run manually** — you don't have to wait for the
schedule. Visit `https://your-project.vercel.app/api/cron-predict` directly
in your browser once. It should return JSON like:
```json
{"ok": true, "symbol": "ADANIPORTS.NS", "asOfDate": "2026-08-14", "predictedMove": 0.12, ...}
```
That seeds `data/predictions.json` with the first entry. Refresh the
dashboard and you should see it.

**7. After that, it runs itself.** The cron fires on weekdays at 10:30 UTC
(4:00 PM IST, just after market close). Each run:
- fills in the "actual" result for the previous logged day
- retrains on all available history
- logs a fresh prediction for the next trading day

Give it a couple of weeks and the accuracy numbers on the dashboard become a
real track record instead of a single snapshot.

## Notes / honesty check

- Free Yahoo Finance endpoint, no key needed.
- The cron endpoint has no auth check by default — fine for a personal
  project, but anyone with the URL could trigger it manually. Not a real
  security concern here since it only appends data, but worth knowing.
- If two prior chat sessions (5y and 1y backtests) are anything to go by,
  expect directional accuracy hovering near or below 50%. That's the honest
  finding, not a bug — daily OHLCV alone doesn't carry much next-day signal.
  Let the dashboard prove or disprove that over time rather than assuming.
