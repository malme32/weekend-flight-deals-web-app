# Ryanair Weekend Flight Deals — Architecture & Requirements Analysis

Stage: **Analyse** (architect triage). No application code in this stage.
Target repo: `malme32/weekend-flight-deals-web-app` (public, default branch `main`, currently empty).

## 1. Goal & scope

A static web page that lists **weekend round-trip flight deals**:

- **Origin:** Athens (ATH) by default, with an origin filter.
- **Pattern:** depart **Friday**, return the following **Monday** (3 nights).
- **Price:** total round trip **≤ €100** (outbound + inbound), EUR.
- **Destination:** anywhere Ryanair flies from the origin.

In scope

- Search/results page: list of deals, sorted by total price ascending.
- Filters: origin, weekend (which Fri–Mon), max round-trip price, destination text search.
- Filter state reflected in the URL query string (shareable/bookmarkable).
- Data refreshed by a dev-time script into a committed snapshot.

Out of scope

- No booking/checkout, no accounts, no backend, no live runtime third-party calls.
- No other airlines, no multi-city, no one-way, no non-Fri/Mon ranges.
- No i18n in v1 (English UI; destination city names may come from the API as-is).

## 2. Data source (verified live)

`GET https://www.ryanair.com/api/farfnd/v4/roundTripFares` — **keyless**.

Verified on 2026-09-20 (this run):

- `HTTP/2 200`, `content-type: application/json`, `access-control-allow-origin: *`.
- `limit` max is **20** (`limit=21` → HTTP 400).
- `priceValueTo=100` filters the **round-trip total** server-side.
- Sample for ATH, Fri 2026-09-25 → Mon 2026-09-28: `ATH→CFU €30.08 + €25.13 = €55.21`,
  `ATH→PFO €48.99 + €25.62 = €74.61`; uncapped same window returned 10 fares.

Relevant response shape (per fare): `outbound`/`inbound` each carry
`departureAirport{iataCode,name,city}`, `arrivalAirport{...}`, `departureDate`,
`arrivalDate`, `price{value,currencyCode,currencySymbol}`, `flightNumber`, `flightKey`.

### Decision: snapshot, no runtime call

`scripts/fetch-deals.mjs` (Node, dev-time) queries the API for the next N weekends,
applies the Fri/Mon + ≤€100 rules, and writes `data/deals.json`. At runtime the page
fetches only that same-origin JSON. Rationale:

- Keeps the app fully static (GitHub Pages) and removes runtime CORS/rate-limit risk.
- Deterministic tests and offline operation.
- Live refresh is deliberately excluded (open question for operator).

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | Plain HTML/CSS/ES modules | No build step; mirrors `gta-shooter-web-app` / `pacman-web-app` |
| Server | `python3 -m http.server 8000` | Local dev only |
| Tests | `node:test` (`node --test test/`) | Already the house convention; Node 18.19 present |
| Fetch script | Node 18 ESM (`fetch` built in) | Dev-time only, no deps |
| Host | GitHub Pages (branch `main`, root) | Static, zero-cost |
| CI | none in v1 (tests run locally) | Keep scope minimal |

No frameworks, no bundler, no npm dependencies.

## 4. File layout

```
index.html                 # single search/results page
src/
  main.js                  # bootstrap: load data, wire filters, render
  core/
    weekend.js             # upcoming Fri/Mon pairs, weekend key/labels
    deals.js               # model: normalise raw fares -> Deal[]
    filter.js              # pure filter + sort (origin, weekend, maxPrice, query)
    format.js              # EUR + date/time formatting (pure)
  ui/
    render.js              # DOM rendering of results + empty state
    filters.js             # filter controls <-> URL query state
  styles.css
data/
  deals.json               # committed snapshot written by scripts/fetch-deals.mjs
scripts/
  fetch-deals.mjs          # dev-time snapshot generator (keyless API)
test/
  weekend.test.js
  filter.test.js
  deals.test.js
README.md
.gitignore
```

Layering rule: `core/*` is pure and DOM-free (unit-testable under `node --test`);
`ui/*` and `main.js` touch the DOM. This mirrors the Pacman/GTA split.

### Deal model (`data/deals.json`)

```json
{
  "generatedAt": "2026-09-20T00:00:00Z",
  "currency": "EUR",
  "weekends": ["2026-09-25", "2026-10-02"],
  "deals": [
    {
      "origin": "ATH", "destination": "CFU",
      "originName": "Athens", "destinationName": "Corfu",
      "weekendKey": "2026-09-25",
      "outbound": { "date": "2026-09-25", "departureTime": "07:25", "arrivalTime": "08:30", "flightNumber": "FR4298", "price": 30.08 },
      "inbound":  { "date": "2026-09-28", "departureTime": "19:10", "arrivalTime": "20:15", "flightNumber": "FR4299", "price": 25.13 },
      "totalPrice": 55.21
    }
  ]
}
```

