export type AIPersonality =
  | 'atelier_luxury'
  | 'warm_friendly'
  | 'technical_expert'
  | 'vanguard_creative';

export interface AIConfig {
  botName: string;
  personality: AIPersonality;
  welcomeMessage: string;
  customRules: string;
  geminiApiKey?: string;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  botName: 'Valentina Atelier IA',
  personality: 'atelier_luxury',
  welcomeMessage:
    '¡Hola! Soy tu asistente de Valentina Nails by Priscila. Estoy aquí para asesorarte en técnicas de autor, arquitectura ungueal, cotizaciones en Soles y cómo agendar tu cita.',
  customRules:
    '• Políticas: Garantía de 5 días en todas las aplicaciones de acrílico y rubber gel.\n• Pagos: Aceptamos Yape, Plin, transferencias BCP/Interbank y efectivo sin recargo.\n• Instalaciones: Contamos con estacionamiento seguro para clientas, café de cortesía y ambiente climatizado.\n• Citas: Se recomienda llegar 5 minutos antes. La tolerancia es de 10 minutos.',
  geminiApiKey: '',
};

export function normalizeAIConfig(raw: unknown): AIConfig {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_AI_CONFIG);
  }

  const data = raw as Record<string, unknown>;

  const validPersonalities: AIPersonality[] = [
    'atelier_luxury',
    'warm_friendly',
    'technical_expert',
    'vanguard_creative',
  ];

  const personality =
    typeof data.personality === 'string' &&
    validPersonalities.includes(data.personality as AIPersonality)
      ? (data.personality as AIPersonality)
      : DEFAULT_AI_CONFIG.personality;

  return {
    botName:
      typeof data.botName === 'string' && data.botName.trim()
        ? data.botName.trim()
        : DEFAULT_AI_CONFIG.botName,
    personality,
    welcomeMessage:
      typeof data.welcomeMessage === 'string' && data.welcomeMessage.trim()
        ? data.welcomeMessage.trim()
        : DEFAULT_AI_CONFIG.welcomeMessage,
    customRules:
      typeof data.customRules === 'string' && data.customRules.trim()
        ? data.customRules.trim()
        : DEFAULT_AI_CONFIG.customRules,
    geminiApiKey:
      typeof data.geminiApiKey === 'string' ? data.geminiApiKey.trim() : '',
  };
}
