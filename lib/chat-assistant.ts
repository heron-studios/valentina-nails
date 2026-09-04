import type { SalonCatalog } from './catalog';

export type ChatActionType = 'booking' | 'gallery' | 'whatsapp' | 'calculator' | 'tour';

export type ChatAction = {
  type: ChatActionType;
  label: string;
  url?: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  action?: ChatAction;
  timestamp?: number;
};

export type FormattedTextToken = {
  text: string;
  isBold?: boolean;
  isLineBreak?: boolean;
};

export const formatMoneySoles = (value: number): string =>
  new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 0,
  }).format(value);

export function parseChatFormatting(content: string): FormattedTextToken[] {
  if (!content) return [];
  const lines = content.split('\n');
  const tokens: FormattedTextToken[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      tokens.push({ text: '\n', isLineBreak: true });
    }

    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ text: line.substring(lastIndex, match.index) });
      }
      tokens.push({ text: match[1], isBold: true });
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      tokens.push({ text: line.substring(lastIndex) });
    }
  });

  return tokens;
}

export function generateLocalBotResponse(params: {
  question: string;
  catalog: SalonCatalog;
  summary: string[];
  total: number;
}): { answer: string; action?: ChatAction; suggestions: string[] } {
  const { question, catalog, summary, total } = params;
  const q = question.toLowerCase().trim();

  if (!q) {
    return {
      answer: '¡Hola! Soy tu asistente de Valentina Nails by Priscila. Estoy aquí para resolver tus dudas sobre técnicas, precios en Soles, decoraciones, horarios y cómo agendar tu cita.',
      suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
    };
  }

  // 1. Salud / Advertencia médica
  if (
    q.includes('dolor') ||
    q.includes('duele') ||
    q.includes('hongo') ||
    q.includes('micosis') ||
    q.includes('alergia') ||
    q.includes('lesion') ||
    q.includes('lesión') ||
    q.includes('infect') ||
    q.includes('sangr')
  ) {
    return {
      answer:
        'Por tu seguridad, salud e higiene profesional, **no aplicamos extensiones ni esmaltados** sobre uñas con dolor, infección activa, hongos o lesiones abiertas. Te recomendamos consultar primero con una profesional médica o especialista en dermatología. Una vez que tu uña esté sana, estaremos felices de atenderte.',
      action: {
        type: 'whatsapp',
        label: 'Consultar caso por WhatsApp',
        url: `https://wa.me/${catalog.whatsapp}?text=${encodeURIComponent(
          'Hola Priscila, quisiera hacer una consulta sobre el estado de mis uñas antes de reservar.',
        )}`,
      },
      suggestions: ['¿Cuánto cuesta un retiro?', '¿Qué cuidados recomiendan?', 'Hablar por WhatsApp'],
    };
  }

  // 2. Retiro, Reparaciones y Extras (prioridad sobre precio general)
  if (
    q.includes('retiro') ||
    q.includes('quitar') ||
    q.includes('reparac') ||
    q.includes('reparar') ||
    q.includes('reposic') ||
    q.includes('rot') ||
    q.includes('romp') ||
    q.includes('cambio de forma')
  ) {
    const e = catalog.extras;
    return {
      answer: `Tarifas de servicios extras y mantenimiento:\n• **Retiro de acrílico:** ${formatMoneySoles(
        e.removalAcrylic,
      )} por uña.\n• **Retiro de gel semi:** ${formatMoneySoles(
        e.removalGel,
      )} por uña.\n• **Reposición de uña rota:** ${formatMoneySoles(
        e.repairAcrylic,
      )} (acrílico) / ${formatMoneySoles(e.repairGel)} (gel).\n• **Cambio de forma:** ${formatMoneySoles(
        e.changeShape,
      )}.\n• **Tonos extra:** ${formatMoneySoles(e.extraTone)} c/u (2 tonos lisos incluidos sin costo).`,
      action: { type: 'calculator', label: 'Añadir extras al set' },
      suggestions: ['¿Cómo reservo?', '¿Cuánto cuesta un set completo?', 'Hablar por WhatsApp'],
    };
  }

  // 3. Decoraciones & Cristales (prioridad sobre precio general)
  if (
    q.includes('decorac') ||
    q.includes('cristal') ||
    q.includes('espejo') ||
    q.includes('aurora') ||
    q.includes('azucar') ||
    q.includes('azúcar') ||
    q.includes('ojo de gato') ||
    q.includes('cat eye') ||
    q.includes('3d') ||
    q.includes('francés') ||
    q.includes('frances') ||
    q.includes('dije') ||
    q.includes('glitter') ||
    q.includes('boomer') ||
    q.includes('baby boomer') ||
    q.includes('hoja de oro')
  ) {
    return {
      answer:
        'Contamos con más de 20 decoraciones de lujo aplicadas por uña:\n• **Efectos:** Ojo de gato, Espejo, Aurora, Azúcar (desde S/ 3 a S/ 5).\n• **Arte:** Francés, Blooming, Relieve, 3D y Baby boomer (desde S/ 3 a S/ 10).\n• **Joyería:** Cristales y uñas full cristal (desde S/ 10 a S/ 55).\n\nPuedes agregar exactamente la cantidad de uñas decoradas que desees en la calculadora.',
      action: { type: 'calculator', label: 'Elegir decoraciones' },
      suggestions: ['Ver fotos de diseños', '¿Cuál es mi precio?', '¿Cómo agendo?'],
    };
  }

  // 4. WhatsApp / Priscila / Contacto / Ubicación
  if (
    q.includes('whatsapp') ||
    q.includes('telefono') ||
    q.includes('teléfono') ||
    q.includes('contacto') ||
    q.includes('hablar') ||
    q.includes('persona') ||
    q.includes('humano') ||
    q.includes('priscila') ||
    q.includes('ubicac') ||
    q.includes('donde') ||
    q.includes('dónde') ||
    q.includes('direcci')
  ) {
    return {
      answer: `Puedes escribirle a Priscila directamente por WhatsApp al **+${catalog.whatsapp}** para resolver consultas personalizadas o coordinar tu llegada al estudio en Saltillo.`,
      action: {
        type: 'whatsapp',
        label: '💬 Chatear por WhatsApp',
        url: `https://wa.me/${catalog.whatsapp}?text=${encodeURIComponent(
          'Hola Priscila, te escribo desde la web de Valentina Nails para consultar una duda.',
        )}`,
      },
      suggestions: ['¿Cuáles son los horarios?', '¿Cómo agendo cita?', '¿Cuál es mi precio?'],
    };
  }

  // 5. Horarios y Días de atención
  if (
    q.includes('horario') ||
    q.includes('dias') ||
    q.includes('días') ||
    q.includes('abren') ||
    q.includes('hora') ||
    q.includes('sabado') ||
    q.includes('sábado') ||
    q.includes('domingo')
  ) {
    const weekdays = catalog.schedule.weekdays.join(', ');
    const saturday = catalog.schedule.saturday.join(', ');
    return {
      answer: `Nuestros horarios de atención son:\n• **Lunes a Viernes:** ${weekdays}\n• **Sábados:** ${saturday}\n• **Domingos:** Permanecemos cerradas para descanso.\n\nPuedes revisar los cupos disponibles en vivo seleccionando una fecha en el calendario.`,
      action: { type: 'booking', label: 'Ver fechas disponibles' },
      suggestions: ['¿Cómo agendo cita?', '¿Cuánto dura el servicio?', 'Hablar por WhatsApp'],
    };
  }

  // 6. Citas / Agenda / Reservar
  if (
    q.includes('cita') ||
    q.includes('reserv') ||
    q.includes('agend') ||
    q.includes('apartar') ||
    q.includes('turno') ||
    q.includes('disponib')
  ) {
    return {
      answer:
        'Para agendar tu cita: 1) Diseña tu set en la calculadora o elige un modelo de la galería. 2) Toca **“Elegir fecha”**. 3) Escribe tu nombre y teléfono. 4) Elige fecha y horario disponible. 5) Confirma por WhatsApp para asegurar tu espacio.',
      action: { type: 'booking', label: '📅 Ir a la agenda de citas' },
      suggestions: ['¿Cuáles son los horarios?', '¿Cuál es mi precio?', 'Hablar por WhatsApp'],
    };
  }

  // 7. Formas y Largos
  if (
    q.includes('forma') ||
    q.includes('silueta') ||
    q.includes('largo') ||
    q.includes('cuadrada') ||
    q.includes('almendra') ||
    q.includes('coffin') ||
    q.includes('stiletto')
  ) {
    const shapes = catalog.shapes.filter((s) => s.active).map((s) => s.name).join(', ');
    const activeLengths = catalog.lengths.filter((l) => l.active);
    const lengthsSummary = activeLengths.length > 0
      ? `Puedes elegir desde el **${activeLengths[0].name}** hasta el **${activeLengths[activeLengths.length - 1].name}**.`
      : 'Puedes personalizar la silueta y largo a tu gusto.';
    return {
      answer: `Trabajamos las siluetas más elegantes: **${shapes}**.\n${lengthsSummary} La forma se adapta a la anatomía de tu mano para estilizar tus dedos.`,
      action: { type: 'calculator', label: 'Probar formas en el diseño' },
      suggestions: ['¿Qué técnica me conviene?', 'Ver fotos de diseños', '¿Cuál es mi precio?'],
    };
  }

  // 8. Técnicas: Acrílico, Gel, Rubber
  if (
    q.includes('gel') ||
    q.includes('acril') ||
    q.includes('acríl') ||
    q.includes('rubber') ||
    q.includes('tecnica') ||
    q.includes('técnica') ||
    q.includes('diferencia') ||
    q.includes('conviene')
  ) {
    return {
      answer:
        'Te explicamos las tres opciones para que elijas con total confianza:\n• **Acrílico:** Para quienes buscan extensiones, largo visible y máxima resistencia estructural.\n• **Gel semipermanente:** Brillo espejo y color impecable durante 15 a 21 días sobre el largo natural de tu uña.\n• **Rubber gel:** Base gruesa y flexible que nivela estrías, fortalece uñas quebradizas y permite que crezcan sanas.',
      action: { type: 'calculator', label: 'Seleccionar mi técnica' },
      suggestions: ['¿Cuáles son los precios?', 'Ver formas y largos', '¿Cómo reservo?'],
    };
  }

  // 9. Fotos / Diseños listos / Galería
  if (
    q.includes('foto') ||
    q.includes('diseño') ||
    q.includes('modelo') ||
    q.includes('ejemplo') ||
    q.includes('galeria') ||
    q.includes('galería') ||
    q.includes('inspir') ||
    q.includes('trabajo')
  ) {
    return {
      answer:
        'Contamos con una galería de **trabajos reales** listos para replicar en el salón. Si te gusta un diseño de nuestra inspiración, puedes seleccionarlo directamente y agendarlo con su precio cerrado.',
      action: { type: 'gallery', label: 'Ver galería de trabajos' },
      suggestions: ['¿Cómo reservo una cita?', '¿Cuánto cuesta un diseño?', 'Ver decoraciones disponibles'],
    };
  }

  // 10. Cotización general o preguntas de precios
  if (
    q.includes('precio') ||
    q.includes('costo') ||
    q.includes('cuesta') ||
    q.includes('vale') ||
    q.includes('cotiz') ||
    q.includes('presupuesto') ||
    q.includes('tarifa')
  ) {
    if (summary.length > 0 && total > 0) {
      return {
        answer: `Tu selección actual tiene un precio estimado de **${formatMoneySoles(total)}**.\nIncluye:\n${summary
          .map((item) => `• ${item}`)
          .join('\n')}\n¿Deseas elegir la fecha para tu cita o agregar algún detalle más?`,
        action: { type: 'calculator', label: 'Ajustar mi set' },
        suggestions: ['¿Cómo reservo esta cita?', 'Ver decoraciones disponibles', 'Hablar por WhatsApp'],
      };
    }
    const activeTechs = catalog.techniques.filter((t) => t.active);
    const startingPrices = activeTechs.slice(0, 3).map((t) => `**${t.name.trim()}** desde **${formatMoneySoles(t.price)}**`).join(', ');
    return {
      answer: `Nuestros servicios inician desde ${startingPrices}. En técnicas con largo (como Acrílico o Polygel), el precio se calcula sumando la técnica base más el suplemento del largo y decoraciones que elijas.`,
      action: { type: 'calculator', label: 'Calcular mi precio' },
      suggestions: ['¿Qué técnica me conviene?', 'Ver decoraciones y extras', '¿Cómo reservo?'],
    };
  }

  // 11. Cuidados y durabilidad
  if (
    q.includes('cuid') ||
    q.includes('duraci') ||
    q.includes('dura') ||
    q.includes('mantenim') ||
    q.includes('retoc')
  ) {
    return {
      answer:
        'Con el cuidado adecuado, el acrílico y el rubber gel tienen una duración óptima de **3 a 4 semanas** antes del mantenimiento, y el gel semipermanente de **2 a 3 semanas**. Te recomendamos no usar las uñas como herramientas, aplicar aceite de cutícula diario y no arrancarlas en casa.',
      suggestions: ['¿Cuánto cuesta un retiro?', '¿Cómo agendo retoque?', 'Hablar por WhatsApp'],
    };
  }

  // 12. Fallback general
  return {
    answer:
      'Puedo orientarte con las técnicas (acrílico, gel o rubber), explicarte las decoraciones, darte tu presupuesto estimado en Soles o ayudarte a elegir fecha para tu cita.',
    suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
  };
}
