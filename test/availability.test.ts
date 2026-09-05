import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateKey,
  parseTimeStringToMinutes,
  getDayAvailabilityStats,
  getNextAvailableSlot,
} from '../lib/availability.ts';

const mockSchedule = {
  weekdays: ['10:00', '12:00', '14:00', '16:00', '18:00'],
  saturday: ['10:00', '13:00', '16:00'],
};

test('formatDateKey formats Date object to YYYY-MM-DD accurately', () => {
  const date = new Date(2026, 8, 5); // 5 Sep 2026
  assert.equal(formatDateKey(date), '2026-09-05');
});

test('parseTimeStringToMinutes converts HH:mm string to minutes from midnight', () => {
  assert.equal(parseTimeStringToMinutes('10:00'), 600);
  assert.equal(parseTimeStringToMinutes('14:30'), 870);
  assert.equal(parseTimeStringToMinutes('00:00'), 0);
});

test('getDayAvailabilityStats marks Sundays as closed', () => {
  const sunday = new Date(2026, 8, 6); // 6 Sep 2026 is Sunday
  assert.equal(sunday.getDay(), 0);

  const stats = getDayAvailabilityStats(sunday, {}, mockSchedule);
  assert.equal(stats.isClosed, true);
  assert.equal(stats.freeSlots, 0);
  assert.equal(stats.totalSlots, 0);
});

test('getDayAvailabilityStats accurately detects fully booked days vs free days', () => {
  const weekday = new Date(2026, 8, 7); // 7 Sep 2026 is Monday
  const key = formatDateKey(weekday);

  // Partial occupancy
  const partial = getDayAvailabilityStats(weekday, { [key]: ['10:00', '12:00'] }, mockSchedule);
  assert.equal(partial.isClosed, false);
  assert.equal(partial.totalSlots, 5);
  assert.equal(partial.occupiedSlots, 2);
  assert.equal(partial.freeSlots, 3);
  assert.equal(partial.isFullyBooked, false);
  assert.deepEqual(partial.freeTimes, ['14:00', '16:00', '18:00']);

  // Fully booked
  const full = getDayAvailabilityStats(weekday, { [key]: mockSchedule.weekdays }, mockSchedule);
  assert.equal(full.isFullyBooked, true);
  assert.equal(full.freeSlots, 0);
});

test('getNextAvailableSlot finds free slot today if future slots exist', () => {
  // Monday at 11:00 AM
  const mockNow = new Date(2026, 8, 7, 11, 0, 0);
  const key = formatDateKey(mockNow);

  // 10:00 is past, 12:00 is occupied
  const occupied = { [key]: ['12:00'] };
  const next = getNextAvailableSlot(occupied, mockSchedule, mockNow);

  assert.ok(next !== null);
  assert.equal(next.isToday, true);
  assert.equal(next.time, '14:00');
  assert.equal(next.daysUntil, 0);
});

test('getNextAvailableSlot skips to next working day when today is fully booked or past', () => {
  // Saturday afternoon at 17:00 (all Saturday slots 10:00, 13:00, 16:00 are past)
  const saturdayLate = new Date(2026, 8, 5, 17, 0, 0);
  assert.equal(saturdayLate.getDay(), 6);

  // Next day is Sunday (closed), so it should jump to Monday 7 Sep
  const next = getNextAvailableSlot({}, mockSchedule, saturdayLate);

  assert.ok(next !== null);
  assert.equal(next.isToday, false);
  assert.equal(next.daysUntil, 2); // 2 days ahead (Monday)
  assert.equal(next.dateKey, '2026-09-07');
  assert.equal(next.time, '10:00');
  assert.equal(next.totalFreeSlotsForDay, 5);
});
