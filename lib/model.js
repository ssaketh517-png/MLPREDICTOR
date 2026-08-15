// Shared ML logic: feature engineering + ridge regression.
// Same math as the original artifact prototype, ported for Node.js.

const math = require('mathjs');

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// rows: [{date, open, high, low, close, volume}] ascending by date
// Returns feature rows. If includeTarget is true, needs i+1 to exist (skips last row).
function buildFeatures(rows, includeTarget = true) {
  const closes = rows.map(r => r.close);
  const volumes = rows.map(r => r.volume);
  const rsiArr = rsi(closes, 14);
  const feats = [];
  const minIdx = 20;
  const maxIdx = includeTarget ? rows.length - 1 : rows.length;
  for (let i = minIdx; i < maxIdx; i++) {
    const ret1 = (closes[i] - closes[i - 1]) / closes[i - 1];
    const ret5 = (closes[i] - closes[i - 5]) / closes[i - 5];
    const sma5 = closes.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5;
    const sma20 = closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20;
    const smaRatio = sma5 / sma20 - 1;
    const volChange = volumes[i - 1] === 0 ? 0 : (volumes[i] - volumes[i - 1]) / volumes[i - 1];
    const rsiVal = (rsiArr[i] === null || isNaN(rsiArr[i])) ? 50 : rsiArr[i];
    const row = {
      date: rows[i].date,
      x: [1, ret1 * 100, ret5 * 100, smaRatio * 100, volChange * 100, (rsiVal - 50) / 50],
      lastClose: closes[i]
    };
    if (includeTarget) {
      row.y = ((closes[i + 1] - closes[i]) / closes[i]) * 100;
    }
    feats.push(row);
  }
  return feats;
}

function ridgeFit(X, y, lambda = 2.0) {
  const Xm = math.matrix(X);
  const ym = math.matrix(y.map(v => [v]));
  const Xt = math.transpose(Xm);
  const XtX = math.multiply(Xt, Xm);
  const n = X[0].length;
  const I = math.identity(n)._data.map((row, i) => row.map((v, j) => (i === 0 || j === 0) ? 0 : v));
  const reg = math.add(XtX, math.multiply(lambda, math.matrix(I)));
  const Xty = math.multiply(Xt, ym);
  const beta = math.multiply(math.inv(reg), Xty);
  return beta._data.map(r => r[0]);
}

function predict(beta, x) {
  return x.reduce((sum, v, i) => sum + v * beta[i], 0);
}

module.exports = { rsi, buildFeatures, ridgeFit, predict };
