# Agent notes

Conventions for work in this repository.

- **Code lives in GitHub.** If the repo has no remote yet, ask the operator
  (that setup is gated) before assuming PR work is possible.
- **Engineers open a pull request** as soon as their code is ready for review.
  Do not push to `main` directly.
- **Reviewers review the PR and leave comments.** A change is not done until it
  has been reviewed.
- **Tests:** run `npm test` (Node's built-in test runner, no install needed).
  Keep `src/ryanair.js` pure so it stays testable.
- **Commands:** `npm start` serves the page on `http://localhost:8000`.
- **Live access:** all Ryanair calls go through `server.mjs`
  (`/api/round-trip`). Never call the upstream API from browser code.
  Respect the kill switch (`ENABLE_LIVE_RYANAIR=false`) and the cache/rate
  limits; do not raise them without a reason.
- **No secrets** in the repo. Runtime config is environment variables only.
