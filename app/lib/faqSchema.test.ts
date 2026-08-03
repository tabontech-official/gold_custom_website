/**
 * Self-check for the product FAQ metafield → FAQPage JSON-LD path.
 * No test runner in this project, so: `node app/lib/faqSchema.test.ts`
 *
 * This path silently broke once already: the metafield was parsed for
 * rendering but the schema was never emitted, so the assertions below care
 * mostly about "authored FAQs produce valid FAQPage, everything else produces
 * nothing" — the gate that keeps generated filler out of structured data.
 */
import assert from 'node:assert/strict';
import {buildFaqJsonLd, parseFaqMetafield} from './faqs.ts';

// The metafield is authored as schema.org FAQPage — the common case.
const authored = JSON.stringify({
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is this solid gold?',
      acceptedAnswer: {'@type': 'Answer', text: 'Yes, solid 14K.'},
    },
  ],
});
assert.deepEqual(parseFaqMetafield(authored), [
  {question: 'Is this solid gold?', answer: 'Yes, solid 14K.'},
]);

// Tooling has also written the looser shapes; both must survive.
assert.deepEqual(parseFaqMetafield('[{"q":"Ships when?","a":"2 days."}]'), [
  {question: 'Ships when?', answer: '2 days.'},
]);
assert.deepEqual(
  parseFaqMetafield('{"faqs":[{"question":"Sizing?","answer":"Runs true."}]}'),
  [{question: 'Sizing?', answer: 'Runs true.'}],
);

// Anything unusable returns null so the caller falls back to generated FAQs
// AND skips the schema. A `[]` here would emit an empty FAQPage instead.
assert.equal(parseFaqMetafield(null), null);
assert.equal(parseFaqMetafield(''), null);
assert.equal(parseFaqMetafield('not json'), null);
assert.equal(parseFaqMetafield('{"mainEntity":[]}'), null);
// Half-filled entries are dropped; an entry needs both sides to be an answer.
assert.equal(parseFaqMetafield('[{"q":"No answer","a":"   "}]'), null);

// The emitted graph has to be a valid FAQPage: Google rejects a Question
// without an acceptedAnswer, and an LLM reading it gets a dangling question.
const jsonLd = buildFaqJsonLd([{question: 'Q1', answer: 'A1'}]);
assert.equal(jsonLd['@context'], 'https://schema.org');
assert.equal(jsonLd['@type'], 'FAQPage');
assert.deepEqual(jsonLd.mainEntity, [
  {
    '@type': 'Question',
    name: 'Q1',
    acceptedAnswer: {'@type': 'Answer', text: 'A1'},
  },
]);

// Round-trip: whatever the metafield held must survive into the schema.
const roundTripped = buildFaqJsonLd(parseFaqMetafield(authored)!);
assert.equal(roundTripped.mainEntity[0].name, 'Is this solid gold?');
assert.equal(
  roundTripped.mainEntity[0].acceptedAnswer.text,
  'Yes, solid 14K.',
);

console.log('faqSchema: all assertions passed');
