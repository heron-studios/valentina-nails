import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSetPrice,
  getNailLengthClass,
  getTechniqueStartingPrice,
  formatLengthSupplement,
  getAnchorPrice,
  createAnchorCatalog,
} from '../lib/pricing.ts';
import { normalizeCatalog, type TechniqueItem, type CatalogItem } from '../lib/catalog.ts';

const mockTechniqueWithLengths: TechniqueItem = {
  id: 'technique-acrylic',
  name: 'Acrílico',
  price: 40,
  note: 'Uñas acrílicas',
  usesLengths: true,
  active: true,
};

const mockTechniqueNoLengths: TechniqueItem = {
  id: 'technique-semi',
  name: 'Semipermanente',
  price: 22,
  note: 'Color duradero',
  usesLengths: false,
  active: true,
};

const mockLengths: CatalogItem[] = [
  { id: 'length-uuid-1', name: 'Largo 1', price: 2, active: true },
  { id: 'length-uuid-2', name: 'Largo 2', price: 4, active: true },
  { id: 'length-uuid-3', name: 'Largo 3', price: 5, active: true },
  { id: 'length-uuid-8', name: 'Largo 8', price: 15, active: true },
];

test('calculateSetPrice adds technique base price and length price when usesLengths is true', () => {
  const selectedLength = mockLengths[2]; // Largo 3: S/ 5
  const total = calculateSetPrice({
    technique: mockTechniqueWithLengths, // Base: S/ 40
    length: selectedLength,
  });

  // Debe ser 40 + 5 = 45
  assert.equal(total, 45);
});

test('calculateSetPrice returns 0 when no technique is selected and no extras', () => {
  const total = calculateSetPrice({
    technique: null,
  });

  assert.equal(total, 0);
});

test('calculateSetPrice adds only extras/decorations when technique is not yet selected', () => {
  const total = calculateSetPrice({
    technique: null,
    decorations: { 'crystal-s': 1 },
    decorationOptions: [{ id: 'crystal-s', name: 'Cristales CH', price: 10, icon: '◆', active: true }],
  });

  assert.equal(total, 10);
});

test('calculateSetPrice ignores length price when technique usesLengths is false', () => {
  const selectedLength = mockLengths[2];
  const total = calculateSetPrice({
    technique: mockTechniqueNoLengths, // Base: S/ 22
    length: selectedLength,
  });

  // Debe ser solo el precio de la técnica: 22
  assert.equal(total, 22);
});

test('calculateSetPrice includes decorations, extra tones, and shape change', () => {
  const total = calculateSetPrice({
    technique: mockTechniqueWithLengths, // 40
    length: mockLengths[0], // + 2
    decorations: { 'crystal-s': 2 }, // 2 * 10 = 20
    decorationOptions: [{ id: 'crystal-s', name: 'Cristales CH', price: 10, icon: '◆', active: true }],
    extraTones: 1, // 1 * 5 = 5
    changeShape: true, // + 20
    extras: {
      extraTone: 5,
      changeShape: 20,
      removalAcrylic: 10,
      removalGel: 5,
      repairAcrylic: 30,
      repairGel: 20,
    },
  });

  // 40 + 2 + 20 + 5 + 20 = 87
  assert.equal(total, 87);
});

test('getTechniqueStartingPrice calculates starting price with minimum length when usesLengths is true', () => {
  const startingPrice = getTechniqueStartingPrice(mockTechniqueWithLengths, mockLengths);
  // 40 + min(2, 4, 5, 15) = 40 + 2 = 42
  assert.equal(startingPrice, 42);

  const semiStartingPrice = getTechniqueStartingPrice(mockTechniqueNoLengths, mockLengths);
  // 22
  assert.equal(semiStartingPrice, 22);
});

test('getNailLengthClass returns correct class len-1 to len-8 regardless of ID format', () => {
  // UUID-based ID
  assert.equal(getNailLengthClass('length-uuid-1', mockLengths), 'len-1');
  assert.equal(getNailLengthClass('length-uuid-3', mockLengths), 'len-3');
  assert.equal(getNailLengthClass('length-uuid-8', mockLengths), 'len-4'); // 4th item in list
  // Fallback when not found
  assert.equal(getNailLengthClass('unknown-id', mockLengths), 'len-3');
});

test('formatLengthSupplement formats 0 as Incluido and > 0 with currency', () => {
  assert.equal(formatLengthSupplement(0), 'Incluido');
  const formatted5 = formatLengthSupplement(5);
  assert.ok(formatted5.startsWith('+'));
  assert.ok(formatted5.includes('5'));
});

test('normalizeCatalog auto-activates usesLengths on extension techniques when lengths exist but all techniques had false', () => {
  const rawFirestoreData = {
    techniques: [
      { id: 'tech-1', name: 'Acrílico ', price: 40, usesLengths: false, active: true, note: '' },
      { id: 'tech-2', name: 'Polygel', price: 46, usesLengths: false, active: true, note: '' },
      { id: 'tech-3', name: 'Semipermanente', price: 22, usesLengths: false, active: true, note: '' },
    ],
    lengths: [
      { id: 'len-1', name: 'Largo 1', price: 2, active: true },
      { id: 'len-2', name: 'Largo 2', price: 4, active: true },
    ],
  };

  const normalized = normalizeCatalog(rawFirestoreData);

  const acrylic = normalized.techniques.find((t) => t.id === 'tech-1');
  const polygel = normalized.techniques.find((t) => t.id === 'tech-2');
  const semi = normalized.techniques.find((t) => t.id === 'tech-3');

  assert.equal(acrylic?.usesLengths, true);
  assert.equal(polygel?.usesLengths, true);
  assert.equal(semi?.usesLengths, false);
});

test('getAnchorPrice increases small prices by 2 Soles (3 -> 5) and 0 remains 0', () => {
  assert.equal(getAnchorPrice(0), 0);
  assert.equal(getAnchorPrice(3), 5);
  assert.equal(getAnchorPrice(5), 7);
  assert.equal(getAnchorPrice(10), 12);
});

test('getAnchorPrice increases medium and base services with a credible discount margin', () => {
  assert.equal(getAnchorPrice(20), 25);
  assert.equal(getAnchorPrice(40), 55);
  assert.equal(getAnchorPrice(150), 180);
  assert.equal(getAnchorPrice(200), 235);
  assert.equal(getAnchorPrice(280), 330);
});

test('createAnchorCatalog applies anchor pricing across all catalog entities', () => {
  const catalog = normalizeCatalog({
    techniques: [{ id: 't1', name: 'Gel', price: 150, usesLengths: false, active: true, note: '' }],
    lengths: [{ id: 'l1', name: 'L1', price: 4, active: true }],
    decorations: [{ id: 'd1', name: 'Deco', price: 3, icon: '✨', active: true }],
  });

  const anchor = createAnchorCatalog(catalog);
  assert.equal(anchor.techniques[0].price, 180);
  assert.equal(anchor.lengths[0].price, 6);
  assert.equal(anchor.decorations[0].price, 5);
  assert.equal(catalog.techniques[0].price, 150); // Original catalog remains unchanged
});
