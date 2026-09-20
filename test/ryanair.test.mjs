import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRyanairUrl,
  filterDeals,
  normalizeFares,
  parseFares,
  sortDeals,
  weekdayName,
} from '../src/ryanair.js';

const fixture = {
  fares: [
    {
      outbound: {
        departureAirport: { iataCode: 'ATH', name: 'Athens', countryName: 'Greece', city: { countryCode: 'gr' } },
        arrivalAirport: { iataCode: 'CFU', name: 'Corfu', countryName: 'Greece', city: { countryCode: 'gr' } },
        departureDate: '2026-09-25T07:25:00',
        arrivalDate: '2026-09-25T08:30:00',
        flightNumber: 'FR4298',
        price: { value: 30.08, currencyCode: 'EUR' },
      },
      inbound: {
        departureAirport: { iataCode: 'CFU', name: 'Corfu', countryName: 'Greece', city: { countryCode: 'gr' } },
        arrivalAirport: { iataCode: 'ATH', name: 'Athens', countryName: 'Greece', city: { countryCode: 'gr' } },
        departureDate: '2026-09-28T05:45:00',
        arrivalDate: '2026-09-28T06:50:00',
        flightNumber: 'FR4299',
        price: { value: 25.13, currencyCode: 'EUR' },
      },
      summary: { price: { value: 55.21, currencyCode: 'EUR' }, tripDurationDays: 3 },
    },
    {
      outbound: {
        departureAirport: { iataCode: 'ATH' },
        arrivalAirport: { iataCode: 'BUD', name: 'Budapest', countryName: 'Hungary', city: { countryCode: 'hu' } },
        departureDate: '2026-09-25T12:10:00',
        arrivalDate: '2026-09-25T13:20:00',
        flightNumber: 'FR1234',
        price: { value: 40.0, currencyCode: 'EUR' },
      },
      inbound: {
        departureAirport: { iataCode: 'BUD' },
        arrivalAirport: { iataCode: 'ATH' },
        departureDate: '2026-09-28T18:00:00',
        arrivalDate: '2026-09-28T21:10:00',
        flightNumber: 'FR1235',
        price: { value: 31.5, currencyCode: 'EUR' },
      },
      summary: { price: { value: 71.5, currencyCode: 'EUR' }, tripDurationDays: 3 },
    },
    {
      outbound: { departureAirport: {}, arrivalAirport: {}, departureDate: '', price: {} },
      inbound: { departureAirport: {}, arrivalAirport: {}, departureDate: '', price: {} },
      summary: { price: {} },
    },
  ],
};

test('weekdayName resolves ISO dates in UTC', () => {
  assert.equal(weekdayName('2026-09-25'), 'Fri');
  assert.equal(weekdayName('2026-09-28'), 'Mon');
  assert.equal(weekdayName('nonsense'), '');
});

test('buildRyanairUrl sets required params and uppercases the origin', () => {
  const url = buildRyanairUrl({
    origin: 'ath',
    outboundFrom: '2026-09-25',
    outboundTo: '2026-09-25',
    inboundFrom: '2026-09-28',
    inboundTo: '2026-09-28',
    maxPrice: 100,
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://services-api.ryanair.com/farfnd/v4/roundTripFares');
  assert.equal(parsed.searchParams.get('departureAirportIataCode'), 'ATH');
  assert.equal(parsed.searchParams.get('priceValueTo'), '100');
  assert.equal(parsed.searchParams.get('currency'), 'EUR');
  assert.equal(parsed.searchParams.get('outboundDepartureDateFrom'), '2026-09-25');
  assert.equal(parsed.searchParams.get('inboundDepartureDateTo'), '2026-09-28');
});

test('buildRyanairUrl omits optional params and requires date ranges', () => {
  const url = buildRyanairUrl({
    origin: 'ATH',
    outboundFrom: '2026-09-25',
    outboundTo: '2026-09-25',
    inboundFrom: '2026-09-28',
    inboundTo: '2026-09-28',
  });
  assert.equal(new URL(url).searchParams.has('priceValueTo'), false);
  assert.equal(new URL(url).searchParams.has('arrivalAirportIataCode'), false);
  assert.throws(() => buildRyanairUrl({ origin: 'ATH' }), /date ranges/);
  assert.throws(() => buildRyanairUrl({}), /origin is required/);
});

test('normalizeFares maps legs and drops incomplete fares', () => {
  const deals = normalizeFares(fixture);
  assert.equal(deals.length, 2);
  assert.deepEqual(
    {
      destination: deals[0].destination,
      outboundWeekday: deals[0].outboundWeekday,
      inboundWeekday: deals[0].inboundWeekday,
      totalPrice: deals[0].totalPrice,
    },
    { destination: 'CFU', outboundWeekday: 'Fri', inboundWeekday: 'Mon', totalPrice: 55.21 },
  );
});

test('total price is the round-trip sum of both legs', () => {
  const [deal] = normalizeFares(fixture);
  assert.equal(Number((deal.outboundPrice + deal.inboundPrice).toFixed(2)), 55.21);
  assert.equal(deal.totalPrice, 55.21);
});

test('filterDeals applies the price cap and weekday constraints', () => {
  const deals = normalizeFares(fixture);
  assert.equal(filterDeals(deals, { maxPrice: 60 }).length, 1);
  assert.equal(filterDeals(deals, { maxPrice: 100 }).length, 2);
  assert.equal(filterDeals(deals, { outboundWeekday: 'Fri' }).length, 2);
  assert.equal(filterDeals(deals, { outboundWeekday: 'Sat' }).length, 0);
  assert.equal(filterDeals(deals, { inboundWeekday: 'Mon', maxPrice: 100 }).length, 2);
});

test('sortDeals orders by ascending total price', () => {
  const sorted = sortDeals(normalizeFares(fixture));
  assert.deepEqual(sorted.map((d) => d.destination), ['CFU', 'BUD']);
});

test('parseFares end-to-end filters and sorts', () => {
  const deals = parseFares(fixture, { maxPrice: 100, outboundWeekday: 'Fri', inboundWeekday: 'Mon' });
  assert.deepEqual(deals.map((d) => d.destination), ['CFU', 'BUD']);
});
