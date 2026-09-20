import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  dayOfWeek,
  isFriday,
  isMonday,
  isWeekendPair,
  upcomingFridays,
  weekendKey,
  weekendPair,
} from '../src/core/weekend.js';

test('isFriday / isMonday detect weekdays', () => {
  assert.equal(isFriday('2026-09-25'), true);
  assert.equal(isMonday('2026-09-28'), true);
  assert.equal(isFriday('2026-09-26'), false);
  assert.equal(isMonday('2026-09-25'), false);
});

test('weekendKey maps Fri..Mon to the opening Friday', () => {
  assert.equal(weekendKey('2026-09-25'), '2026-09-25'); // Friday
  assert.equal(weekendKey('2026-09-26'), '2026-09-25'); // Saturday
  assert.equal(weekendKey('2026-09-27'), '2026-09-25'); // Sunday
  assert.equal(weekendKey('2026-09-28'), '2026-09-25'); // Monday
  assert.equal(weekendKey('2026-09-29'), null); // Tuesday
});

test('upcomingFridays returns Fridays on or after the reference', () => {
  assert.deepEqual(upcomingFridays('2026-09-25', 3), ['2026-09-25', '2026-10-02', '2026-10-09']); // Friday
  assert.deepEqual(upcomingFridays('2026-09-26', 2), ['2026-10-02', '2026-10-09']); // Saturday
  assert.deepEqual(upcomingFridays('2026-09-27', 2), ['2026-10-02', '2026-10-09']); // Sunday
  assert.deepEqual(upcomingFridays('2026-09-28', 2), ['2026-10-02', '2026-10-09']); // Monday
});

test('upcomingFridays rolls over month and year boundaries', () => {
  assert.deepEqual(upcomingFridays('2026-12-28', 2), ['2027-01-01', '2027-01-08']);
  assert.deepEqual(upcomingFridays('2026-02-25', 2), ['2026-02-27', '2026-03-06']);
});

test('weekendPair returns the following Monday', () => {
  assert.deepEqual(weekendPair('2026-09-25'), { friday: '2026-09-25', monday: '2026-09-28' });
  assert.throws(() => weekendPair('2026-09-26'), /Not a Friday/);
});

test('isWeekendPair accepts only Friday -> following Monday', () => {
  assert.equal(isWeekendPair('2026-09-25', '2026-09-28'), true);
  assert.equal(isWeekendPair('2026-09-25', '2026-09-29'), false);
  assert.equal(isWeekendPair('2026-09-26', '2026-09-28'), false);
  assert.equal(isWeekendPair('2026-09-25', '2026-10-05'), false);
});

test('addDays and dayOfWeek are UTC-stable across the year boundary', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(dayOfWeek('2026-09-25'), 5);
});
