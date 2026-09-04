const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const allowedOrigins = [
  'https://heron-studios.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

exports.nailAssistant = onRequest({
  region: 'us-central1',
  cors: allowedOrigins,
  secrets: [GROQ_API_KEY],
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 2,
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  const rawMessages = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const messages = rawMessages.slice(-10).flatMap((message) => {
    const role = message?.role === 'assistant' ? 'assistant' : message?.role === 'user' ? 'user' : null;
    const content = typeof message?.content === 'string' ? message.content.trim().slice(0, 700) : '';
    return role && content ? [{ role, content }] : [];
  });
  if (!messages.length) {
    response.status(400).json({ error: 'Escribe una pregunta.' });
    return;
  }

  const selection = Array.isArray(request.body?.context?.selection)
    ? request.body.context.selection.map(String).slice(0, 12).join(', ')
    : 'sin selección todavía';
  const estimatedPrice = Number(request.body?.context?.estimatedPrice) || 0;
  const systemPrompt = `Eres la asistente virtual exclusiva de Valentina Nails by Priscila.
Responde siempre en español con calidez, sofisticación y amabilidad (máximo 120 palabras).
IMPORTANTE: La moneda oficial del salón es en SOLES (PEN / S/.). NUNCA menciones pesos mexicanos ni otra divisa.

Contexto actual de la clienta:
- Selección actual: ${selection}.
- Presupuesto estimado actual: S/ ${estimatedPrice} Soles.

Conocimiento del salón:
- Técnicas: Acrílico (desde S/ 280 según largo 1 al 8), Gel semipermanente (S/ 150), Rubber gel reforzador (S/ 200).
- Formas: Cuadrada, Almendra, Coffin, Stiletto.
- Decoraciones por uña: Ojo de gato, Espejo, Aurora, Azúcar, Francés, 3D, Cristales (desde S/ 3 hasta S/ 55).
- Extras: Retiro acrílico S/ 10/uña, retiro gel S/ 5/uña, reposición acrílico S/ 30/uña, reposición gel S/ 20/uña, cambio de forma S/ 20.
- Horarios: Lunes a Viernes (09:00, 13:00, 16:00, 20:00), Sábados (09:00, 13:00), Domingos cerrado.
- Citas: La clienta elige su set, toca "Elegir fecha", llena sus datos y confirma el cupo por WhatsApp.
- Contacto y ubicación: Saltillo, WhatsApp +528446638497 (Priscila).
- Seguridad médica: No realizar extensiones ni esmaltado si hay dolor, infección, heridas o sospecha de hongos; indicar acudir a un especialista de la salud.`;

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.45,
        max_completion_tokens: 220,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      }),
    });
    if (!groqResponse.ok) throw new Error(`Groq respondió ${groqResponse.status}`);
    const data = await groqResponse.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('Respuesta vacía');
    response.json({ answer });
  } catch (error) {
    console.error('Groq request failed', error instanceof Error ? error.message : error);
    response.status(502).json({ error: 'El asistente no está disponible en este momento.' });
  }
});
