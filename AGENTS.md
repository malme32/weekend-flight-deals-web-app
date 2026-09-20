# AGENTS.md

Instructions for agents and contributors working in this repository.

## Stack

- Plain HTML, CSS and ES2020 JavaScript modules; no build step, no third-party
  runtime dependencies.
- Node.js >= 18 for tests (`node:test`) and the dev-time fetch script.

## Repository layout

- `index.html` - the single search/results page.
- `src/core/` - pure game-free logic; **must not** touch the DOM, `window` or
  `document`, so it stays unit-testable under Node.
  - `weekend.js` - Fri/Mon date maths and weekend keys.
  - `deals.js` - normalise raw fares into the `Deal` model and snapshots.
  - `filter.js` - filtering, sorting and URL query serialisation.
  - `format.js` - EUR and date/time formatting.
- `src/ui/` - browser-coupled code.
  - `render.js` - DOM rendering of results and metadata.
  - `filters.js` - filter controls <-> URL state.
- `src/main.js` - bootstrap; loads `data/deals.json` and wires core + ui.
- `scripts/fetch-deals.mjs` - dev-time snapshot generator (keyless Ryanair API).
- `data/deals.json` - committed snapshot consumed by the page.
- `test/` - Node unit tests (`node:test`).
- `README.md` - run/test/refresh/host instructions, rules and data model.

## Conventions

- Keep pure logic in `src/core/` and browser-coupled code in `src/ui/`.
- Prefer small, pure functions with JSDoc type hints.
- Express dates as ISO `YYYY-MM-DD` calendar strings interpreted as UTC so logic
  is timezone-independent.
- Tests live in `test/`, use `node:test` + `node:assert/strict`, and are named
  `*.test.js`. Add a test for every new behaviour.
- Do not introduce third-party runtime dependencies. Ask before adding a build
  step.
- Never commit directly to `main`. Work on a branch named `agent/<task-slug>`
  and open a pull request. Never force-push.

## Commands

```sh
python3 -m http.server 8000   # serve the site locally
node --test test/             # run the tests
npm test                      # same as above
node scripts/fetch-deals.mjs  # refresh data/deals.json from the live API
```

## Definition of done

- Changes are committed on a feature branch `agent/<task-slug>`.
- `node --test test/` exits 0.
- `python3 -m http.server 8000` serves `index.html` and `data/deals.json`.
- No third-party dependencies are introduced.
- README/AGENTS are updated when layout or behaviour changes.
- A pull request is open and has been reviewed before merging to `main`.
