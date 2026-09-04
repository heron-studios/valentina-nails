import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CATALOG } from '../lib/catalog.ts';
import { generateLocalBotResponse, parseChatFormatting } from '../lib/chat-assistant.ts';

test('generateLocalBotResponse handles empty or unknown question', () => {
  const result = generateLocalBotResponse({
    question: '',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
  });
  assert.ok(result.answer.length > 0);
  assert.ok(result.suggestions.length > 0);
});

test('generateLocalBotResponse answers pricing questions with current selection in Soles', () => {
  const summary = ['Acrílico · largo 4', 'Forma Almendra', 'Espejo ×2 uñas'];
  const total = 346;
  const result = generateLocalBotResponse({
    question: '¿Cuánto cuesta mi set actual y qué incluye?',
    catalog: DEFAULT_CATALOG,
    summary,
    total,
  });

  assert.match(result.answer, /346|S\/\.?\s*346/i);
  assert.match(result.answer, /Acrílico/i);
  assert.match(result.answer, /Almendra/i);
  assert.equal(result.action?.type, 'calculator');
});

test('generateLocalBotResponse answers booking questions and provides booking action', () => {
  const result = generateLocalBotResponse({
    question: '¿Cómo puedo agendar una cita para mis uñas?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 280,
  });

  assert.match(result.answer, /fecha/i);
  assert.match(result.answer, /horario/i);
  assert.equal(result.action?.type, 'booking');
});

test('generateLocalBotResponse answers schedule questions according to catalog', () => {
  const result = generateLocalBotResponse({
    question: '¿Cuáles son los horarios de atención y qué días abren?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
  });

  assert.match(result.answer, /lunes a viernes/i);
  assert.match(result.answer, /sábado/i);
  assert.match(result.answer, /domingo/i);
  assert.ok(DEFAULT_CATALOG.schedule.weekdays.some((time) => result.answer.includes(time)));
});

test('generateLocalBotResponse answers decoration and extras questions accurately', () => {
  const resultDecor = generateLocalBotResponse({
    question: '¿Tienen efecto ojo de gato, cristales o francés y cuánto cuestan?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
  });
  assert.match(resultDecor.answer, /ojo de gato/i);

  const resultExtras = generateLocalBotResponse({
    question: '¿Cuánto cobran por retirar acrílico o reparar una uña rota?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
  });
  assert.match(resultExtras.answer, /retiro/i);
  assert.match(resultExtras.answer, /reposición|reparación/i);
});

test('generateLocalBotResponse handles WhatsApp contact requests with direct URL', () => {
  const result = generateLocalBotResponse({
    question: 'Quiero hablar con Priscila por WhatsApp directamente',
    catalog: DEFAULT_CATALOG,
    summary: ['Gel semipermanente'],
    total: 150,
  });

  assert.equal(result.action?.type, 'whatsapp');
  assert.ok(result.action?.url?.includes(DEFAULT_CATALOG.whatsapp));
});

test('generateLocalBotResponse provides medical disclaimer for fungus, pain or lesions', () => {
  const result = generateLocalBotResponse({
    question: 'Tengo dolor en una uña y creo que tengo hongo o alergia, ¿me pueden poner acrílico?',
    catalog: DEFAULT_CATALOG,
    summary: [],
    total: 0,
  });

  assert.match(result.answer, /salud|médic|profesional/i);
  assert.match(result.answer, /no aplicamos|esperar|recuperación/i);
});

test('parseChatFormatting converts bold and line breaks safely into renderable tokens', () => {
  const raw = 'Hola **amiga**,\n¿Cómo estás?';
  const tokens = parseChatFormatting(raw);
  assert.ok(Array.isArray(tokens));
  assert.ok(tokens.some((token) => token.isBold && token.text === 'amiga'));
});
