/**
 * Pure date helpers for Friday -> Monday weekend pairs.
 *
 * All dates are ISO calendar strings (`"YYYY-MM-DD"`) interpreted as UTC
 * midnight, so the logic is independent of the host timezone.
 */

const DAY = 86400000;

/**
 * Parse an ISO calendar date or datetime into a UTC-midnight Date.
 * @param {string} iso
 * @returns {Date}
 */
export function parseISO(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!match) throw new TypeError(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * Format a Date as an ISO calendar date.
 * @param {Date} date
 * @returns {string}
 */
export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Add days to an ISO calendar date.
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const date = parseISO(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

/**
 * Day of week for an ISO calendar date.
 * @param {string} iso
 * @returns {number} 0 = Sunday .. 6 = Saturday
 */
export function dayOfWeek(iso) {
  return parseISO(iso).getUTCDay();
}

/** @param {string} iso @returns {boolean} */
export function isFriday(iso) {
  return dayOfWeek(iso) === 5;
}

/** @param {string} iso @returns {boolean} */
export function isMonday(iso) {
  return dayOfWeek(iso) === 1;
}

/**
 * The Friday that opens the weekend containing `iso`.
 * Works for Friday, Saturday, Sunday and Monday; returns null otherwise.
 * @param {string} iso
 * @returns {string|null}
 */
export function weekendKey(iso) {
  const day = dayOfWeek(iso);
  if (day === 5) return iso;
  if (day === 6) return addDays(iso, -1);
  if (day === 0) return addDays(iso, -2);
  if (day === 1) return addDays(iso, -3);
  return null;
}

/**
 * The next `count` Fridays on or after `reference`.
 * @param {string} reference
 * @param {number} [count]
 * @returns {string[]}
 */
export function upcomingFridays(reference, count = 4) {
  const step = (5 - dayOfWeek(reference) + 7) % 7;
  const first = addDays(reference, step);
  const fridays = [];
  for (let i = 0; i < count; i += 1) fridays.push(addDays(first, i * 7));
  return fridays;
}

/**
 * The Friday/Monday pair for a weekend.
 * @param {string} fridayIso
 * @returns {{ friday: string, monday: string }}
 */
export function weekendPair(fridayIso) {
  if (!isFriday(fridayIso)) throw new TypeError(`Not a Friday: ${fridayIso}`);
  return { friday: fridayIso, monday: addDays(fridayIso, 3) };
}

/**
 * True when `outboundIso` is a Friday and `inboundIso` is the following Monday.
 * @param {string} outboundIso
 * @param {string} inboundIso
 * @returns {boolean}
 */
export function isWeekendPair(outboundIso, inboundIso) {
  return isFriday(outboundIso) && isMonday(inboundIso) && addDays(outboundIso, 3) === inboundIso;
}

export { DAY };
