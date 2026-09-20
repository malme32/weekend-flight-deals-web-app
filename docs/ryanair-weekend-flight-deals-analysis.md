# Ryanair Weekend Flight Deals — Architecture & Requirements Analysis

Stage: **Analyse** (architect triage). No application code in this stage.
Target repo: `malme32/weekend-flight-deals-web-app` (public, default branch `main`).

Revision: **r2** — incorporates reviewer findings (Rex, 2026-09-20). See §11.

## 1. Goal & scope

A static web page that lists **weekend round-trip flight deals**:

- **Origin:** Athens (ATH) by default. v1 snapshots a small **fixed origin set**
  (see §2) and the origin selector offers exactly the origins present in the
  snapshot; ATH is preselected.
- **Pattern:** depart **Friday**, return the following **Monday** (3 nights).
- **Price:** total round trip **≤ €100** (outbound + inbound), EUR.
- **Destination:** anywhere Ryanair flies from the selected origin.

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
  `ATH→PFO €48.99 + €25.62 = €74.61`; uncapped same window returned 10 fares,
  capped (`priceValueTo=100`) returned 2.
- Per-origin check for one Fri→Mon window (`priceValueTo=100`, `limit=20`):
  ATH 2, SKG 1, RHO 1, CFU 1, KGS 3, HER/CHQ/ZTH 0 fares.

Relevant response shape (per fare): `outbound`/`inbound` each carry
`departureAirport{iataCode,name,city}`, `arrivalAirport{...}`, `departureDate`,
`arrivalDate`, `price{value,currencyCode,currencySymbol}`, `flightNumber`, `flightKey`.
The document root also carries `fares[]`, `size`, and `nextPage`.

### Pagination (`nextPage`) — verified behaviour

- The response carries `nextPage`, but it is **not a reliable offset**: in every
  probe (`limit=20`, full pages of 20) it stayed `1`, and the `offset`, `page`,
  `pageIndex` and `pageSize` parameters were **ignored** (identical result sets).
  `nextPage` may also be `null` (e.g. HER/CHQ with 0 fares).
- Because the endpoint caps at **20 fares per query and cannot be reliably paged**,
  truncation is possible for large origins. The generator must therefore:
  1. read `nextPage` (and the full-page condition `size === limit`);
  2. when a further page is indicated, **subdivide** the query so each result set
     stays under the cap (v1: split the search by `outboundDepartureDate` within
     the Fri→Mon window is not possible because the window is a single Friday, so
     subdivision is by the configured origin set and by destination region when a
     region parameter is available; otherwise record truncation);
  3. **never silently drop fares** — set `"truncated": true` on the snapshot and
     log a warning when a page cannot be exhausted.
- Tests exercise both a single page (`nextPage: null`/`1`) and a multi-page
  sequence via an offline fixture; the page-following loop stops when the next
  page repeats or does not advance (guards against this endpoint's non-advancing
  `nextPage`).

### Decision: snapshot, no runtime call

`scripts/fetch-deals.mjs` (Node, dev-time) queries the API for the next N weekends
and for each configured origin, applies the Fri/Mon + ≤€100 rules, and writes
`data/deals.json`. At runtime the page fetches only that same-origin JSON. Rationale:

- Keeps the app fully static (GitHub Pages) and removes runtime CORS/rate-limit risk.
- Deterministic tests and offline operation.
- Live refresh is deliberately excluded (see confirmed decisions, §5).

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | Plain HTML/CSS/ES modules | No build step; mirrors `gta-shooter-web-app` / `pacman-web-app` |
| Server | `python3 -m http.server 8000` | Local dev only |
| Tests | `node:test` (`node --test test/`) | House convention; Node 18.19 present |
| Fetch script | Node 18 ESM (`fetch` built in) | Dev-time only, no deps |
| Package | `package.json` (`type: module`, `start`, `test`, `fetch`) | House convention (gta/pacman) |
| Agent docs | `AGENTS.md` | House convention (gta) |
| Host | GitHub Pages (branch `main`, root) | Static, zero-cost |
| CI | `.github/workflows/ci.yml` runs `npm test` on push + PR | Matches `gta-shooter-web-app`; keeps `main` green |

No frameworks, no bundler, no npm dependencies.

## 4. File layout

