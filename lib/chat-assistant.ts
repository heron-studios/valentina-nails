import type { SalonCatalog } from './catalog.ts';
import { DEFAULT_AI_CONFIG, type AIConfig, type AIPersonality } from './ai-config.ts';

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

function pickVariant<T>(variants: T[]): T {
  return variants[Math.floor(Math.random() * variants.length)];
}

function formatWithPersonality(
  text: string,
  personality: AIPersonality,
  _botName: string
): string {
  switch (personality) {
    case 'prici_sweet_expert':
      return `${text}\n\n💖 *Con amor, Prici · Tu especialista y asesora en Valentina Nails*`;
    case 'warm_friendly':
      return `${text}\n\n🌸 *¡Cuidamos cada detalle de tus uñitas con todo el cariño!*`;
    case 'technical_expert':
      return `${text}\n\n🔬 *Bioseguridad y balance biomecánico garantizados.*`;
    case 'vanguard_creative':
      return `${text}\n\n⚡ *Diseñado con la vanguardia y el estilo que mereces.*`;
    case 'atelier_luxury':
    default:
      return `${text}\n\n💎 *Atelier de alta costura ungueal.*`;
  }
}

export function generateLocalBotResponse(params: {
  question: string;
  catalog: SalonCatalog;
  summary: string[];
  total: number;
  aiConfig?: AIConfig;
}): { answer: string; action?: ChatAction; suggestions: string[] } {
  const { question, catalog, summary, total, aiConfig = DEFAULT_AI_CONFIG } = params;
  const q = question.toLowerCase().trim();
  const personality = aiConfig.personality || 'prici_sweet_expert';
  const botName = aiConfig.botName || 'Prici';
  const customRules = aiConfig.customRules || DEFAULT_AI_CONFIG.customRules;

  // Initial / empty prompt
  if (!q) {
    if (aiConfig.welcomeMessage) {
      return {
        answer: aiConfig.welcomeMessage,
        suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
      };
    }
    const greetings = [
      `¡Hola hermosa! 💖 Soy ${botName}, tu especialista de uñas en Valentina Nails. Estoy aquí para recomendarte el set perfecto, resolver tus dudas sobre precios en Soles y ayudarte a agendar tu cita soñada.`,
      `¡Bienvenida hermosa! 🌸 Soy ${botName}. Cuéntame qué diseño tienes en mente o permíteme asesorarte para que tus manos luzcan espectaculares.`,
      `¡Hola mi reina! ✨ Soy ${botName}. Estamos listas para crear un set que te va a fascinar. ¿Deseas cotizar, conocer técnicas en tendencia o apartar tu fecha?`,
    ];
    return {
      answer: pickVariant(greetings),
      suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
    };
  }

  // Greeting variations (hola, buenas, etc.)
  if (q === 'hola' || q === 'buenas' || q === 'buenos dias' || q === 'buenas tardes' || q === 'buenas noches') {
    if (personality === 'prici_sweet_expert') {
      const priciGreetings = [
        `¡Hola mi reina! 💖 Soy ${botName}, tu especialista de uñas en Valentina Nails. ¡Qué alegría tenerte aquí! Cuéntame, ¿qué diseño soñado tienes en mente o quieres que te recomiende lo más top para que tus manos luzcan increíbles?`,
        `¡Bienvenida hermosa! 🌸 Soy ${botName}. Me encanta consentir a mis clientas y ayudarlas a elegir la mejor técnica con acabados divinos y súper duraderos. ¿Te gustaría cotizar, ver tendencias o apartar tu horario?`,
        `¡Hola bella! ✨ Soy ${botName}, tu aliada y experta en uñas. Estoy aquí para recomendarte el largo, silueta y decoraciones que mejor te favorezcan, y ayudarte a agendar con la mejor promo web.`,
      ];
      return {
        answer: pickVariant(priciGreetings),
        suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
      };
    }
    if (personality === 'warm_friendly') {
      const friendlyGreetings = [
        `¡Hola hermosa! 🌸 Soy ${botName}. Qué alegría tenerte aquí. Cuéntame, ¿qué estilo de uñitas te gustaría lucir o cómo te puedo consentir hoy?`,
        `¡Bienvenida bella! 💖 Soy ${botName}. Estoy lista para ayudarte con todas tus dudas sobre colores, técnicas, precios y fechas disponibles.`,
      ];
      return {
        answer: pickVariant(friendlyGreetings),
        suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
      };
    }
    if (personality === 'technical_expert') {
      const techGreetings = [
        `Saludos. Soy ${botName}, especialista virtual en ingeniería y salud ungueal de Valentina Nails. ¿En qué parámetro técnico o servicio puedo asistirte?`,
        `Hola. Bienvenido al módulo de consultoría de Valentina Nails. Te oriento en polimerización, técnicas estructurales, tarifas vigentes y agenda.`,
      ];
      return {
        answer: pickVariant(techGreetings),
        suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
      };
    }
    if (personality === 'vanguard_creative') {
      const creativeGreetings = [
        `¡Hola! ⚡ Soy ${botName}. Si buscas diseños que marquen tendencia y eleven tu look, estás en el atelier indicado. ¿Lista para crear arte?`,
        `¡Hey! Bienvenida a Valentina Nails. Soy ${botName}. Hablemos de texturas, siluetas y combinaciones de pasarela para tus manos.`,
      ];
      return {
        answer: pickVariant(creativeGreetings),
        suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
      };
    }
    const luxuryGreetings = [
      `Estimada clienta, le saluda ${botName}. En Valentina Nails diseñamos cada set con estándares de alta costura y precisión anatómica. ¿En qué podemos orientarle hoy?`,
      `Bienvenida a la experiencia Valentina Nails Atelier. Soy ${botName}. Será un honor asesorarle en la elección de su técnica, arquitectura de silueta y reserva.`,
    ];
    return {
      answer: pickVariant(luxuryGreetings),
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
    const medicalVariants = [
      'Por tu seguridad, salud e higiene profesional, **no aplicamos extensiones ni esmaltados** sobre uñas con dolor, infección activa, hongos o lesiones abiertas. Te recomendamos consultar primero con una profesional médica o especialista en dermatología. Una vez que tu uña esté sana, estaremos felices de atenderte.',
      'Tu salud ungueal es nuestra máxima prioridad: si presentas dolor, sospecha de micosis/hongos o alguna lesión abierta, **no aplicamos químicos ni productos** hasta que un profesional de la salud verifique la completa recuperación de la lámina natural. ¡La bioseguridad no se negocia!',
      'En Valentina Nails seguimos un riguroso estándar de bioseguridad. Ante molestias, inflamación o signos de infección/hongos, por lo que **no aplicamos** servicios cosméticos hasta tu completa recuperación. Recomendamos valoración médica previa para cuidar tu bienestar integral.',
    ];
    return {
      answer: pickVariant(medicalVariants),
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

  // 1.5 Reglas del Salón / Estacionamiento / Pagos / Garantía / Políticas
  if (
    q.includes('estacionamiento') ||
    q.includes('cochera') ||
    q.includes('auto') ||
    q.includes('carro') ||
    q.includes('pago') ||
    q.includes('pagar') ||
    q.includes('yape') ||
    q.includes('plin') ||
    q.includes('tarjeta') ||
    q.includes('efectivo') ||
    q.includes('transferencia') ||
    q.includes('garantia') ||
    q.includes('garantía') ||
    q.includes('politica') ||
    q.includes('política') ||
    q.includes('norma') ||
    q.includes('cafe') ||
    q.includes('café') ||
    q.includes('bebida') ||
    q.includes('wifi')
  ) {
    const ruleResponses = [
      `Aquí tienes los datos y políticas vigentes de nuestro salón:\n\n${customRules}`,
      `Con gusto te comparto nuestras facilidades e información de atención:\n\n${customRules}`,
      `Para garantizar tu comodidad durante la visita a Valentina Nails, ten en cuenta:\n\n${customRules}`,
    ];
    return {
      answer: formatWithPersonality(pickVariant(ruleResponses), personality, botName),
      action: { type: 'whatsapp', label: 'Consultar dudas al salón' },
      suggestions: ['¿Cuáles son los horarios?', '¿Cómo agendo cita?', '¿Cuál es mi precio?'],
    };
  }

  // 2. Retiro, Reparaciones y Extras
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
    const extraVariants = [
      `Tarifas de servicios extras y mantenimiento:\n• **Retiro de acrílico:** ${formatMoneySoles(
        e.removalAcrylic,
      )} por uña.\n• **Retiro de gel semi:** ${formatMoneySoles(
        e.removalGel,
      )} por uña.\n• **Reposición de uña rota:** ${formatMoneySoles(
        e.repairAcrylic,
      )} (acrílico) / ${formatMoneySoles(e.repairGel)} (gel).\n• **Cambio de forma:** ${formatMoneySoles(
        e.changeShape,
      )}.\n• **Tonos extra:** ${formatMoneySoles(e.extraTone)} c/u (2 tonos lisos incluidos sin costo).`,
      `Para cuidar la lámina de tu uña realizamos retiro y mantenimiento profesional sin daño químico:\n• **Retiro acrílico:** ${formatMoneySoles(
        e.removalAcrylic,
      )} c/uña\n• **Retiro gel:** ${formatMoneySoles(
        e.removalGel,
      )} c/uña\n• **Reparación o reposición de uña:** ${formatMoneySoles(
        e.repairAcrylic,
      )} en acrílico y ${formatMoneySoles(e.repairGel)} en gel.\n• **Cambio de silueta:** ${formatMoneySoles(
        e.changeShape,
      )}.`,
    ];
    return {
      answer: formatWithPersonality(pickVariant(extraVariants), personality, botName),
      action: { type: 'calculator', label: 'Añadir extras al set' },
      suggestions: ['¿Cómo reservo?', '¿Cuánto cuesta un set completo?', 'Hablar por WhatsApp'],
    };
  }

  // 3. Decoraciones & Cristales
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
    const activeDecors = catalog.decorations.filter((d) => d.active);
    const decorPrices = activeDecors.map((d) => d.price);
    const minDecor = decorPrices.length ? Math.min(...decorPrices) : 3;
    const maxDecor = decorPrices.length ? Math.max(...decorPrices) : 10;
    const popularHighlights = ['Ojo de gato', 'Espejo', 'Aurora', 'Francés', 'Relieve', 'Cristales'];
    const availableHighlights = popularHighlights
      .filter((name) => activeDecors.some((d) => d.name.toLowerCase().includes(name.toLowerCase())))
      .join(', ');

    const decorVariants = [
      `Contamos con más de ${activeDecors.length} decoraciones de lujo aplicadas por uña (${availableHighlights || 'Ojo de gato, Espejo, Aurora'}… con tarifas actuales desde **${formatMoneySoles(minDecor)}** hasta **${formatMoneySoles(maxDecor)}** según el diseño artesanal).\n\nPuedes agregar exactamente la cantidad de uñas decoradas que desees en la calculadora.`,
      `El arte en uñas es nuestra especialidad: ofrecemos ${availableHighlights || 'efectos tornasol, 3D, francesas y cristales'}, desde **${formatMoneySoles(minDecor)}** por uña decorada hasta **${formatMoneySoles(maxDecor)}** para piezas con pedrería o relieves esculturales.\n\nEn el Paso 03 de la calculadora puedes personalizar cuántas uñas llevarán cada efecto.`,
      `¿Buscas brillo o relieve de alta gama? Trabajamos técnicas como **${availableHighlights || 'Ojo de gato y pigmentos cromados'}** con precios vigentes de **${formatMoneySoles(minDecor)}** a **${formatMoneySoles(maxDecor)}** por uña, con sellado UV ultraduradero.`,
    ];
    return {
      answer: formatWithPersonality(pickVariant(decorVariants), personality, botName),
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
    const contactVariants = [
      `Puedes escribirle a Priscila directamente por WhatsApp al **+${catalog.whatsapp}** para resolver consultas personalizadas o coordinar tu llegada al estudio en Saltillo.`,
      `Si prefieres atención directa con Priscila, comunícate con nosotras al WhatsApp **+${catalog.whatsapp}**. Estaremos encantadas de coordinar los detalles de tu cita y responder tus preguntas.`,
      `¡Estamos a un mensaje de distancia! Escríbenos vía WhatsApp al **+${catalog.whatsapp}** para recibir asesoría directa de Priscila o coordinar una cita especial.`,
    ];
    return {
      answer: pickVariant(contactVariants),
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
    const scheduleVariants = [
      `Nuestros horarios de atención son:\n• **Lunes a Viernes:** ${weekdays}\n• **Sábados:** ${saturday}\n• **Domingos:** Permanecemos cerradas para descanso.\n\nPuedes revisar los cupos disponibles en vivo seleccionando una fecha en el calendario.`,
      `Organizamos nuestra agenda con turnos dedicados para brindarte una atención relajante y sin apuros:\n• **Lunes a Viernes:** ${weekdays}\n• **Sábados:** ${saturday}\n• **Domingos:** cerradas para descanso.\n\nRevisa las fechas y cupos disponibles en vivo seleccionando tu día preferido.`,
    ];
    return {
      answer: formatWithPersonality(pickVariant(scheduleVariants), personality, botName),
      action: { type: 'booking', label: 'Ver fechas disponibles' },
      suggestions: ['¿Cómo agendo cita?', '¿Cuánto dura el servicio?', 'Hablar por WhatsApp'],
    };
  }

  // 5.5 Guía interactiva o tutorial
  if (
    q.includes('guia') ||
    q.includes('guía') ||
    q.includes('recorrido') ||
    q.includes('tutorial') ||
    q.includes('como funciona') ||
    q.includes('cómo funciona') ||
    q.includes('como uso') ||
    q.includes('cómo uso')
  ) {
    return {
      answer:
        '¡Con gusto! Nuestro **recorrido interactivo** te enseña paso a paso a personalizar tu técnica, silueta, largo, decoraciones y reservar en minutos.',
      action: { type: 'tour', label: '✨ Iniciar recorrido guiado' },
      suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
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
    const bookingVariants = [
      'Para agendar tu cita: 1) Diseña tu set en la calculadora o elige un modelo de la galería. 2) Toca **“Elegir fecha”**. 3) Escribe tu nombre y teléfono. 4) Elige fecha y horario disponible. 5) Confirma por WhatsApp para asegurar tu espacio.',
      'El proceso de reserva es rápido y garantizado: configuras tu técnica y diseño en el Studio, seleccionas la **fecha** y el **horario** disponible que mejor se ajuste a tu día en la pestaña **Disponibilidad** y confirmas tu cita en segundos.',
      'Apartar tu turno es sumamente sencillo: navega por los 4 pasos de la calculadora, presiona **“Elegir fecha de cita”**, selecciona tu **fecha** y **horario** preferido, ingresa tus datos de contacto y confirma de inmediato.',
    ];
    return {
      answer: formatWithPersonality(pickVariant(bookingVariants), personality, botName),
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
    const lengthsSummary =
      activeLengths.length > 0
        ? `Puedes elegir desde el **${activeLengths[0].name}** hasta el **${activeLengths[activeLengths.length - 1].name}**.`
        : 'Puedes personalizar la silueta y largo a tu gusto.';

    const shapeVariants = [
      `Trabajamos las siluetas más elegantes: **${shapes}**.\n${lengthsSummary} La forma se adapta a la anatomía de tu mano para estilizar tus dedos.`,
      `Cada silueta tiene un propósito estético:\n• **Almendra / Almond:** Estiliza y alarga dedos de forma natural.\n• **Coffin / Bailarina:** Sofisticación moderna y gran resistencia estructural.\n• **Cuadrada:** Simetría parisina limpia y atemporal.\n• **Stiletto:** Impacto dramático y vanguardia.\n${lengthsSummary}`,
      `Personalizamos la arquitectura de tu uña según tus actividades diarias. Las opciones activas en catálogo son **${shapes}** con largos que van de moderados a esculturales.`,
    ];
    return {
      answer: formatWithPersonality(pickVariant(shapeVariants), personality, botName),
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
    const techniqueVariants = [
      'Te explicamos las tres opciones para que elijas con total confianza:\n• **Acrílico:** Para quienes buscan extensiones, largo visible y máxima resistencia estructural.\n• **Gel semipermanente:** Brillo espejo y color impecable durante 15 a 21 días sobre el largo natural de tu uña.\n• **Rubber gel:** Base gruesa y flexible que nivela estrías, fortalece uñas quebradizas y permite que crezcan sanas.',
      '¿Cuál técnica se adapta mejor a tu ritmo de vida?\n• **Acrílico Escultural:** Ideal si deseas añadir longitud visible y resistencia insuperable.\n• **Rubber Base Gel:** Si tus uñas naturales se quiebran con facilidad o tienen desniveles, la base rubber aporta grosor elástico y nutrición.\n• **Gel Semipermanente:** Para quien prefiere mantener su uña corta natural con un brillo cristalino intacto por 3 semanas.',
      'Diferencias clave entre nuestras técnicas:\n1. **Acrílico:** Mayor versatilidad para crear formas Coffin o Stiletto y extensiones de impacto.\n2. **Gel Semi:** Aplicación ligera y natural, ideal para el día a día en oficina o estudio.\n3. **Rubber Gel:** El balance perfecto entre fortalecimiento y aspecto hipernatural con curvatura C reforzada.',
    ];
    return {
      answer: formatWithPersonality(pickVariant(techniqueVariants), personality, botName),
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
    const galleryVariants = [
      'Contamos con una galería de **trabajos reales** listos para replicar en el salón. Si te gusta un diseño de nuestra inspiración, puedes seleccionarlo directamente y agendarlo con su precio cerrado.',
      'En nuestra pestaña **Galería** encontrarás sets reales elaborados por Priscila. Puedes tocar el botón “Replicar este set” para cargar automáticamente el diseño y agendar tu fecha.',
      '¡Inspírate con nuestro portafolio de autor! Cada foto muestra el resultado real en estudio con iluminación profesional. Selecciona cualquier modelo para llevarlo a tu cita.',
    ];
    return {
      answer: formatWithPersonality(pickVariant(galleryVariants), personality, botName),
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
      const pricingWithSelection = [
        `Tu selección actual tiene un precio estimado de **${formatMoneySoles(total)}**.\nIncluye:\n${summary
          .map((item) => `• ${item}`)
          .join('\n')}\n¿Deseas elegir la fecha para tu cita o agregar algún detalle más?`,
        `Cotización activa en tiempo real: **${formatMoneySoles(total)}**.\nDetalle de tu set:\n${summary
          .map((item) => `• ${item}`)
          .join('\n')}\nPuedes apartar tu horario cuando gustes tocando el botón de abajo.`,
      ];
      return {
        answer: formatWithPersonality(pickVariant(pricingWithSelection), personality, botName),
        action: { type: 'calculator', label: 'Ajustar mi set' },
        suggestions: ['¿Cómo reservo esta cita?', 'Ver decoraciones disponibles', 'Hablar por WhatsApp'],
      };
    }
    const activeTechs = catalog.techniques.filter((t) => t.active);
    const startingPrices = activeTechs
      .slice(0, 3)
      .map((t) => `**${t.name.trim()}** desde **${formatMoneySoles(t.price)}**`)
      .join(', ');

    const generalPriceVariants = [
      `Nuestros servicios inician desde ${startingPrices}. En técnicas con largo (como Acrílico o Polygel), el precio se calcula sumando la técnica base más el suplemento del largo y decoraciones que elijas.`,
      `Tarifas base vigentes: ${startingPrices}. Los complementos por largo, siluetas especiales y decoraciones artesanales se calculan de manera transparente en la calculadora sin costos ocultos.`,
      `Manejamos precios claros y justos en Soles: ${startingPrices}. Puedes armar tu combinación personalizada en el Studio y ver el precio exacto actualizado al instante.`,
    ];
    return {
      answer: formatWithPersonality(pickVariant(generalPriceVariants), personality, botName),
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
    const careVariants = [
      'Con el cuidado adecuado, el acrílico y el rubber gel tienen una duración óptima de **3 a 4 semanas** antes del mantenimiento, y el gel semipermanente de **2 a 3 semanas**. Te recomendamos no usar las uñas como herramientas, aplicar aceite de cutícula diario y no arrancarlas en casa.',
      'Durabilidad garantizada:\n• **Acrílico & Rubber:** Retoque recomendado cada 21 a 28 días.\n• **Gel Semipermanente:** Duración de 15 a 21 días con brillo inalterable.\nTips clave: usa guantes para tareas con cloro, hidrata tus cutículas con vitamina E y no arranques el producto.',
      'Para que tu set luzca impecable por un mes completo:\n1. Aplica aceite nutritivo en cutículas todas las noches.\n2. Al teclear o abrir paquetes, usa las yemas de tus dedos, no el ápice.\n3. Programa tu retoque entre la tercera y cuarta semana para proteger tu uña natural.',
    ];
    return {
      answer: formatWithPersonality(pickVariant(careVariants), personality, botName),
      suggestions: ['¿Cuánto cuesta un retiro?', '¿Cómo agendo retoque?', 'Hablar por WhatsApp'],
    };
  }

  // 12. Fallback general
  const fallbackVariants = [
    'Puedo orientarte con las técnicas (acrílico, gel o rubber), explicarte las decoraciones, darte tu presupuesto estimado en Soles o ayudarte a elegir fecha para tu cita.',
    'Estoy a tu servicio para resolver dudas sobre precios, siluetas, tipos de retiro, horarios disponibles o inspirarte con las últimas tendencias.',
    'Cuéntame qué idea tienes para tus uñas: puedo calcular tu presupuesto al instante, explicarte cada técnica o guiarte en tu reserva.',
  ];
  return {
    answer: formatWithPersonality(pickVariant(fallbackVariants), personality, botName),
    suggestions: ['¿Qué técnica me conviene?', '¿Cuáles son los horarios?', '¿Cuál es mi precio?'],
  };
}

/**
 * Advanced Generative AI Assistant call using Google Gemini API if a key is provided in AIConfig.
 * Falls back seamlessly to the enhanced local stochastic engine if no key or on network failure.
 */
export async function generateAIAssistantResponse(params: {
  question: string;
  catalog: SalonCatalog;
  summary: string[];
  total: number;
  aiConfig?: AIConfig;
}): Promise<{ answer: string; action?: ChatAction; suggestions: string[] }> {
  const { question, catalog, summary, total, aiConfig } = params;
  const apiKey = aiConfig?.geminiApiKey?.trim();

  // If no Gemini API Key is configured, use local engine directly
  if (!apiKey) {
    return generateLocalBotResponse(params);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const config = aiConfig || DEFAULT_AI_CONFIG;
    const systemPrompt = `Eres ${config.botName || 'Valentina Atelier IA'}, asistente virtual exclusiva de Valentina Nails by Priscila en Saltillo/Perú.
Personalidad: ${config.personality || 'atelier_luxury'}.
Reglas y políticas del salón:
${config.customRules || ''}
Resumen actual de la clienta: ${summary.length > 0 ? summary.join(', ') : 'Ninguno aún'}.
Precio actual: ${total > 0 ? `S/ ${total}` : 'No calculado aún'}.
Catálogo de precios y servicios disponible: ${JSON.stringify(catalog.techniques.map((t) => ({ name: t.name, price: t.price })))}.
Responde de forma concisa, educada, inspiradora y adaptada al tono. Menciona precios siempre en Soles (S/). Si preguntan por citas, anímalas a agendar en la web o confirmar por WhatsApp.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nPregunta de la clienta: ${question}` }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 250,
            temperature: 0.7,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText && typeof generatedText === 'string') {
        return {
          answer: generatedText.trim(),
          suggestions: ['¿Cuáles son los horarios?', '¿Cómo agendo cita?', '¿Cuál es mi precio?'],
        };
      }
    }
  } catch {
    // Graceful fallback to local engine on any network or API error
  }

  return generateLocalBotResponse(params);
}
