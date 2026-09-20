import test from 'node:test';
import assert from 'node:assert/strict';

import {
  availableOrigins,
  availableWeekends,
  defaultFilterState,
  filterDeals,
  parseQuery,
  serializeQuery,
} from '../src/core/filter.js';

/**
 * Build a small deal list for filter tests.
 * @returns {object[]}
 */
function deals() {
  return [
    { origin: 'ATH', originName: 'Athens', destination: 'CFU', destinationName: 'Corfu', weekendKey: '2026-09-25', totalPrice: 55.21 },
    { origin: 'ATH', originName: 'Athens', destination: 'PFO', destinationName: 'Paphos', weekendKey: '2026-09-25', totalPrice: 74.61 },
    { origin: 'ATH', originName: 'Athens', destination: 'BGY', destinationName: 'Milan Bergamo', weekendKey: '2026-10-02', totalPrice: 88.0 },
    { origin: 'SKG', originName: 'Thessaloniki', destination: 'CFU', destinationName: 'Corfu', weekendKey: '2026-10-02', totalPrice: 40.0 },
  ];
}

test('defaultFilterState targets ATH, any weekend, EUR100', () => {
  assert.deepEqual(defaultFilterState(), { origin: 'ATH', weekend: '', maxPrice: 100, query: '' });
});

test('filterDeals filters by origin, weekend, price and query', () => {
  assert.deepEqual(filterDeals(deals(), { origin: 'SKG' }).map((d) => d.destination), ['CFU']);
  assert.deepEqual(
    filterDeals(deals(), { weekend: '2026-10-02' }).map((d) => d.destination),
    ['CFU', 'BGY'],
  );
  assert.deepEqual(
    filterDeals(deals(), { maxPrice: 60 }).map((d) => d.destination),
    ['CFU', 'CFU'],
  );
  assert.deepEqual(
    filterDeals(deals(), { query: 'corf' }).map((d) => d.origin),
    ['SKG', 'ATH'],
  );
  assert.deepEqual(filterDeals(deals(), { query: 'BGY' }).map((d) => d.destination), ['BGY']);
});

test('filterDeals sorts results by total price ascending', () => {
  const totals = filterDeals(deals(), {}).map((d) => d.totalPrice);
  assert.deepEqual(totals, [40.0, 55.21, 74.61, 88.0]);
});

test('availableOrigins and availableWeekends report distinct sorted values', () => {
  assert.deepEqual(availableOrigins(deals()), ['ATH', 'SKG']);
  assert.deepEqual(availableWeekends(deals()), ['2026-09-25', '2026-10-02']);
});

test('parseQuery reads and normalises a query string', () => {
  const state = parseQuery('?origin=ath&weekend=2026-09-25&max=50&q=cor');
  assert.deepEqual(state, { origin: 'ATH', weekend: '2026-09-25', maxPrice: 50, query: 'cor' });
});

test('parseQuery falls back to defaults for missing keys', () => {
  assert.deepEqual(parseQuery(''), defaultFilterState());
  assert.deepEqual(parseQuery('?foo=bar'), defaultFilterState());
});

test('serializeQuery omits defaults and round-trips through parseQuery', () => {
  assert.equal(serializeQuery(defaultFilterState()), '');

  const state = { origin: 'SKG', weekend: '2026-10-02', maxPrice: 60, query: 'corfu' };
  const query = serializeQuery(state);
  assert.equal(query, 'origin=SKG&weekend=2026-10-02&max=60&q=corfu');
  assert.deepEqual(parseQuery(`?${query}`), state);
});
