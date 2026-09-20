/**
 * Pure filtering, sorting and URL query-state helpers.
 * Kept DOM-free so it can be unit-tested and reused.
 */

import { DEFAULT_MAX_TOTAL, DEFAULT_ORIGIN, sortDeals } from './deals.js';

/**
 * @typedef {object} FilterState
 * @property {string} origin       IATA code, uppercase ('' = any)
 * @property {string} weekend      outbound Friday ISO date ('' = any)
 * @property {number} maxPrice     maximum round-trip total in EUR
 * @property {string} query        destination free-text search
 */

/**
 * @returns {FilterState}
 */
export function defaultFilterState() {
  return { origin: DEFAULT_ORIGIN, weekend: '', maxPrice: DEFAULT_MAX_TOTAL, query: '' };
}

/**
 * Filter and sort deals for a UI state.
 * @param {object[]} deals
 * @param {Partial<FilterState>} [state]
 * @returns {object[]}
 */
export function filterDeals(deals, state = {}) {
  const origin = String(state.origin ?? '').trim().toUpperCase();
  const weekend = String(state.weekend ?? '').trim();
  const query = String(state.query ?? '').trim().toLowerCase();
  const maxPrice = state.maxPrice === '' || state.maxPrice == null ? NaN : Number(state.maxPrice);
  const cap = Number.isFinite(maxPrice) ? maxPrice : Infinity;

  const filtered = (Array.isArray(deals) ? deals : []).filter((deal) => {
    if (origin && String(deal.origin).toUpperCase() !== origin) return false;
    if (weekend && deal.weekendKey !== weekend) return false;
    if (deal.totalPrice > cap) return false;
    if (query) {
      const haystack = [
        deal.destination,
        deal.destinationName,
        deal.origin,
        deal.originName,
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return sortDeals(filtered);
}

/**
 * Unique origins present in the deal list, sorted.
 * @param {object[]} deals
 * @returns {string[]}
 */
export function availableOrigins(deals) {
  return [...new Set((deals || []).map((deal) => deal.origin).filter(Boolean))].sort();
}

/**
 * Unique weekend keys present in the deal list, sorted.
 * @param {object[]} deals
 * @returns {string[]}
 */
export function availableWeekends(deals) {
  return [...new Set((deals || []).map((deal) => deal.weekendKey).filter(Boolean))].sort();
}

/**
 * Parse a filter state from a URL query string or `URLSearchParams`-like search.
 * Missing keys fall back to defaults.
 * @param {string} [search]
 * @returns {FilterState}
 */
export function parseQuery(search = '') {
  const raw = String(search).replace(/^\?/, '');
  const params = new URLSearchParams(raw);
  const state = defaultFilterState();

  if (params.has('origin')) {
    const origin = (params.get('origin') || '').trim().toUpperCase();
    if (origin) state.origin = origin;
  }
  if (params.has('weekend')) {
    const weekend = (params.get('weekend') || '').trim();
    if (weekend) state.weekend = weekend;
  }
  if (params.has('max')) {
    const max = Number(params.get('max'));
    if (Number.isFinite(max) && max >= 0) state.maxPrice = max;
  }
  if (params.has('q')) {
    state.query = params.get('q') || '';
  }
  return state;
}

/**
 * Serialise a filter state to a compact query string (without leading `?`).
 * Values equal to the defaults are omitted to keep URLs clean.
 * @param {Partial<FilterState>} [state]
 * @returns {string}
 */
export function serializeQuery(state = {}) {
  const defaults = defaultFilterState();
  const params = new URLSearchParams();
  const origin = String(state.origin ?? '').trim().toUpperCase();
  const weekend = String(state.weekend ?? '').trim();
  const query = String(state.query ?? '').trim();
  const maxPrice = state.maxPrice == null || state.maxPrice === '' ? defaults.maxPrice : Number(state.maxPrice);

  if (origin && origin !== defaults.origin) params.set('origin', origin);
  if (weekend) params.set('weekend', weekend);
  if (Number.isFinite(maxPrice) && maxPrice !== defaults.maxPrice) params.set('max', String(maxPrice));
  if (query) params.set('q', query);

  return params.toString();
}