```
index.html                 # single search/results page
package.json               # type: module; start / test / fetch scripts; engines >=18
AGENTS.md                  # stack, layout, conventions, commands, DoD
.github/
  workflows/ci.yml         # node 18/20 + npm test on push/PR
  pull_request_template.md # PR checklist
src/
  main.js                  # bootstrap: load data, wire filters, render
  core/
    weekend.js             # upcoming Fri/Mon pairs, weekend key/labels
    deals.js               # model: normalise raw fares -> Deal[]; snapshot builder
    filter.js              # pure filter + sort + URL serialise/parse
    format.js              # EUR + date/time formatting (pure)
  ui/
    render.js              # DOM rendering of results + empty state
    filters.js             # filter controls <-> URL query state (origins from data)
  styles.css
data/
  deals.json               # committed snapshot written by scripts/fetch-deals.mjs
scripts/
  fetch-deals.mjs          # dev-time snapshot generator (keyless API)
test/
  weekend.test.js
  filter.test.js
  deals.test.js
  fetch-deals.test.js      # offline fixture tests (no network)
  fixtures/
    farfnd-page-1.json
    farfnd-page-2.json
README.md
.gitignore
```

Layering rule: `core/*` is pure and DOM-free (unit-testable under `node --test`);
`ui/*` and `main.js` touch the DOM. `scripts/fetch-deals.mjs` keeps its pure
helpers (normalise/page-follow/truncation) importable so tests never hit the network.
This mirrors the Pacman/GTA split.

### Deal model (`data/deals.json`)

Top-level `origins` records the configured origin set; each deal carries its own
`origin`, so the UI can build the selector from data and preselect ATH.

