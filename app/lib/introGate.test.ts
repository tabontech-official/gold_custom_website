/**
 * Self-check for the first-load intro's session gate.
 * No test runner in this project, so: `node app/lib/introGate.test.ts`
 *
 * The regression worth guarding is "intro on every navigation" — a gate that
 * fails open turns a one-second brand moment into a full-screen overlay
 * between every page, which is why the blocked-storage case is asserted as
 * hard as the happy path.
 */
import assert from 'node:assert/strict';
import {INTRO_SESSION_KEY, introGateScript} from './introGate.ts';

/** Runs the emitted source against a stub storage + document. */
function run(sessionStorage: Record<string, unknown>) {
  const documentElement = {dataset: {} as {intro?: string}};
  // eslint-disable-next-line no-new-func
  const fn = new Function('sessionStorage', 'document', introGateScript());
  fn(sessionStorage, {documentElement});
  return documentElement.dataset.intro;
}

const store = new Map<string, string>();
const working = {
  getItem: (k: string) => (store.has(k) ? store.get(k) : null),
  setItem: (k: string, v: string) => void store.set(k, v),
};

// First load of a session: nothing stamped, so the intro is allowed to run —
// and the visit is recorded so the next load is silent.
assert.equal(run(working), undefined, 'first load must not be marked seen');
assert.equal(
  store.get(INTRO_SESSION_KEY),
  '1',
  'first load must record the visit',
);

// Second load in the same session: stamped before paint, so CSS hides the
// overlay without it ever showing a frame.
assert.equal(run(working), 'seen', 'second load must be marked seen');

// Storage unavailable (private mode, sandboxed iframe, quota). Must fail to
// "skip", never to "show every time".
const blocked = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};
assert.equal(run(blocked), 'seen', 'blocked storage must skip the intro');

// A setItem that throws AFTER a successful read is the quota case; it must
// still skip rather than leaving the flag unset and replaying forever.
const readOnly = {
  getItem: () => null,
  setItem() {
    throw new Error('quota');
  },
};
assert.equal(run(readOnly), 'seen', 'unwritable storage must skip the intro');

console.log('introGate: all assertions passed');
