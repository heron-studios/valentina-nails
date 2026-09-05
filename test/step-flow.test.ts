import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isStepUnlocked,
  isStepCompleted,
} from '../lib/step-validator.ts';
import {
  DEFAULT_AI_CONFIG,
  normalizeAIConfig,
  type AIConfig,
} from '../lib/ai-config.ts';
import {
  generateLocalBotResponse,
} from '../lib/chat-assistant.ts';
import { DEFAULT_CATALOG } from '../lib/catalog.ts';

// -------------------------------------------------------------
// 1. CALCULATOR STEP VALIDATION TESTS
// -------------------------------------------------------------

test('Step 0 (Técnica) is always unlocked', () => {
  const unlocked = isStepUnlocked(0, { technique: '', shape: '', length: '' });
  assert.equal(unlocked, true);
});

test('Step 1 (Silueta & Largo) is locked when no technique is chosen', () => {
  const unlocked = isStepUnlocked(1, { technique: '', shape: 'almond', length: 'length-3' });
  assert.equal(unlocked, false);
});

test('Step 1 (Silueta & Largo) is unlocked when technique is chosen', () => {
  const unlocked = isStepUnlocked(1, { technique: 'acrylic', shape: 'almond', length: 'length-3' });
  assert.equal(unlocked, true);
});

test('Step 2 (Diseños) is locked if Step 0 or Step 1 is incomplete', () => {
  // Missing technique
  assert.equal(isStepUnlocked(2, { technique: '', shape: 'almond', length: 'length-3' }), false);
  // Missing shape
  assert.equal(isStepUnlocked(2, { technique: 'acrylic', shape: '', length: 'length-3' }), false);
});

test('Step 2 (Diseños) is unlocked when technique and shape are chosen', () => {
  const unlocked = isStepUnlocked(2, { technique: 'acrylic', shape: 'almond', length: 'length-3' });
  assert.equal(unlocked, true);
});

test('Step 3 (Extras) is unlocked only after technique, shape, and length are configured', () => {
  assert.equal(isStepUnlocked(3, { technique: '', shape: '', length: '' }), false);
  assert.equal(isStepUnlocked(3, { technique: 'acrylic', shape: 'coffin', length: 'length-4' }), true);
});

test('isStepCompleted accurately identifies completed stages', () => {
  // Step 0 completed if technique selected
  assert.equal(isStepCompleted(0, { technique: '', shape: 'almond', length: 'length-3' }), false);
  assert.equal(isStepCompleted(0, { technique: 'acrylic', shape: 'almond', length: 'length-3' }), true);

  // Step 1 completed if technique + shape chosen
  assert.equal(isStepCompleted(1, { technique: 'acrylic', shape: '', length: 'length-3' }), false);
  assert.equal(isStepCompleted(1, { technique: 'acrylic', shape: 'coffin', length: 'length-3' }), true);
});

// -------------------------------------------------------------
// 2. AI CONFIGURATION & NORMALIZATION TESTS (PRICI BOT)
// -------------------------------------------------------------

test('DEFAULT_AI_CONFIG is named Prici with sweet expert seller personality', () => {
  assert.equal(DEFAULT_AI_CONFIG.botName, 'Prici');
  assert.equal(DEFAULT_AI_CONFIG.personality, 'prici_sweet_expert');
  assert.ok(DEFAULT_AI_CONFIG.welcomeMessage.includes('Prici'));
});

test('normalizeAIConfig falls back to Prici defaults when input is empty or null', () => {
  const config = normalizeAIConfig(null);
  assert.equal(config.botName, 'Prici');
  assert.equal(config.personality, 'prici_sweet_expert');
  assert.ok(config.customRules.length > 0);
});

test('normalizeAIConfig preserves custom salon rules and personality', () => {
  const custom: Partial<AIConfig> = {
    botName: 'Prici',
    personality: 'prici_sweet_expert',
    customRules: 'Estacionamiento privado gratuito en calle Real 123. Aceptamos Yape y Plin.',
  };
  const normalized = normalizeAIConfig(custom);
  assert.equal(normalized.botName, 'Prici');
  assert.equal(normalized.personality, 'prici_sweet_expert');
  assert.ok(normalized.customRules.includes('Estacionamiento privado'));
});

// -------------------------------------------------------------
// 3. AI NON-REPETITIVE STOCHASTIC RESPONSES & PERSONALITY TESTS
// -------------------------------------------------------------

test('generateLocalBotResponse generates distinct varied responses for the same question', () => {
  const params = {
    question: '¿Qué técnica me conviene?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
    aiConfig: DEFAULT_AI_CONFIG,
  };

  const responses = new Set<string>();
  // Ask the same question 6 times
  for (let i = 0; i < 6; i++) {
    const res = generateLocalBotResponse(params);
    responses.add(res.answer);
  }

  // With a multi-variant generative engine, we must receive at least 2 distinct variations
  assert.ok(
    responses.size >= 2,
    `Expected at least 2 distinct response variations, but got only ${responses.size}`,
  );
});

test('generateLocalBotResponse injects custom salon rules when relevant', () => {
  const config: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    customRules: 'Aceptamos Yape, Plin y transferencias sin comisión. Contamos con cochera propia.',
  };

  const res = generateLocalBotResponse({
    question: '¿Tienen estacionamiento o cochera?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
    aiConfig: config,
  });

  const lower = res.answer.toLowerCase();
  assert.ok(
    lower.includes('cochera') || lower.includes('estacionamiento') || lower.includes('yape'),
    `Expected response to inject custom salon rules, got: ${res.answer}`,
  );
});

test('generateLocalBotResponse adapts tone to selected personality', () => {
  // Test Warm Friendly personality
  const friendlyConfig: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    personality: 'warm_friendly',
  };

  const friendlyRes = generateLocalBotResponse({
    question: 'hola',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
    aiConfig: friendlyConfig,
  });

  // Test Atelier Luxury personality
  const luxuryConfig: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    personality: 'atelier_luxury',
  };

  const luxuryRes = generateLocalBotResponse({
    question: 'hola',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
    aiConfig: luxuryConfig,
  });

  // Answers should reflect distinct conversational tones
  assert.notEqual(friendlyRes.answer, luxuryRes.answer);
});
