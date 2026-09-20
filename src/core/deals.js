/**
 * Pure model layer: normalise Ryanair farfnd v4 round-trip fares into the
 * `Deal` shape stored in `data/deals.json` and consumed by the page.
 */

import { datePart, timePart } from './format.js';
import { isWeekendPair, weekendKey } from './weekend.js';

export const DEFAULT_MAX_TOTAL = 100;
export const DEFAULT_CURRENCY = 'EUR';
export const DEFAULT_ORIGIN = 'ATH';

/**
 * Round to two decimals without float dust.
 * @param {number} value
 * @returns {number}
 */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Best available human-readable name for an airport.
 * @param {any} airport
 * @returns {string}
 */
function cityName(airport) {
  return airport?.city?.name || airport?.name || airport?.iataCode || '';
}

/**
 * Normalise a single raw farfnd fare into a Deal.
 * Returns null when the fare is not a Friday -> following Monday pair or when
 * its prices are unusable.
 * @param {any} raw
 * @returns {object|null}
 */
export function normaliseFare(raw) {
  if (!raw || !raw.outbound || !raw.inbound) return null;

  const out = raw.outbound;
  const back = raw.inbound;
  const outboundDate = datePart(out.departureDate);
  const inboundDate = datePart(back.departureDate);
  if (!outboundDate || !inboundDate) return null;
  if (!isWeekendPair(outboundDate, inboundDate)) return null;

  const outboundPrice = Number(out.price?.value);
  const inboundPrice = Number(back.price?.value);
  if (!Number.isFinite(outboundPrice) || !Number.isFinite(inboundPrice)) return null;

  return {
    origin: out.departureAirport?.iataCode ?? '',
    destination: out.arrivalAirport?.iataCode ?? '',
    originName: cityName(out.departureAirport),
    destinationName: cityName(out.arrivalAirport),
    weekendKey: weekendKey(outboundDate),
    outbound: {
      date: outboundDate,
      departureTime: timePart(out.departureDate),
      arrivalTime: timePart(out.arrivalDate),
      flightNumber: out.flightNumber ?? '',
      price: round2(outboundPrice),
    },
    inbound: {
      date: inboundDate,
      departureTime: timePart(back.departureDate),
      arrivalTime: timePart(back.arrivalDate),
      flightNumber: back.flightNumber ?? '',
      price: round2(inboundPrice),
    },
    totalPrice: round2(outboundPrice + inboundPrice),
  };
}

/**
 * Sort deals by total price ascending, then destination, then weekend.
 * @param {object[]} deals
 * @returns {object[]}
 */
export function sortDeals(deals) {
  return [...deals].sort(
    (a, b) =>
      a.totalPrice - b.totalPrice ||
      String(a.destination).localeCompare(String(b.destination)) ||
      String(a.weekendKey).localeCompare(String(b.weekendKey)),
  );
}

/**
 * Normalise, filter (weekend pair + max total) and de-duplicate a list of raw fares.
 * @param {any[]} rawFares
 * @param {{ maxTotal?: number }} [options]
 * @returns {object[]}
 */
export function normaliseDeals(rawFares, { maxTotal = DEFAULT_MAX_TOTAL } = {}) {
  const cap = Number(maxTotal);
  const hasCap = Number.isFinite(cap);
  const seen = new Set();
  const deals = [];

  for (const raw of Array.isArray(rawFares) ? rawFares : []) {
    const deal = normaliseFare(raw);
    if (!deal) continue;
    if (hasCap && deal.totalPrice > cap) continue;
    const key = [
      deal.origin,
      deal.destination,
      deal.weekendKey,
      deal.outbound.flightNumber,
      deal.inbound.flightNumber,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deals.push(deal);
  }

  return sortDeals(deals);
}

/**
 * Build the `data/deals.json` snapshot document.
 * @param {any[]} rawFares
 * @param {{ origin?: string, weekends?: string[], generatedAt?: string, maxTotal?: number }} [options]
 * @returns {object}
 */
export function buildSnapshot(rawFares, {
  origin = DEFAULT_ORIGIN,
  weekends = [],
  generatedAt = new Date().toISOString(),
  maxTotal = DEFAULT_MAX_TOTAL,
} = {}) {
  return {
    generatedAt,
    currency: DEFAULT_CURRENCY,
    origin,
    weekends: [...weekends].sort(),
    deals: normaliseDeals(rawFares, { maxTotal }),
  };
}
