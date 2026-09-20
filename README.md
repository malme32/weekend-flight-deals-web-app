# Weekend flight deals (Ryanair)

A small web page that searches **live Ryanair fares** for weekend round trips
(outbound Friday, inbound Monday) with a maximum total price (default **EUR 100**).

It is intentionally zero-dependency: a plain static page plus a tiny Node server
that proxies the Ryanair Services API server-side.

## Run

```bash
npm start          # http://localhost:8000
npm test           # unit tests (node:test)
```

## How it works

```
browser ──/api/round-trip──> server.mjs ──> services-api.ryanair.com/farfnd/v4/roundTripFares
```

- `public/index.html`, `public/styles.css`, `public/app.js` – the UI.
- `server.mjs` – static file server + `/api/round-trip` proxy. Adds an in-memory
  cache (default 10 min) and a per-IP rate limit (default 30/min).
- `src/ryanair.js` – pure helpers (`buildRyanairUrl`, `normalizeFares`,
  `filterDeals`, `sortDeals`, `parseFares`), covered by `test/ryanair.test.mjs`.

The page never calls Ryanair directly: the request is made server-side, which
avoids browser CORS surprises, keeps the API bounded, and gives us one place to
cache/cap/kill live access.

### API params used

`departureAirportIataCode`, optional `arrivalAirportIataCode`,
`outboundDepartureDateFrom/To`, `inboundDepartureDateFrom/To`, `priceValueTo`
(this caps the **round-trip total**), `currency=EUR`, `market=el-gr`.
`limit` is rejected by the upstream API, so it is not sent; `nextPage` was
`null` for the fixtures we tested.

### Response shape

`{ fares: [ { outbound, inbound, summary } ] }` where each leg has
`departureAirport`, `arrivalAirport`, `departureDate`, `arrivalDate`,
`flightNumber`, `price.value`, and `summary.price.value` is the round-trip total.

## Configuration

| Env | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | HTTP port |
| `ENABLE_LIVE_RYANAIR` | `true` | Set `false` to hard-disable live calls (kill switch) |
| `CACHE_TTL_MS` | `600000` | Upstream response cache TTL |
| `RATE_LIMIT_PER_MIN` | `30` | Per-IP requests/minute |

## Disclaimer / ToS

`services-api.ryanair.com` is an **internal, undocumented** endpoint. Ryanair's
ToS forbid unauthorised automated access and Ryanair has litigated against
scrapers. Prices are indicative "from" fares and exclude bags/seats. Use at your
own risk, keep traffic low, do not monetise, and **get operator/legal approval
before exposing live mode publicly**. The `ENABLE_LIVE_RYANAIR=false` kill
switch disables all upstream calls.

## Conventions

See `AGENTS.md`.