## 5. Weekend date logic

- A deal qualifies only if `outbound.date` is a **Friday** and `inbound.date` is the
  **following Monday** (3 nights).
- `weekend.js` computes the upcoming Fri→Mon pairs from a reference date (injectable
  clock for tests): the next Friday, plus the following N weeks.
- `weekendKey` = the outbound Friday ISO date; used for grouping and the URL filter.

## 6. UI & filters

- Header: title, data `generatedAt` ("prices from <date>"), origin selector (default ATH).
- Filter bar: weekend select, max-price input (default 100), destination text search,
  "reset" link.
- Results: cards/rows sorted by `totalPrice` asc showing route, dates, times, flight
  numbers, per-leg price and bold total. Empty state when no deal matches.
- State in URL, e.g. `?origin=ATH&weekend=2026-09-25&max=100&q=corfu`, parsed on load
  and updated on change (History API / `replaceState`).
- Accessibility: semantic landmarks, labels on inputs, keyboard-operable controls.

## 7. Testing strategy

- `node --test test/` on Node 18.
- `weekend.test.js`: Friday/Monday detection, next-weekend computation, edge cases
  (today is Fri/Sat/Sun, month/year rollover).
- `deals.test.js`: normalise raw API fare → Deal, total = outbound + inbound, reject
  non-Fri/Mon or >max.
- `filter.test.js`: filter combinations, sort order, URL serialise/parse round trip.
- Script smoke test (optional): `fetch-deals.mjs` shape check against a fixture.

## 8. Delivery plan (feeds Alice)

Single integration branch off `main`: **`agent/weekend-flight-deals-web-app`**
(PR target `main`). One PR containing the whole first deliverable is acceptable given
the small scope; otherwise one PR per task listed below.

| ID | Task | Owner | Deps | Acceptance |
|---|---|---|---|---|
| T1 | Repo scaffold: `index.html`, `src/`, `test/`, `.gitignore`, README, empty `node --test` green | Alice | — | `node --test test/` exits 0; local server serves index |
| T2 | `core/weekend.js` + tests | Alice | T1 | upcoming Fri/Mon pairs; boundary tests pass |
| T3 | `core/deals.js` + `core/format.js` + tests | Alice | T1 | raw fare→Deal; total adds legs; EUR formatting |
| T4 | `core/filter.js` + tests (origin/weekend/max/q, sort, URL round-trip) | Alice | T2,T3 | all filter tests pass |
| T5 | `scripts/fetch-deals.mjs` → `data/deals.json` | Alice | T3 | script runs against live keyless API, writes valid JSON |
| T6 | `index.html` + `ui/render.js` + `styles.css` | Alice | T4 | deals render, sorted, empty state, responsive |
| T7 | `ui/filters.js` + `src/main.js` wiring + URL state | Alice | T6 | filters change results; URL reflects state on load/change |
| T8 | README + GitHub Pages enablement instructions | Alice | T7 | README documents run/test/refresh/host |
| R1 | Code review of PR(s), comments posted | Reviewer (not Alice) | T8 | review verdict + actionable comments on the PR |
| D1 | Deploy to GitHub Pages (operator-approved) | Operator | R1 | page live at Pages URL |

Critical path: `T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → R1 → D1` (T3–T5 parallelisable).

## 9. Acceptance criteria (v1)

1. Static page loads `data/deals.json` and renders only deals with outbound **Friday**,
   inbound **following Monday**, and `totalPrice ≤ 100` EUR.
2. Origin defaults to **ATH**; origin selector changes results.
3. Max-price filter (default €100) and destination search work; results sorted by total asc.
4. Filter state is encoded in the URL and restored on reload.
5. Each deal shows route, city names, dates, times, flight numbers, per-leg and total price (EUR).
6. **No runtime third-party network calls** — only same-origin `data/deals.json`.
7. `node --test test/` passes on Node 18; `core/*` has no DOM references.
8. Site works when served statically from GitHub Pages (relative paths).
9. README documents local run, tests, and data refresh.

## 10. Risks & open questions

- **API change / no SLA:** keyless endpoint is undocumented; snapshot shields runtime,
  but `fetch-deals.mjs` may break. Mitigation: keep the raw fetch isolated in the script.
- **Coverage gaps:** API returns at most 20 fares per query; multiple weekend queries
  and pagination may be needed. `nextPage` semantics to confirm during T5.
- **Staleness:** snapshot prices are not live. Accepted for v1.

Open questions for the operator: confirm ATH as default origin; snapshot-only vs live
refresh; €100 = total round trip (assumed yes); Ryanair-only acceptable; English vs
Greek UI.
