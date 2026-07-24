/**
 * Self-check for the appointment input parser (trust-boundary validation).
 * Run: node --experimental-strip-types app/lib/appointments.test.ts
 * No framework — asserts and exits non-zero on failure.
 */
import assert from 'node:assert';
import {parseAppointment} from './appointments.server.ts';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

// Valid booking passes and trims/normalizes.
const ok = parseAppointment(
  fd({
    name: '  John   Smith ',
    email: 'JOHN@Example.COM',
    date: tomorrow,
    productTitle: '10K Cuban',
    productHandle: 'cuban',
    productId: 'gid://x',
    variantInfo: 'SKU1',
  }),
);
assert(ok.data && !ok.errors, 'valid input should parse');
assert.equal(ok.data.name, 'John Smith', 'name collapsed/trimmed');
assert.equal(ok.data.email, 'john@example.com', 'email lowercased');

// Missing name.
assert(parseAppointment(fd({name: 'A', email: 'a@b.co', date: tomorrow})).errors?.name);

// Bad email.
assert(parseAppointment(fd({name: 'Jane Doe', email: 'nope', date: tomorrow})).errors?.email);

// Past date rejected.
assert(
  parseAppointment(fd({name: 'Jane Doe', email: 'a@b.co', date: yesterday})).errors?.date,
  'past date should error',
);

// Same-day (today) allowed.
const today = new Date().toISOString().slice(0, 10);
assert(
  !parseAppointment(fd({name: 'Jane Doe', email: 'a@b.co', date: today})).errors?.date,
  'today should be allowed',
);

// Missing/garbage date.
assert(parseAppointment(fd({name: 'Jane Doe', email: 'a@b.co', date: 'soon'})).errors?.date);

console.log('appointments parser: all checks passed');
