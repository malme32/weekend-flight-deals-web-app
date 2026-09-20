import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshot, normaliseDeals, normaliseFare, round2 } from '../src/core/deals.js';

/**
 * Build a raw farfnd-shaped fare for tests.
 * @param {object} [overrides]
 * @returns {any}
 */
function rawFare({
  outboundDate = '2026-09-25T07:25:00',
  inboundDate = '2026-09-28T19:10:00',
  outboundPrice = 30.08,
  inboundPrice = 25.13,
  destination = 'CFU',
  destinationName = 'Corfu',
  flightNumber = 'FR4298',
} = {}) {
  return {
    outbound: {
      departureAirport: { iataCode: 'ATH', name: 'Athens', city: { name: 'Athens' } },
      arrivalAirport: { iataCode: destination, name: destinationName, city: { name: destinationName } },
      departureDate: outboundDate,
      arrivalDate: outboundDate,
      price: { value: outboundPrice, currencyCode: 'EUR' },
      flightNumber,
    },
    inbound: {
      departureAirport: { iataCode: destination, name: destinationName, city: { name: destinationName } },
      arrivalAirport: { iataCode: 'ATH', name: 'Athens', city: { name: 'Athens' } },
      departureDate: inboundDate,
      arrivalDate: inboundDate,
      price: { value: inboundPrice, currencyCode: 'EUR' },
      flightNumber: 'FR4299',
    },
    summary: { price: { value: outboundPrice + inboundPrice, currencyCode: 'EUR' } },
  };
}

test('round2 removes floating point dust', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('normaliseFare maps a Friday->Monday fare to a Deal', () => {
  const deal = normaliseFare(rawFare());
  assert.ok(deal);
  assert.equal(deal.origin, 'ATH');
  assert.equal(deal.destination, 'CFU');
  assert.equal(deal.originName, 'Athens');
  assert.equal(deal.destinationName, 'Corfu');
  assert.equal(deal.weekendKey, '2026-09-25');
  assert.equal(deal.totalPrice, 55.21);
  assert.deepEqual(deal.outbound, {
    date: '2026-09-25',
    departureTime: '07:25',
    arrivalTime: '07:25',
    flightNumber: 'FR4298',
    price: 30.08,
  });
  assert.equal(deal.inbound.date, '2026-09-28');
  assert.equal(deal.inbound.flightNumber, 'FR4299');
});

test('normaliseFare rejects fares that are not Fri->Mon', () => {
  assert.equal(normaliseFare(rawFare({ outboundDate: '2026-09-24T07:25:00' })), null); // Thursday
  assert.equal(normaliseFare(rawFare({ inboundDate: '2026-09-29T19:10:00' })), null); // Tuesday
  assert.equal(normaliseFare({}), null);
  assert.equal(normaliseFare(null), null);
});

test('normaliseFare rejects unusable prices', () => {
  assert.equal(normaliseFare(rawFare({ outboundPrice: 'nope' })), null);
});

test('normaliseDeals drops non-qualifying and over-budget fares', () => {
  const deals = normaliseDeals([
    rawFare({ destination: 'CFU', outboundPrice: 30.08, inboundPrice: 25.13 }),
    rawFare({ destination: 'PFO', outboundPrice: 48.99, inboundPrice: 25.62 }),
    rawFare({ destination: 'BGY', outboundPrice: 80, inboundPrice: 40 }), // 120 > 100
    rawFare({ destination: 'STN', outboundDate: '2026-09-24T07:25:00' }), // Thursday
  ]);
  assert.deepEqual(
    deals.map((deal) => deal.destination),
    ['CFU', 'PFO'],
  );
});

test('normaliseDeals de-duplicates identical flights and sorts by total', () => {
  const deals = normaliseDeals([
    rawFare({ destination: 'PFO', outboundPrice: 48.99, inboundPrice: 25.62 }),
    rawFare({ destination: 'CFU', outboundPrice: 30.08, inboundPrice: 25.13 }),
    rawFare({ destination: 'CFU', outboundPrice: 30.08, inboundPrice: 25.13 }),
  ]);
  assert.equal(deals.length, 2);
  assert.deepEqual(
    deals.map((deal) => deal.destination),
    ['CFU', 'PFO'],
  );
});

test('buildSnapshot produces the data/deals.json document shape', () => {
  const snapshot = buildSnapshot([rawFare()], {
    origin: 'ATH',
    weekends: ['2026-10-02', '2026-09-25'],
    generatedAt: '2026-09-20T00:00:00.000Z',
    maxTotal: 100,
  });
  assert.equal(snapshot.origin, 'ATH');
  assert.equal(snapshot.currency, 'EUR');
  assert.equal(snapshot.generatedAt, '2026-09-20T00:00:00.000Z');
  assert.deepEqual(snapshot.weekends, ['2026-09-25', '2026-10-02']);
  assert.equal(snapshot.deals.length, 1);
});
