export function formatMoneyPEN(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBookingDatePEN(dateInput: Date | string): string {
  let date: Date;
  if (typeof dateInput === 'string') {
    date = new Date(`${dateInput}T12:00:00`);
  } else {
    date = dateInput;
  }
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function sanitizePhoneNumber(phone: string): { cleanPhone: string; isValid: boolean } {
  const cleanPhone = phone.replace(/\D/g, '');
  // Teléfonos válidos suelen tener entre 8 y 15 dígitos
  const isValid = cleanPhone.length >= 8 && cleanPhone.length <= 15;
  return { cleanPhone, isValid };
}

export function generateQuoteShareText(params: {
  businessName?: string;
  clientName?: string;
  summary: string[];
  total: number;
  whatsapp: string;
}): string {
  const { businessName, clientName, summary, total, whatsapp } = params;
  const brand = businessName?.trim() || 'Valentina Nails by Priscila';
  const greeting = clientName ? `Cotización para ${clientName.trim()} en ${brand}` : `Mi cotización en ${brand}`;
  return [
    `🌸 ${greeting} 🌸`,
    '',
    'Detalle del set:',
    ...summary.map((item) => `• ${item}`),
    '',
    `Total estimado: ${formatMoneyPEN(total)} (Soles)`,
    '',
    'Para agendar o consultar:',
    `WhatsApp: https://wa.me/${whatsapp}`,
  ].join('\n');
}
