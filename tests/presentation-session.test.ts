import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationClock, formatPresentationTime, presentationSlideNumber } from '../src/core/presentation-session';

test('presentation clock excludes paused time and resets in either running state', () => {
  let now = 100;
  const clock = createPresentationClock(() => now);
  now = 2500; assert.equal(clock.elapsed(), 2400);
  clock.toggle(); now = 20000; assert.equal(clock.elapsed(), 2400);
  clock.toggle(); now = 23000; assert.equal(clock.elapsed(), 5400);
  clock.reset(); now = 24000; assert.equal(clock.elapsed(), 1000);
  clock.toggle(); clock.reset(); now = 90000;
  assert.equal(clock.elapsed(), 0); assert.equal(clock.running, false);
});

test('timer is readable across minute and hour boundaries without negative values', () => {
  assert.equal(formatPresentationTime(-100), '00:00');
  assert.equal(formatPresentationTime(59999), '00:59');
  assert.equal(formatPresentationTime(60000), '01:00');
  assert.equal(formatPresentationTime(3600000), '60:00');
});

test('typed slide navigation is one-based, bounded and rejects malformed input', () => {
  assert.equal(presentationSlideNumber('1', 5), 0);
  assert.equal(presentationSlideNumber(' 05 ', 5), 4);
  for (const value of ['0', '6', '-1', '1.5', '2x', '', 'Infinity', '9007199254740992'])
    assert.equal(presentationSlideNumber(value, 5), null, value);
});
