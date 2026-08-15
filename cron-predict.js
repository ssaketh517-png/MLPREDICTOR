// Runs daily via Vercel Cron (see vercel.json).
// 1. Pulls fresh daily price data from Yahoo Finance (server-side, no CORS issue here).
// 2. Fills in "actual" for yesterday's pending prediction.
// 3. Retrains the ridge regression on all available history.
// 4. Predicts tomorrow's % move and appends a new log entry.
// 5. Commits the updated log back to the GitHub repo via the Contents API.

const { buildFeatures, ridgeFit, predict } = require('../lib/model');

const SYMBOL = process.env.STOCK_SYMBOL || 'ADANIPORTS.NS';
const RANGE = '2y';
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_PATH = 'data/predictions.json';

async function fetchYahoo(symbol, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await resp.json();
  if (data.chart && data.chart.error) throw new Error('Yahoo error: ' + JSON.stringify(data.chart.error));
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error('No chart data returned for ' + symbol);
  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  let rows = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (quote.close[i] == null || quote.open[i] == null || quote.volume[i] == null) continue;
    const d = new Date(timestamps[i] * 1000);
    rows.push({
      date: d.toISOString().slice(0, 10),
      open: quote.open[i], high: quote.high[i], low: quote.low[i],
      close: quote.close[i], volume: quote.volume[i]
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

async function githubGetFile() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}?ref=${GITHUB_BRANCH}`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'adani-predictor' }
  });
  if (resp.status === 404) return { content: [], sha: null };
  if (!resp.ok) throw new Error('GitHub GET failed: ' + resp.status + ' ' + await resp.text());
  const json = await resp.json();
  const decoded = Buffer.from(json.content, 'base64').toString('utf8');
  return { content: JSON.parse(decoded), sha: json.sha };
}

async function githubPutFile(newContent, sha, message) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify(newContent, null, 2)).toString('base64'),
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'User-Agent': 'adani-predictor',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error('GitHub PUT failed: ' + resp.status + ' ' + await resp.text());
  return resp.json();
}

module.exports = async function handler(req, res) {
  try {
    if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
      return res.status(500).json({ error: 'Missing GITHUB_OWNER / GITHUB_REPO / GITHUB_TOKEN env vars.' });
    }

    const rows = await fetchYahoo(SYMBOL, RANGE);
    if (rows.length < 40) {
      return res.status(500).json({ error: `Only got ${rows.length} rows from Yahoo, too little to train.` });
    }

    const { content: log, sha } = await githubGetFile();

    // Fill in "actual" for any pending entries whose date has now passed.
    const closeByDate = {};
    rows.forEach(r => { closeByDate[r.date] = r.close; });
    for (const entry of log) {
      if (entry.actual != null) continue;
      const idx = rows.findIndex(r => r.date === entry.date);
      if (idx >= 0 && idx + 1 < rows.length) {
        const actualMove = ((rows[idx + 1].close - rows[idx].close) / rows[idx].close) * 100;
        entry.actual = Number(actualMove.toFixed(4));
        entry.correctDirection = Math.sign(entry.actual) === Math.sign(entry.predicted);
      }
    }

    // Retrain on all available history, predict next day from the latest row.
    const trainFeats = buildFeatures(rows, true);
    const X = trainFeats.map(f => f.x);
    const y = trainFeats.map(f => f.y);
    const beta = ridgeFit(X, y, 2.0);

    const latestFeats = buildFeatures(rows, false);
    const lastRow = latestFeats[latestFeats.length - 1];
    const predictedMove = Number(predict(beta, lastRow.x).toFixed(4));
    const asOfDate = lastRow.date;

    // Avoid duplicate entries if cron runs twice for the same trading day.
    const alreadyLogged = log.find(e => e.date === asOfDate);
    if (!alreadyLogged) {
      log.push({
        date: asOfDate,
        predicted: predictedMove,
        actual: null,
        correctDirection: null,
        loggedAt: new Date().toISOString()
      });
    }

    log.sort((a, b) => a.date.localeCompare(b.date));

    await githubPutFile(log, sha, `Daily prediction update: ${asOfDate}`);

    return res.status(200).json({
      ok: true,
      symbol: SYMBOL,
      asOfDate,
      predictedMove,
      totalRows: rows.length,
      logEntries: log.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
