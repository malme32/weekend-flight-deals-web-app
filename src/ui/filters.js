/**
 * DOM <-> filter-state binding: populate controls, read state from controls,
 * and keep the URL query string in sync.
 */

import { DEFAULT_MAX_TOTAL } from '../core/deals.js';
import { serializeQuery } from '../core/filter.js';
import { formatDateRange } from '../core/format.js';
import { addDays } from '../core/weekend.js';

/**
 * Populate the origin `<select>`.
 * @param {HTMLSelectElement} select
 * @param {string[]} origins
 * @param {string} selected
 */
export function populateOrigins(select, origins, selected) {
  if (!select) return;
  select.textContent = '';
  for (const code of origins) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    select.appendChild(option);
  }
  if (selected && origins.includes(selected)) select.value = selected;
  else if (origins.length) select.value = origins[0];
}

/**
 * Populate the weekend `<select>` with an "Any weekend" option plus each Friday.
 * @param {HTMLSelectElement} select
 * @param {string[]} weekends
 * @param {string} selected
 */
export function populateWeekends(select, weekends, selected) {
  if (!select) return;
  select.textContent = '';
  const any = document.createElement('option');
  any.value = '';
  any.textContent = 'Any weekend';
  select.appendChild(any);
  for (const friday of weekends) {
    const option = document.createElement('option');
    option.value = friday;
    option.textContent = formatDateRange(friday, addDays(friday, 3));
    select.appendChild(option);
  }
  select.value = selected && weekends.includes(selected) ? selected : '';
}

/**
 * Write a filter state into the max-price and search inputs.
 * @param {{ max?: HTMLInputElement, q?: HTMLInputElement }} els
 * @param {{ maxPrice: number, query: string }} state
 */
export function applyStateToControls(els, state) {
  if (els.max) {
    els.max.value = Number.isFinite(state.maxPrice) ? String(state.maxPrice) : String(DEFAULT_MAX_TOTAL);
  }
  if (els.q) els.q.value = state.query || '';
}

/**
 * Read the current filter state from the controls.
 * @param {{ origin?: HTMLSelectElement, weekend?: HTMLSelectElement, max?: HTMLInputElement, q?: HTMLInputElement }} els
 * @returns {{ origin: string, weekend: string, maxPrice: number, query: string }}
 */
export function readFilterState(els) {
  const rawMax = els.max?.value ?? '';
  const max = rawMax === '' ? DEFAULT_MAX_TOTAL : Number(rawMax);
  return {
    origin: (els.origin?.value || '').toUpperCase(),
    weekend: els.weekend?.value || '',
    maxPrice: Number.isFinite(max) ? max : DEFAULT_MAX_TOTAL,
    query: els.q?.value || '',
  };
}

/**
 * Reflect a filter state in the URL via `history.replaceState`.
 * @param {object} state
 */
export function syncUrl(state) {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  const query = serializeQuery(state);
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}
