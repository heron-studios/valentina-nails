import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoneyPEN,
  formatBookingDatePEN,
  sanitizePhoneNumber,
  generateQuoteShareText,
} from '../lib/format-utils.ts';

test('formatMoneyPEN formats correctly in Peruvian Soles', () => {
  const formatted = formatMoneyPEN(350);
  assert.ok(formatted.includes('350'));
  assert.ok(formatted.includes('S/') || formatted.includes('PEN'));
});

test('formatBookingDatePEN formats date in Spanish without timezone shift', () => {
  const result = formatBookingDatePEN('2026-09-04');
  assert.match(result, /se[p]?tiembre/i);
  assert.match(result, /2026/);
});

test('sanitizePhoneNumber validates and cleans digits', () => {
  const valid = sanitizePhoneNumber(' +52 844 663-8497 ');
  assert.equal(valid.cleanPhone, '528446638497');
  assert.equal(valid.isValid, true);

  const invalid = sanitizePhoneNumber('123');
  assert.equal(invalid.isValid, false);
});

test('generateQuoteShareText generates a formatted shareable quote', () => {
  const shareText = generateQuoteShareText({
    summary: ['Acrílico · largo 3', 'Forma Almendra', 'Espejo ×2 uñas'],
    total: 320,
    whatsapp: '528446638497',
  });

  assert.match(shareText, /Valentina Nails/i);
  assert.match(shareText, /Acrílico/i);
  assert.match(shareText, /320/);
});
