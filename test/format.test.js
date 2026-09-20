import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDate, formatDateRange, formatPrice, formatTime, datePart, timePart } from '../src/core/format.js';

test('formatPrice renders two-decimal EUR amounts', () => {
  assert.equal(formatPrice(55.21), '\u20ac55.21');
  assert.equal(formatPrice(30), '\u20ac30.00');
  assert.equal(formatPrice(0), '\u20ac0.00');
  assert.equal(formatPrice(undefined), '\u2014');
});

test('formatDate renders an English short date', () => {
  assert.equal(formatDate('2026-09-25'), 'Fri 25 Sep 2026');
  assert.equal(formatDate('2026-01-01'), 'Thu 1 Jan 2026');
});

test('formatDateRange compresses a shared month', () => {
  assert.equal(formatDateRange('2026-09-25', '2026-09-28'), 'Fri 25 \u2013 Mon 28 Sep 2026');
});

test('formatDateRange falls back to full dates across months', () => {
  assert.equal(formatDateRange('2026-09-25', '2026-10-05'), 'Fri 25 Sep 2026 \u2013 Mon 5 Oct 2026');
});

test('datePart / timePart / formatTime parse ISO datetimes', () => {
  assert.equal(datePart('2026-09-25T07:25:00'), '2026-09-25');
  assert.equal(timePart('2026-09-25T07:25:00'), '07:25');
  assert.equal(formatTime('2026-09-28T19:10:00'), '19:10');
  assert.equal(formatTime('07:25'), '07:25');
});