```json
{
  "generatedAt": "2026-09-20T00:00:00Z",
  "currency": "EUR",
  "defaultOrigin": "ATH",
  "origins": ["ATH", "SKG", "RHO"],
  "weekends": ["2026-09-25", "2026-10-02"],
  "truncated": false,
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

## 5. Confirmed decisions

These were previously listed as open questions; they are now **decided** (operator
requirement + review r2):

1. **Default origin = ATH.** ATH is preselected in the selector.
2. **Stock origin set (v1):** `ATH, SKG, RHO, CFU` (verified to return fares).
   Configurable via `--origins`; the selector shows only origins present in the
   snapshot, so it can never offer an origin that yields no results.
3. **€100 is the total round trip** (outbound + inbound), in EUR. Enforced
   server-side with `priceValueTo` and re-checked in `core/deals.js`.
4. **Snapshot-only data** — no runtime third-party calls (§2).
5. **CI enabled**, matching `gta-shooter-web-app` (§3).
6. **Reviewer for R1 is Rex** (independent of the implementer, Alice).

Remaining open questions (operator): Ryanair-only as the data source in v1;
English vs Greek UI. Neither blocks implementation.

## 6. Weekend date logic

- A deal qualifies only if `outbound.date` is a **Friday** and `inbound.date` is the
  **following Monday** (3 nights).
- `weekend.js` computes the upcoming Fri→Mon pairs from a reference date (injectable
  clock for tests): the next Friday, plus the following N weeks.
- `weekendKey` = the outbound Friday ISO date; used for grouping and the URL filter.

## 7. UI & filters

- Header: title, data `generatedAt` ("prices from <date>"), origin selector
  **populated from `origins` present in `data/deals.json`**, ATH preselected.
- Filter bar: weekend select, max-price input (default 100), destination text search,
  "reset" link.
- Results: cards/rows sorted by `totalPrice` asc showing route, dates, times, flight
  numbers, per-leg price and bold total. Empty state when no deal matches.
- State in URL, e.g. `?origin=ATH&weekend=2026-09-25&max=100&q=corfu`, parsed on load
  and updated on change (History API / `replaceState`).
- Accessibility: semantic landmarks, labels on inputs, keyboard-operable controls.

## 8. Testing strategy

- `node --test test/` on Node 18.
- `weekend.test.js`: Friday/Monday detection, next-weekend computation, edge cases
  (today is Fri/Sat/Sun, month/year rollover).
- `deals.test.js`: normalise raw API fare → Deal, total = outbound + inbound, reject
  non-Fri/Mon or >max.
- `filter.test.js`: filter combinations, sort order, URL serialise/parse round trip.
- `fetch-deals.test.js` (**offline fixture test, required**): drives the pure
  generator helpers with fixture pages under `test/fixtures/`; **no network**. Covers
  single page (`nextPage: null`/`1`), multi-page follow + de-duplication, and the
  truncation flag when a page cannot be exhausted.

## 9. Delivery plan (feeds Alice)

Single integration branch off `main`: **`agent/weekend-flight-deals-web-app`**
(PR target `main`). One PR containing the whole first deliverable is acceptable given
the small scope; otherwise one PR per task listed below.

| ID | Task | Owner | Deps | Acceptance |
|---|---|---|---|---|
| T1 | Repo scaffold: `index.html`, `src/`, `test/`, `.gitignore`, `package.json`, `AGENTS.md`, `.github/workflows/ci.yml`, PR template; empty `node --test` green | Alice | — | `npm test` exits 0; CI workflow present; local server serves index |
| T2 | `core/weekend.js` + tests | Alice | T1 | upcoming Fri/Mon pairs; boundary tests pass |
| T3 | `core/deals.js` + `core/format.js` + tests | Alice | T1 | raw fare→Deal; total adds legs; EUR formatting |
| T4 | `core/filter.js` + tests (origin/weekend/max/q, sort, URL round-trip) | Alice | T2,T3 | all filter tests pass |
| T5 | `scripts/fetch-deals.mjs` → `data/deals.json`: loop configured **origins**, handle `nextPage`/truncation, offline fixture test | Alice | T3 | runs against live keyless API; loops `--origins`; no silent truncation; `fetch-deals.test.js` passes with no network |
| T6 | `index.html` + `ui/render.js` + `styles.css` | Alice | T4 | deals render, sorted, empty state, responsive |
| T7 | `ui/filters.js` + `src/main.js` wiring + URL state; origin selector populated from snapshot and ATH preselected | Alice | T6 | filters change results; selector lists snapshot origins; URL reflects state on load/change |
| T8 | README + GitHub Pages enablement instructions | Alice | T7 | README documents run/test/refresh/host; Pages instructions present |
| R1 | Code review of PR(s), comments posted | **Rex** | T8 | independent review verdict + actionable comments on the PR |
| D1 | Deploy to GitHub Pages (operator-approved) | Dana (devops, gated) | R1 | page live at Pages URL after explicit approval |

Critical path: `T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → R1 → D1` (T3–T5 parallelisable).

## 10. Acceptance criteria (v1)

1. Static page loads `data/deals.json` and renders only deals with outbound **Friday**,
   inbound **following Monday**, and `totalPrice ≤ 100` EUR.
2. Origin **defaults to ATH**; the origin selector offers exactly the origins present
   in the snapshot and **changing it changes the results** (requires T5 to snapshot
   more than ATH).
3. Max-price filter (default €100) and destination search work; results sorted by total asc.
4. Filter state is encoded in the URL and restored on reload.
5. Each deal shows route, city names, dates, times, flight numbers, per-leg and total price (EUR).
6. **No runtime third-party network calls** — only same-origin `data/deals.json`.
7. `node --test test/` passes on Node 18; `core/*` has no DOM references; the
   fetch generator has an **offline fixture test** and does not silently truncate.
8. Site works when served statically from GitHub Pages (relative paths).
9. README + AGENTS.md document local run, tests, and data refresh; CI runs on push/PR.
10. `package.json` and `.github/workflows/ci.yml` match the gta/pacman house conventions.

## 11. Review response (r2)

| Reviewer finding | Resolution |
|---|---|
| (1) origin selector vs snapshot coverage makes AC#2 unsatisfiable | T5 now loops a configured origin set (default `ATH,SKG,RHO,CFU`); §5 decision 2; AC#2 reworded; selector built from snapshot origins. |
| (2) add `package.json` + `AGENTS.md`, decide CI | Added to T1 and §3/§4; CI decided: `.github/workflows/ci.yml` mirrors `gta-shooter-web-app`. |
| (3) move €100-total and ATH-default out of open questions | New §5 "Confirmed decisions" 1 and 3; removed from open questions. |
| (4) offline fixture test + `nextPage` handling for `fetch-deals.mjs` | T5 acceptance + §2 pagination subsection + `test/fetch-deals.test.js` + fixtures. |
| (5) name the R1 reviewer | R1 owner = **Rex**. |
