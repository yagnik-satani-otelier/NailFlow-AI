'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SERVICES, validatePayload, estimatePrice, buildPrompt, parseModelJson, enforceQuoteGuardrails, fallbackResult, formatRupees } = require('../lib/core');

test('validates quote inputs and bounds untrusted strings', () => {
  const p = validatePayload('quote', { service:'Gel overlay', price:799, clientName:'Riya'.repeat(40), language:'nope', minutes:9999, complexity:'intricate' });
  assert.equal(p.language, 'English');
  assert.equal(p.clientName.length, 70);
  assert.equal(p.minutes, 600);
  assert.throws(() => validatePayload('quote', { service:'', price:100 }), /Choose a service/);
  assert.throws(() => validatePayload('quote', { service:'Gel', price:-1 }), /Price must be/);
  assert.throws(() => validatePayload('quote', { service:'Gel', price:null }), /Price must be/);
});

test('estimates are deterministic and explain the components', () => {
  const service = DEFAULT_SERVICES.find(s => s.id === 'extensions');
  const estimate = estimatePrice(service, 'intricate', true, false);
  assert.equal(estimate.total, 1749);
  assert.equal(estimate.minutes, 130);
  assert.equal(estimate.base + estimate.complexityAdd + estimate.addon + estimate.rushAdd, estimate.total);
});

test('quote prompt instructs model not to change the approved price or invent availability', () => {
  const prompt = buildPrompt('quote', { service:'Gel overlay', price:999, clientName:'Riya', studioName:'Demo Studio' });
  assert.match(prompt, /MUST NOT be changed/);
  assert.match(prompt, /Do not say a slot is booked or available/);
  assert.match(prompt, /₹999/);
});

test('parses bounded quote output and strips accidental code fences', () => {
  const result = parseModelJson('```json\n{"whatsapp":"Reply","caption":"Caption","aftercare":["One","Two","Three"],"followup":"Follow up","reviewNotes":"Review"}\n```', 'quote');
  assert.equal(result.whatsapp, 'Reply');
  assert.equal(result.aftercare.length, 3);
  assert.throws(() => parseModelJson('{"whatsapp":"only"}', 'quote'), /missing required/);
});

test('fallback copy is clearly generic and never claims a booking is confirmed', () => {
  const result = fallbackResult('quote', { service:'Gel overlay', price:799, clientName:'Riya', studioName:'Demo Studio' });
  assert.match(result.whatsapp, /estimate, not a confirmed booking/i);
  assert.match(result.reviewNotes, /Template mode/);
});

test('content prompt and output are bounded', () => {
  const p = validatePayload('content', { service:'Festive nail art', style:'green and gold', channel:'Instagram' });
  assert.equal(p.channel, 'Instagram');
  const prompt = buildPrompt('content', p);
  assert.match(prompt, /Do not invent results/);
  const out = parseModelJson('{"caption":"A look","shortStory":"New look","hashtags":["#Nails","#Beauty"],"callToAction":"DM"}', 'content');
  assert.equal(out.hashtags.length, 2);
});

test('Gujarati fallback uses Gujarati copy and keeps booking status unconfirmed', () => {
  const result = fallbackResult('quote', { service:'Gel overlay', price:799, clientName:'Riya', studioName:'Demo Studio', language:'Gujarati' });
  assert.match(result.whatsapp, /નમસ્તે/);
  assert.match(result.whatsapp, /બુકિંગ કન્ફર્મ નથી/);
  assert.match(result.aftercare[0], /પ્રોડક્ટ/);
});


test('post-generation quote guardrails replace invented amounts and neutralize common booking claims', () => {
  const guarded = enforceQuoteGuardrails({
    whatsapp: 'Your appointment is confirmed. The price is ₹9,999 and we have an available slot; the deposit is $50.',
    caption: 'A lovely set', aftercare: ['Use cuticle oil', 'Avoid picking'], followup: 'Checking in', reviewNotes: ''
  }, { service: 'Gel overlay', price: 1299, clientName: 'Riya' });
  assert.match(guarded.whatsapp, /₹1,299/);
  assert.doesNotMatch(guarded.whatsapp, /₹9,999|\$50/);
  assert.doesNotMatch(guarded.whatsapp, /appointment is confirmed/i);
  assert.doesNotMatch(guarded.whatsapp, /we have an available slot/i);
  assert.match(guarded.whatsapp, /not confirmed/i);
  assert.match(guarded.reviewNotes, /Review/i);
});

test('quote guardrails inject the approved estimate when the model omits a currency amount', () => {
  const guarded = enforceQuoteGuardrails({ whatsapp: 'Thanks for your enquiry.', caption: 'Set', aftercare: ['One', 'Two'], followup: '', reviewNotes: '' }, { service: 'Classic manicure', price: 399 });
  assert.match(guarded.whatsapp, /₹399/);
  assert.match(guarded.whatsapp, /not a confirmed booking/i);
});

test('INR formatting follows Indian digit grouping', () => {
  assert.equal(formatRupees(1299), '₹1,299');
  assert.equal(formatRupees(-99), '₹0');
});

test('model parser rejects unknown generation modes', () => {
  assert.throws(() => parseModelJson('{"caption":"hello"}', 'unknown'), /Unsupported generation mode/);
});
