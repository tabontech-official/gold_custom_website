/**
 * Self-check for the financing lead rules.
 * No test runner in this project, so: `node app/lib/financingLead.test.ts`
 */
import assert from 'node:assert/strict';
import {
  LEAD_TAG,
  budgetForPrice,
  customerForLead,
  normalizePhone,
  parseFinancingLead,
} from './financingLead.ts';

// Phone: every way a US shopper types it ends up as one E.164 number.
for (const typed of [
  '(555) 123-4567',
  '555-123-4567',
  '555.123.4567',
  '5551234567',
  '1 555 123 4567',
  '+1 (555) 123-4567',
]) {
  assert.equal(normalizePhone(typed), '+15551234567', typed);
}
// An explicit country code is kept as typed.
assert.equal(normalizePhone('+52 33 1234 5678'), '+523312345678');
// Too short, too long, or not a number.
assert.equal(normalizePhone('123-4567'), null);
assert.equal(normalizePhone('555123456789'), null);
assert.equal(normalizePhone('call me'), null);

// Budget starts at the piece's own price band.
assert.equal(budgetForPrice(320), 'Under $500');
assert.equal(budgetForPrice(500), '$500–$1,000');
assert.equal(budgetForPrice(1899.99), '$1,000–$2,500');
assert.equal(budgetForPrice(12000), '$5,000+');
assert.equal(budgetForPrice(undefined), undefined);
assert.equal(budgetForPrice(0), undefined);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const valid = {
  name: '  Maria   Lopez ',
  phone: '(555) 123-4567',
  budget: '$1,000–$2,500',
  partner: 'Acima Leasing',
  product: '14K Cuban Chain — 22" — $1,899.99',
};

assert.deepEqual(parseFinancingLead(form(valid)), {
  ok: true,
  lead: {
    name: 'Maria Lopez',
    phone: '+15551234567',
    budget: '$1,000–$2,500',
    // Unticked box: no consent, and nothing assumes otherwise.
    consent: false,
    partner: 'Acima Leasing',
    product: '14K Cuban Chain — 22" — $1,899.99',
  },
});
const consented = parseFinancingLead(form({...valid, consent: 'on'}));
assert.equal(consented.ok && consented.lead.consent, true);

// Every problem at once, so the shopper fixes the form in one pass.
const empty = parseFinancingLead(form({}));
assert.equal(empty.ok, false);
assert.deepEqual(Object.keys(!empty.ok ? empty.errors : {}).sort(), [
  'budget',
  'name',
  'phone',
]);
// A budget that isn't one of the choices is not accepted.
assert.equal(parseFinancingLead(form({...valid, budget: '$1'})).ok, false);

// ── Customer for the lead (fake Admin API) ──────────────────────────────────
type Call = {query: string; variables: Record<string, any>};
const fakeAdmin = (replies: ((call: Call) => any)[]) => {
  const calls: Call[] = [];
  const request = async (query: string, variables: Record<string, any>) => {
    const call = {query, variables};
    calls.push(call);
    return {data: replies[calls.length - 1](call)};
  };
  return {request, calls};
};
const lead = {name: 'Maria Lopez', phone: '+15551234567'};
const created = (id: string) => ({
  customerCreate: {customer: {id}, userErrors: []},
});

{
  // New shopper: one phone-only customer, tagged.
  const admin = fakeAdmin([
    () => ({customers: {nodes: []}}),
    () => created('c1'),
  ]);
  assert.equal(await customerForLead(admin.request, lead), 'c1');
  assert.deepEqual(admin.calls[1].variables.input, {
    firstName: 'Maria',
    lastName: 'Lopez',
    tags: [LEAD_TAG],
    phone: '+15551234567',
  });
}
{
  // Returning shopper: matched on the number, tagged, nothing created.
  const admin = fakeAdmin([
    () => ({customers: {nodes: [{id: 'old'}]}}),
    () => ({}),
  ]);
  assert.equal(await customerForLead(admin.request, lead), 'old');
  assert.equal(admin.calls.length, 2);
  assert.match(admin.calls[1].query, /tagsAdd/);
  assert.deepEqual(admin.calls[1].variables, {id: 'old', tags: [LEAD_TAG]});
}
{
  // The live failure: "+1 545…" is not a real area code. The lead must still
  // become a customer — without the phone, the number kept in the note.
  const admin = fakeAdmin([
    () => ({customers: {nodes: []}}),
    () => ({
      customerCreate: {
        customer: null,
        userErrors: [{field: ['phone'], message: 'Phone is invalid'}],
      },
    }),
    () => created('c2'),
  ]);
  const messi = {name: 'MESSI', phone: '+15454564565'};
  assert.equal(await customerForLead(admin.request, messi), 'c2');
  const retry = admin.calls[2].variables.input;
  assert.equal(retry.phone, undefined);
  assert.equal(retry.firstName, 'MESSI');
  assert.deepEqual(retry.tags, [LEAD_TAG]);
  assert.match(retry.note, /\+15454564565/);
}
{
  // Any other refusal is not retried with a phone-less copy.
  const admin = fakeAdmin([
    () => ({customers: {nodes: []}}),
    () => ({
      customerCreate: {
        customer: null,
        userErrors: [{field: ['firstName'], message: 'x'}],
      },
    }),
  ]);
  assert.equal(await customerForLead(admin.request, lead), undefined);
  assert.equal(admin.calls.length, 2);
}

console.log('financingLead.test.ts: ok');
