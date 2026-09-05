import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAIAppointmentAdvice } from '../lib/ai-advisor.ts';
import { DEFAULT_CATALOG, type SalonCatalog } from '../lib/catalog.ts';

test('generateAIAppointmentAdvice creates personalized greeting with client name', () => {
  const advice = generateAIAppointmentAdvice({
    clientName: 'Camila',
    techniqueId: 'acrylic',
    lengthId: 'length-4',
    shapeId: 'coffin',
    decorations: { 'decor-glitter': 2 },
    catalog: DEFAULT_CATALOG,
    total: 350,
  });

  assert.ok(advice.clientGreeting.includes('Camila'));
  assert.ok(advice.designCritique.title.length > 0);
  assert.ok(advice.designCritique.description.length > 0);
  assert.ok(advice.nailTrivia.fact.length > 0);
  assert.ok(advice.careProtocol.tips.length >= 3);
});

test('generateAIAppointmentAdvice reflects dynamic catalog price changes in future suggestions', () => {
  // Create a modified catalog with custom prices
  const customCatalog: SalonCatalog = structuredClone(DEFAULT_CATALOG);
  const auroraItem = customCatalog.decorations.find((d) => d.id === 'aurora');
  if (auroraItem) {
    auroraItem.price = 99; // Updated future price
  }
  const acrylicTech = customCatalog.techniques.find((t) => t.id === 'acrylic');
  if (acrylicTech) {
    acrylicTech.price = 450; // Updated technique price
  }

  const advice = generateAIAppointmentAdvice({
    clientName: 'Valeria',
    techniqueId: 'acrylic',
    lengthId: 'length-2',
    shapeId: 'almond',
    decorations: {},
    catalog: customCatalog,
    total: 450,
  });

  // Verify that any suggested service mentioning Aurora uses S/ 99, never obsolete static prices
  const auroraSuggestion = advice.futureCombinations.suggestedServices.find((s) =>
    s.name.toLowerCase().includes('aurora'),
  );
  if (auroraSuggestion) {
    assert.ok(
      auroraSuggestion.estimatedPriceText.includes('99'),
      `Expected Aurora price to reflect custom catalog S/ 99, got: ${auroraSuggestion.estimatedPriceText}`,
    );
  }

  // Verify suggestions are derived from active catalog services
  assert.ok(advice.futureCombinations.suggestedServices.length > 0);
  advice.futureCombinations.suggestedServices.forEach((service) => {
    assert.ok(service.estimatedPriceText.startsWith('S/'), 'Prices should be formatted in Soles');
  });
});

test('generateAIAppointmentAdvice adapts care tips specifically for long nails (largo 5+)', () => {
  const longNailAdvice = generateAIAppointmentAdvice({
    clientName: 'Sofia',
    techniqueId: 'acrylic',
    lengthId: 'length-7',
    shapeId: 'stiletto',
    decorations: { 'decor-espejo': 4 },
    catalog: DEFAULT_CATALOG,
    total: 420,
  });

  const tipsJoined = longNailAdvice.careProtocol.tips.join(' ').toLowerCase();
  assert.ok(
    tipsJoined.includes('yemas') ||
      tipsJoined.includes('teclear') ||
      tipsJoined.includes('palanca') ||
      tipsJoined.includes('herramienta'),
    'Long nails should have specific biomechanical handling advice',
  );
});

test('generateAIAppointmentAdvice adapts trivia specifically to selected shape (coffin / almond)', () => {
  const coffinAdvice = generateAIAppointmentAdvice({
    clientName: 'Lucia',
    techniqueId: 'acrylic',
    lengthId: 'length-3',
    shapeId: 'coffin',
    decorations: {},
    catalog: DEFAULT_CATALOG,
    total: 300,
  });

  const triviaJoined = (coffinAdvice.nailTrivia.title + coffinAdvice.nailTrivia.fact).toLowerCase();
  assert.ok(
    triviaJoined.includes('coffin') || triviaJoined.includes('ballerina') || triviaJoined.includes('bailarina'),
    'Coffin shape trivia should reference coffin / ballerina origins',
  );
});
