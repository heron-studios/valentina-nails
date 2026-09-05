import type { SalonCatalog } from './catalog.ts';
import { formatMoneyPEN } from './format-utils.ts';
import { DEFAULT_AI_CONFIG, type AIConfig } from './ai-config.ts';

export type AIAppointmentAdvice = {
  clientGreeting: string;
  designCritique: {
    title: string;
    description: string;
    highlights: string[];
  };
  nailTrivia: {
    title: string;
    fact: string;
    historicalContext: string;
  };
  futureCombinations: {
    title: string;
    recommendation: string;
    suggestedServices: Array<{
      name: string;
      estimatedPriceText: string;
    }>;
    retouchTimeframe: string;
  };
  careProtocol: {
    title: string;
    tips: string[];
    urgencyWarning: string;
  };
};

export type GenerateAdviceParams = {
  clientName: string;
  techniqueId: string;
  lengthId?: string;
  shapeId?: string;
  decorations: Record<string, number>;
  extraTones?: number;
  changeShape?: boolean;
  removalAcrylic?: number;
  bookingDate?: string;
  bookingTime?: string;
  catalog: SalonCatalog;
  total: number;
  aiConfig?: AIConfig;
};

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateAIAppointmentAdvice(params: GenerateAdviceParams): AIAppointmentAdvice {
  const {
    clientName,
    techniqueId,
    lengthId,
    shapeId = 'almond',
    decorations,
    catalog,
    aiConfig = DEFAULT_AI_CONFIG,
  } = params;

  const name = clientName.trim() || 'Clienta Atelier';
  const personality = aiConfig.personality || 'atelier_luxury';
  const botName = aiConfig.botName || 'Valentina Atelier IA';

  // Extract catalog entities dynamically
  const technique = catalog.techniques.find((t) => t.id === techniqueId) || catalog.techniques[0];
  const lengthObj = catalog.lengths.find((l) => l.id === lengthId);
  const shape = catalog.shapes.find((s) => s.id === shapeId) || catalog.shapes[1];

  const lengthNumber = lengthObj ? parseInt(lengthObj.name.replace(/\D/g, ''), 10) || 3 : 3;
  const isLongNails = lengthNumber >= 5;

  // Active decorations selected
  const activeDecorations = Object.entries(decorations || {})
    .filter(([_, count]) => count > 0)
    .map(([decorId, count]) => {
      const decorItem = catalog.decorations.find((d) => d.id === decorId);
      return {
        id: decorId,
        name: decorItem ? decorItem.name : 'Efecto artesanal',
        price: decorItem ? decorItem.price : 5,
        count,
      };
    });

  // 1. GREETING ADAPTED TO PERSONALITY & VARIANTS
  let clientGreeting = '';
  if (personality === 'prici_sweet_expert') {
    const priciGreetings = [
      `¡Hola hermosa ${name}! 💖 Soy ${botName}, tu especialista de uñas en Valentina Nails. ¡Me fascinó tu elección! Analicé cada detalle de tu set para darte mis mejores recomendaciones de experta.`,
      `¡Bienvenida bella ${name}! 🌸 Soy ${botName}. Tu set tiene un balance divino que va a estilizar tus manos al máximo. Aquí tienes mi consultoría especial preparada con todo mi cariño.`,
    ];
    clientGreeting = pickOne(priciGreetings);
  } else if (personality === 'warm_friendly') {
    const warmGreetings = [
      `¡Hola hermosa ${name}! 🌸 Soy ${botName}. ¡Qué emoción acompañarte en tu cita! Hemos preparado con mucho amor los detalles y consejos para que tus uñitas luzcan soñadas.`,
      `¡Bienvenida bella ${name}! 💖 Soy ${botName}. Tu elección de diseño nos tiene enamoradas en el atelier. Aquí tienes un análisis especial pensado solo para ti.`,
    ];
    clientGreeting = pickOne(warmGreetings);
  } else if (personality === 'technical_expert') {
    const techGreetings = [
      `Estimada ${name}. Saludos de ${botName}. Hemos generado el informe de ingeniería ungueal y compatibilidad biomecánica para tu combinación seleccionada.`,
      `Reporte Técnico para ${name} — ${botName}. Evaluación de espesor estructural, polimerización UV y pautas de higiene post-servicio.`,
    ];
    clientGreeting = pickOne(techGreetings);
  } else if (personality === 'vanguard_creative') {
    const creativeGreetings = [
      `¡Qué vibe increíble, ${name}! ⚡ Soy ${botName}. Tu set tiene toda la energía de pasarela y alta costura contemporánea. ¡Va a ser un total statement!`,
      `¡Hola ${name}! 💅 Soy ${botName}. Tu combinación está en el punto exacto de la tendencia vanguardista. Aquí tienes los highlights estéticos de tu diseño.`,
    ];
    clientGreeting = pickOne(creativeGreetings);
  } else {
    const luxuryGreetings = [
      `¡Hola ${name}! 🌸 Soy tu Asesora de Estilo IA en Valentina Atelier. Hemos analizado la arquitectura y diseño de tu set para brindarte una consultoría personalizada.`,
      `Distinguida ${name}, le saluda ${botName}. Es un privilegio presentarle la memoria estética y balance anatómico de su set personalizado en Valentina Atelier.`,
    ];
    clientGreeting = pickOne(luxuryGreetings);
  }

  // 2. DESIGN CRITIQUE
  const decorNames = activeDecorations.map((d) => d.name).join(', ');
  const techniqueName = technique ? technique.name : 'Técnica Escultural';
  const shapeName = shape ? shape.name : 'Almendra';

  const critiqueTitle = `Composición Armónica: ${techniqueName} en Silueta ${shapeName}`;
  let critiqueDesc = `Tu elección de **${techniqueName}** combinada con silueta **${shapeName}**${
    lengthObj ? ` en ${lengthObj.name}` : ''
  } logra un equilibrio anatómico admirable. `;

  const highlights: string[] = [];

  if (activeDecorations.length > 0) {
    const decorDescriptions = [
      `Los toques artesanales de ${decorNames} aportan textura, tridimensionalidad y un juego de luces dinámico que realza la línea del ápice.`,
      `La inclusión de ${decorNames} crea puntos focales con reflejos ópticos de alta gama que contrastan con la base de ${techniqueName}.`,
      `Con ${decorNames}, el set adquiere una riqueza táctil y visual sofisticada, elevando el acabado a una pieza de autor.`,
    ];
    critiqueDesc += pickOne(decorDescriptions);
    highlights.push(`Contraste de texturas con ${activeDecorations[0].name}.`);
    if (activeDecorations.length > 1) {
      highlights.push(`Transición visual equilibrada entre ${activeDecorations[0].name} y ${activeDecorations[1].name}.`);
    }
  } else {
    const minimalDescriptions = [
      `Has optado por una elegancia minimalista y pura, donde el protagonismo radica en la perfección del sellado de cutícula y la uniformidad del tono.`,
      `El estilo minimalista elegido resalta la pulcritud de la manicura rusa y la curvatura anatómica sin saturaciones visuales.`,
    ];
    critiqueDesc += pickOne(minimalDescriptions);
    highlights.push('Estilo *Clean Luxury* enfocado en pulcritud y curvatura anatómica.');
  }

  if (isLongNails) {
    highlights.push(`Estructura de alto impacto (${lengthObj?.name || 'largo extendido'}) con ápice reforzado.`);
  } else {
    highlights.push('Largo funcional y versátil para el día a día sin sacrificar sofisticación.');
  }

  // 3. NAIL TRIVIA
  let triviaTitle = `El secreto de la silueta ${shapeName}`;
  let triviaFact = '';
  let triviaContext = '';

  if (shape.id === 'coffin') {
    triviaTitle = 'La arquitectura tras la forma Coffin (Bailarina)';
    triviaFact = 'Inspirada en las zapatillas de ballet con punta plana ("pointe shoes"), la silueta Coffin fue concebida para brindar la esbeltez de una uña larga pero con mayor resistencia estructural al impacto frontal.';
    triviaContext = 'Al estrechar los laterales y terminar en un borde recto, redistribuye la tensión mecánica hacia los canales laterales de la uña.';
  } else if (shape.id === 'almond') {
    triviaTitle = 'El legado de la forma Almendra (Almond)';
    triviaFact = 'La silueta almendrada nació en la época dorada del cine de Hollywood en los años 30. Es considerada por estilistas anatómicos como la forma más armónica para alargar visualmente los dedos.';
    triviaContext = 'Por no tener esquinas filosas, reduce en un 40% las probabilidades de engancharse con la ropa o sufrir roturas laterales.';
  } else if (shape.id === 'stiletto') {
    triviaTitle = 'El arte vanguardista del Stiletto';
    triviaFact = 'Originalmente reservada para pasarelas de alta costura, la forma Stiletto requiere una construcción milimétrica en el ápice para mantener su vértice afilado e intacto ante el roce diario.';
    triviaContext = 'Representa audacia y precisión escultórica pura en la manicura profesional.';
  } else {
    triviaTitle = 'La simetría atemporal de la uña Cuadrada';
    triviaFact = 'Popularizada por el estilo parisino clásico, la forma cuadrada ofrece la máxima superficie plana de apoyo y un acabado limpio e impecable.';
    triviaContext = 'Es la silueta preferida para efectos geométricos, francesas definidas y esmaltados de alta pigmentación.';
  }

  // Extra trivia on special decorations if present
  const hasCatEye = activeDecorations.some((d) => d.name.toLowerCase().includes('ojo de gato') || d.id.includes('gato'));
  const hasAurora = activeDecorations.some((d) => d.name.toLowerCase().includes('aurora') || d.id.includes('aurora'));

  if (hasCatEye) {
    triviaTitle = 'Magnetismo en tus manos: Efecto Ojo de Gato';
    triviaFact = 'El efecto Cat Eye contiene micropartículas de óxido férrico paramagnéticas que se orientan con imanes de neodimio antes del curado UV, creando un haz de luz con profundidad tridimensional líquida.';
    triviaContext = 'El haz de luz cambia de ángulo según cómo incida la luz natural o de salón sobre tus uñas.';
  } else if (hasAurora) {
    triviaTitle = 'Luz de ópalo: El fenómeno Aurora';
    triviaFact = 'Los polvos y películas Aurora descomponen la luz visible en ondas iridiscentes similares a las auroras boreales gracias a finas capas nanoscópicas de dióxido de titanio.';
    triviaContext = 'Sobre bases claras ofrece un destello tornasolado, mientras que sobre tonos profundos revela reflejos cósmicos.';
  }

  // 4. FUTURE COMBINATIONS & SUGGESTIONS (DYNAMIC LIVE CATALOG PRICING!)
  const availableComplementary = catalog.decorations.filter(
    (d) => d.active && !decorations[d.id],
  );

  const suggested1 = availableComplementary.length > 0 ? availableComplementary[0] : catalog.decorations[0];
  const suggested2 = availableComplementary.length > 1 ? availableComplementary[1] : catalog.decorations[1];

  const suggestedServices: Array<{ name: string; estimatedPriceText: string }> = [];

  if (suggested1) {
    suggestedServices.push({
      name: `Efecto ${suggested1.name} (Próximo set)`,
      estimatedPriceText: formatMoneyPEN(suggested1.price),
    });
  }
  if (suggested2) {
    suggestedServices.push({
      name: `Detalle ${suggested2.name} en uñas acento`,
      estimatedPriceText: formatMoneyPEN(suggested2.price),
    });
  }

  // Next service retouch base
  const retouchPrice = Math.round(technique.price * 0.75);
  suggestedServices.push({
    name: `Mantenimiento / Retoque ${techniqueName}`,
    estimatedPriceText: formatMoneyPEN(retouchPrice),
  });

  const futureRecommendation = `Para tu próximo retoque en Valentina Nails, te sugerimos experimentar una evolución de tu diseño: combinar tu silueta ${shapeName} con un acabado **${
    suggested1 ? suggested1.name : 'Aurora'
  }**, o añadir acentos de **${suggested2 ? suggested2.name : 'Relieve'}** para una textura aún más suntuosa.`;

  // 5. CARE PROTOCOL
  const tips: string[] = [
    'Hidratación de cutículas: Aplica aceite de cutículas nutritivo (con vitamina E o jojoba) 1 o 2 veces al día para conservar la flexibilidad del sellado y prevenir levantamientos.',
    'Protección contra químicos: Al lavar platos o utilizar limpiadores con cloro o desinfectantes fuertes, utiliza siempre guantes de goma para no deshidratar el producto.',
    'Cero herramientas improvisadas: Tus uñas son joyas, no herramientas. Evita usarlas para abrir latas, despegar etiquetas o raspar empaques.',
  ];

  if (isLongNails) {
    tips.push(
      'Manejo biomecánico para uñas largas: Al teclear en computadoras o smartphones, haz contacto con las yemas de los dedos en un ángulo suave para no ejercer palanca sobre el ápice.',
    );
  } else {
    tips.push(
      'Higiene y secado: Seca cuidadosamente las manos después de lavarte para evitar que quede humedad prolongada bajo la extensión o el borde libre.',
    );
  }

  const urgencyWarning =
    'Si notas algún enganche o levantamiento por accidente, no intentes arrancarlo ni morderlo. Un retiro inadecuado puede dañar las capas de queratina. Contáctanos por WhatsApp para un retoque o reparación rápida y segura.';

  return {
    clientGreeting,
    designCritique: {
      title: critiqueTitle,
      description: critiqueDesc,
      highlights,
    },
    nailTrivia: {
      title: triviaTitle,
      fact: triviaFact,
      historicalContext: triviaContext,
    },
    futureCombinations: {
      title: 'Inspiración & Próximo Retoque',
      recommendation: futureRecommendation,
      suggestedServices,
      retouchTimeframe: 'Recomendado entre los 18 y 21 días.',
    },
    careProtocol: {
      title: `Protocolo de Cuidado para ${techniqueName}`,
      tips,
      urgencyWarning,
    },
  };
}
