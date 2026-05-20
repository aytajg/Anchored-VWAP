import { parseVal, serveFile } from "https://esm.town/v/std/utils/index.ts";
import { Hono } from "npm:hono";

const app = new Hono();

// Serve frontend
app.get("/", () => serveFile("/frontend/index.html"));
app.get("/frontend/**/*", (c) => serveFile(c.req.path));
app.get("/source", (c) => c.redirect(parseVal().links.self.val));

// ─── Yahoo Finance API ───────────────────────────────────────────────

app.get("/api/chart", async (c) => {
  const symbol = c.req.query("symbol") || "AAPL";
  const interval = c.req.query("interval") || "1d"; // "5m" or "1d"
  const range = c.req.query("range") || "6mo"; // depends on interval

  // Yahoo Finance v8 chart API
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?interval=${interval}&range=${range}&includePrePost=false`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!resp.ok) {
    return c.json({ error: `Yahoo Finance error: ${resp.status}` }, 400);
  }

  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    return c.json({ error: "No data found for this symbol" }, 404);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const { open, high, low, close, volume } = quote;

  // Build OHLCV candles
  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (open[i] == null || high[i] == null || low[i] == null || close[i] == null) continue;
    candles.push({
      time: timestamps[i],
      open: Number(open[i].toFixed(4)),
      high: Number(high[i].toFixed(4)),
      low: Number(low[i].toFixed(4)),
      close: Number(close[i].toFixed(4)),
      volume: volume[i] || 0,
    });
  }

  const meta = result.meta || {};
  return c.json({
    symbol: meta.symbol,
    currency: meta.currency,
    exchangeName: meta.exchangeName,
    instrumentType: meta.instrumentType,
    candles,
  });
});

// Search / autocomplete symbols
app.get("/api/search", async (c) => {
  const q = c.req.query("q") || "";
  if (q.length < 1) return c.json({ results: [] });

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!resp.ok) return c.json({ results: [] });
  const data = await resp.json();
  const results = (data.quotes || []).map((q: any) => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || q.symbol,
    type: q.quoteType,
    exchange: q.exchange,
  }));

  return c.json({ results });
});

app.onError((err) => Promise.reject(err));
export default app.fetch;
