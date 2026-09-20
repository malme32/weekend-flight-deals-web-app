import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRyanairUrl, parseFares } from './src/ryanair.js';

const rootDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(rootDir, 'public');
const port = Number(process.env.PORT || 8000);
const liveEnabled = String(process.env.ENABLE_LIVE_RYANAIR ?? 'true') !== 'false';
const cacheTtlMs = Number(process.env.CACHE_TTL_MS || 600000);
const rateLimitPerMin = Number(process.env.RATE_LIMIT_PER_MIN || 30);

const cache = new Map();
const hits = new Map();

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > rateLimitPerMin;
}

function queryFrom(params) {
  return {
    origin: (params.get('origin') || 'ATH').toUpperCase(),
    destination: (params.get('destination') || '').toUpperCase(),
    outboundFrom: params.get('outboundFrom') || '',
    outboundTo: params.get('outboundTo') || '',
    inboundFrom: params.get('inboundFrom') || '',
    inboundTo: params.get('inboundTo') || '',
    maxPrice: params.get('maxPrice') ?? '',
    outboundWeekday: params.get('outboundWeekday') || '',
    inboundWeekday: params.get('inboundWeekday') || '',
    currency: 'EUR',
    market: 'el-gr',
  };
}

async function handleRoundTrip(req, res, url) {
  const ip = req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return sendJson(res, 429, { error: 'rate_limited', message: 'Too many requests. Please try again shortly.' });
  }
  if (!liveEnabled) {
    return sendJson(res, 503, {
      error: 'live_disabled',
      message: 'Live Ryanair access is disabled. Set ENABLE_LIVE_RYANAIR=true to enable it.',
    });
  }

  const query = queryFrom(url.searchParams);
  let upstreamUrl;
  try {
    upstreamUrl = buildRyanairUrl(query);
  } catch (err) {
    return sendJson(res, 400, { error: 'bad_request', message: err.message });
  }

  const cached = cache.get(upstreamUrl);
  if (cached && Date.now() - cached.at < cacheTtlMs) {
    return sendJson(res, 200, { ...cached.payload, cached: true });
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers: {
        accept: 'application/json',
        origin: 'https://www.ryanair.com',
        'user-agent': 'weekend-flight-deals/0.1 (+github)',
      },
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    if (!response.ok) {
      return sendJson(res, 502, { error: 'upstream_error', status: response.status, message: text.slice(0, 300) });
    }
    const data = JSON.parse(text);
    const deals = parseFares(data, query);
    const payload = {
      source: 'ryanair',
      query,
      count: deals.length,
      deals,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(upstreamUrl, { at: Date.now(), payload });
    return sendJson(res, 200, { ...payload, cached: false });
  } catch (err) {
    return sendJson(res, 502, { error: 'fetch_failed', message: String(err.message || err) });
  }
}

async function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicDir, safe);
  if (!filePath.startsWith(publicDir + sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/round-trip') return handleRoundTrip(req, res, url);
  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true, liveEnabled });
  return serveStatic(res, url);
});

server.listen(port, () => {
  console.log(`weekend-flight-deals listening on http://localhost:${port} (live=${liveEnabled})`);
});
