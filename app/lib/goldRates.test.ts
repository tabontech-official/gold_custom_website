// Run with: node --test app/lib/goldRates.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {lastCloseGram, timeAgo} from './goldRates.ts';

test('timeAgo reads in the largest sensible unit', () => {
  const now = Date.parse('2026-07-31T12:00:00Z');
  const at = (iso: string) => timeAgo(iso, now);

  assert.equal(at('2026-07-31T11:59:30Z'), 'just now');
  assert.equal(at('2026-07-31T11:20:00Z'), '40 minutes ago');
  assert.equal(at('2026-07-31T02:00:00Z'), '10 hours ago');
  assert.equal(at('2026-07-28T12:00:00Z'), '3 days ago');
  // A quote stamped slightly ahead of us must not read "in 5 minutes".
  assert.equal(at('2026-07-31T12:05:00Z'), 'just now');
});

test('lastCloseGram takes the newest day and converts troy ounces', () => {
  // Shape and units straight off the real timeseries endpoint.
  const body = {
    unit: 'toz',
    rates: {
      '2026-07-29': {metals: {gold: 4066.34}},
      '2026-07-28': {metals: {gold: 4028.67}},
    },
  };

  // 4066.34 / 31.1034768 — the 29th, not the 28th, and not still in ounces.
  assert.ok(Math.abs(lastCloseGram(body)! - 130.7365) < 0.001);
  assert.equal(
    lastCloseGram({unit: 'g', rates: {'2026-07-29': {metals: {gold: 130.5}}}}),
    130.5,
  );
  // A dead or empty series must read as "no direction", never as a 100% drop.
  assert.equal(lastCloseGram({}), null);
  assert.equal(
    lastCloseGram({unit: 'toz', rates: {'2026-07-29': {metals: {}}}}),
    null,
  );
});
