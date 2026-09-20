/**
 * Pure formatting helpers: EUR prices and English dates/times.
 * No DOM access, so the module is unit-testable under `node --test`.
 */

import { parseISO } from './weekend.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The calendar-date part of an ISO datetime.
 * @param {string} value
 * @returns {string}
 */
export function datePart(value) {
  return String(value ?? '').slice(0, 10);
}

/**
 * The `HH:MM` time part of an ISO datetime.
 * @param {string} value
 * @returns {string}
 */
export function timePart(value) {
  const match = /T(\d{2}:\d{2})/.exec(String(value ?? ''));
  if (match) return match[1];
  const short = /^(\d{2}:\d{2})/.exec(String(value ?? ''));
  return short ? short[1] : '';
}

/**
 * Format a price with a currency symbol.
 * @param {number} value
 * @param {string} [symbol]
 * @returns {string}
 */
export function formatPrice(value, symbol = '\u20ac') {
  const price = Number(value);
  if (!Number.isFinite(price)) return '\u2014';
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Format an ISO calendar date as e.g. `Fri 25 Sep 2026`.
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const date = parseISO(iso);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Format a Friday -> Monday range, compressing the shared month/year.
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {string}
 */
export function formatDateRange(fromIso, toIso) {
  const from = parseISO(fromIso);
  const to = parseISO(toIso);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  if (!sameMonth) return `${formatDate(fromIso)} \u2013 ${formatDate(toIso)}`;
  return (
    `${WEEKDAYS[from.getUTCDay()]} ${from.getUTCDate()} \u2013 ` +
    `${WEEKDAYS[to.getUTCDay()]} ${to.getUTCDate()} ${MONTHS[to.getUTCMonth()]} ${to.getUTCFullYear()}`
  );
}

/**
 * Format a `HH:MM` time from an ISO datetime or a bare time string.
 * @param {string} value
 * @returns {string}
 */
export function formatTime(value) {
  return timePart(value);
}
