/**
 * Application bootstrap: load the snapshot, wire filters to rendering and URL
 * state, and render the initial results.
 */

import { availableOrigins, availableWeekends, filterDeals, parseQuery } from './core/filter.js';
import { applyStateToControls, populateOrigins, populateWeekends, readFilterState, syncUrl } from './ui/filters.js';
import { renderDeals, renderMeta, renderOriginLabel } from './ui/render.js';

const els = {
  form: document.getElementById('filters'),
  origin: document.getElementById('origin'),
  weekend: document.getElementById('weekend'),
  max: document.getElementById('max'),
  q: document.getElementById('q'),
  results: document.getElementById('results'),
  count: document.getElementById('result-count'),
  meta: document.getElementById('data-meta'),
  originLabel: document.getElementById('origin-label'),
};

/**
 * Load and validate the committed snapshot.
 * @returns {Promise<object>}
 */
async function loadSnapshot() {
  const response = await fetch('data/deals.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`data/deals.json returned HTTP ${response.status}`);
  const snapshot = await response.json();
  if (!snapshot || !Array.isArray(snapshot.deals)) throw new Error('Deal snapshot is malformed');
  return snapshot;
}

/**
 * Initialise the UI once the snapshot is available.
 * @param {object} snapshot
 */
function start(snapshot) {
  const origins = availableOrigins(snapshot.deals);
  const weekends = availableWeekends(snapshot.deals);
  const state = parseQuery(window.location.search);

  if (!origins.includes(state.origin) && origins.length) state.origin = origins[0];

  populateOrigins(els.origin, origins, state.origin);
  populateWeekends(els.weekend, weekends, state.weekend);
  applyStateToControls(els, state);

  const update = () => {
    const next = readFilterState(els);
    const deals = filterDeals(snapshot.deals, next);
    renderDeals(els.results, deals, { origin: next.origin });
    if (els.count) els.count.textContent = `(${deals.length})`;
    renderOriginLabel(els.originLabel, next.origin, snapshot.deals);
    syncUrl(next);
  };

  if (els.form) {
    els.form.addEventListener('input', update);
    els.form.addEventListener('change', update);
    els.form.addEventListener('reset', () => window.setTimeout(update, 0));
  }

  renderMeta(els.meta, snapshot);
  update();
}

loadSnapshot()
  .then(start)
  .catch((error) => {
    console.error(error);
    if (els.results) {
      els.results.textContent = `Could not load deal data: ${error.message}`;
    }
  });
