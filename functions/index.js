const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const allowedOrigins = [
  'https://heron-studios.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
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
  const systemPrompt = `Eres la asistente virtual de Valentina Nails by Priscila. Responde siempre en español, con calidez y en no más de 100 palabras. Ayuda a elegir servicios de uñas y a usar la página. No inventes disponibilidad, diagnósticos médicos ni garantías. Para dolor, alergias, hongos o lesiones, recomienda consultar a una profesional de salud. La selección actual es: ${selection}. Precio estimado actual: $${estimatedPrice} MXN. La reserva se completa eligiendo fecha y hora y enviando la confirmación por WhatsApp.`;

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
