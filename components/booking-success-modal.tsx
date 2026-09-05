import { useState } from 'react';
import {
  Check,
  X,
  MessageCircle,
  Sparkles,
  Calendar,
  Clock,
  Palette,
  Lightbulb,
  ShieldCheck,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { AIAppointmentAdvice } from '../lib/ai-advisor.ts';
import { formatMoneyPEN } from '../lib/format-utils.ts';

interface BookingSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  displayDate: string;
  selectedTime: string;
  total: number;
  discountAmount?: number;
  waUrl: string;
  advice: AIAppointmentAdvice;
}

type AdviceTab = 'design' | 'trivia' | 'future' | 'care';

export function BookingSuccessModal({
  isOpen,
  onClose,
  clientName,
  displayDate,
  selectedTime,
  total,
  discountAmount = 0,
  waUrl,
  advice,
}: BookingSuccessModalProps) {
  const [activeTab, setActiveTab] = useState<AdviceTab>('design');
  const [copiedAdvice, setCopiedAdvice] = useState(false);

  if (!isOpen) return null;

  const handleOpenWhatsApp = () => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyAdvice = () => {
    const text = [
      `🌸 Valentina Atelier - Asesoría de Estilo IA para ${clientName}`,
      `📅 Cita: ${displayDate} a las ${selectedTime}`,
      `💰 Total: ${formatMoneyPEN(total)}`,
      '',
      `🎨 ${advice.designCritique.title}`,
      advice.designCritique.description,
      '',
      `💡 ${advice.nailTrivia.title}`,
      advice.nailTrivia.fact,
      '',
      `🔮 ${advice.futureCombinations.title}`,
      advice.futureCombinations.recommendation,
      ...advice.futureCombinations.suggestedServices.map(
        (s) => `• ${s.name}: ${s.estimatedPriceText}`
      ),
      '',
      `🛡️ ${advice.careProtocol.title}`,
      ...advice.careProtocol.tips.map((tip) => `• ${tip}`),
    ].join('\n');

    void navigator.clipboard.writeText(text);
    setCopiedAdvice(true);
    setTimeout(() => setCopiedAdvice(false), 2400);
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-md animate-fade-in w-full h-full max-w-none max-h-none border-0 m-0"
      aria-modal="true"
      aria-labelledby="modal-booking-title"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#fffdfb] border border-[#c9a054]/45 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top Floating Glow Header */}
        <div className="relative px-5 py-3.5 bg-gradient-to-r from-[#fbf4eb] via-[#fffdf9] to-[#fbf0e8] border-b border-[#eadcd6] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300/60 shadow-sm">
              <Check className="w-4 h-4" />
            </span>
            <div>
              <p className="text-[0.65rem] font-semibold tracking-wider uppercase text-[#94671e]">
                Reserva Registrada en Atelier
              </p>
              <h2 id="modal-booking-title" className="text-sm sm:text-base font-semibold text-[#281f1c]">
                ¡Tu cita está lista, {clientName}!
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7d6b63] hover:text-[#281f1c] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-none">
          {/* Appointment Meta Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-[#fbf6f1] border border-[#e8dcd6] rounded-2xl text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#94671e] flex-shrink-0" />
              <div>
                <span className="block text-[0.62rem] text-[#8c7a72] uppercase font-semibold">Fecha</span>
                <strong className="text-[#3b2c26] text-[0.76rem]">{displayDate}</strong>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#94671e] flex-shrink-0" />
              <div>
                <span className="block text-[0.62rem] text-[#8c7a72] uppercase font-semibold">Horario</span>
                <strong className="text-[#3b2c26] text-[0.76rem]">{selectedTime}</strong>
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-[#eadcd6]">
              <div className="text-left sm:text-right">
                <span className="block text-[0.62rem] text-[#8c7a72] uppercase font-semibold">Total a pagar</span>
                <strong className="text-base text-[#94671e] font-display">{formatMoneyPEN(total)}</strong>
                {discountAmount > 0 && (
                  <span className="block text-[0.62rem] text-emerald-700 font-semibold">
                    Descuento web: -{formatMoneyPEN(discountAmount)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Floating WhatsApp Action Hero */}
          <div className="relative p-3.5 sm:p-4 bg-gradient-to-br from-[#f0fdf4] to-[#e8f8ed] border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-left flex-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-xs mb-0.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Envío en pestaña flotante</span>
              </div>
              <p className="text-[0.72rem] text-emerald-900/85 leading-relaxed">
                Abrimos WhatsApp en una ventana independiente para que no pierdas tu navegación. Si tu navegador bloqueó la ventana emergente, toca el botón:
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-full font-semibold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all flex-shrink-0 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Abrir WhatsApp</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </button>
          </div>

          {/* AI Advisor Panel */}
          <div className="border border-[#c9a054]/40 rounded-2xl bg-gradient-to-b from-[#fffefc] to-[#fbf7f2] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#fcf2df] text-[#94671e] flex items-center justify-center border border-[#e8cbbf]/60 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-[#281f1c]">
                    Asesora de Estilo IA · Valentina Atelier
                  </h3>
                  <p className="text-[0.65rem] text-[#7a6b64]">
                    Consultoría personalizada en tiempo real con tarifas vigentes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyAdvice}
                className="px-2.5 py-1 rounded-full text-[0.68rem] font-medium border border-[#c9a054]/40 bg-white/80 hover:bg-white text-[#94671e] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedAdvice ? '¡Copiado!' : 'Copiar IA'}</span>
              </button>
            </div>

            {/* AI Dimension Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#f5ecdf]/70 rounded-xl mb-3 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('design')}
                className={`flex-1 min-w-[90px] py-1 px-2 rounded-lg text-[0.7rem] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'design'
                    ? 'bg-white text-[#8c5d18] shadow-xs'
                    : 'text-[#7d6b63] hover:text-[#3b2c26]'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Tu Diseño</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('trivia')}
                className={`flex-1 min-w-[90px] py-1 px-2 rounded-lg text-[0.7rem] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'trivia'
                    ? 'bg-white text-[#8c5d18] shadow-xs'
                    : 'text-[#7d6b63] hover:text-[#3b2c26]'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Dato Curioso</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('future')}
                className={`flex-1 min-w-[100px] py-1 px-2 rounded-lg text-[0.7rem] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'future'
                    ? 'bg-white text-[#8c5d18] shadow-xs'
                    : 'text-[#7d6b63] hover:text-[#3b2c26]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Próximo Retoque</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('care')}
                className={`flex-1 min-w-[90px] py-1 px-2 rounded-lg text-[0.7rem] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'care'
                    ? 'bg-white text-[#8c5d18] shadow-xs'
                    : 'text-[#7d6b63] hover:text-[#3b2c26]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Cuidados</span>
              </button>
            </div>

            {/* Tab 1: Tu Diseño */}
            {activeTab === 'design' && (
              <div className="space-y-2.5 animate-fade-in">
                <div>
                  <h4 className="text-xs font-semibold text-[#8c5d18] mb-1">
                    {advice.designCritique.title}
                  </h4>
                  <p className="text-[0.76rem] text-[#5e514a] leading-relaxed">
                    {advice.designCritique.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-[#eaded8]/60">
                  <span className="block text-[0.65rem] font-bold uppercase text-[#8c7a72] mb-1.5">
                    Puntos Clave de Estilo
                  </span>
                  <ul className="space-y-1">
                    {advice.designCritique.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[0.72rem] text-[#4a3e38]">
                        <Check className="w-3 h-3 text-[#c9a054] flex-shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 2: Dato Curioso */}
            {activeTab === 'trivia' && (
              <div className="space-y-2.5 animate-fade-in">
                <div className="p-3 bg-[#fdf8f0] border border-[#ecd9be] rounded-xl">
                  <h4 className="text-xs font-semibold text-[#94671e] mb-1 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" />
                    {advice.nailTrivia.title}
                  </h4>
                  <p className="text-[0.76rem] text-[#5e514a] leading-relaxed">
                    {advice.nailTrivia.fact}
                  </p>
                </div>
                <p className="text-[0.72rem] text-[#7d6c65] italic px-1">
                  💡 {advice.nailTrivia.historicalContext}
                </p>
              </div>
            )}

            {/* Tab 3: Próximo Retoque */}
            {activeTab === 'future' && (
              <div className="space-y-2.5 animate-fade-in">
                <div>
                  <h4 className="text-xs font-semibold text-[#8c5d18] mb-1">
                    {advice.futureCombinations.title}
                  </h4>
                  <p className="text-[0.76rem] text-[#5e514a] leading-relaxed">
                    {advice.futureCombinations.recommendation}
                  </p>
                </div>

                <div className="p-2.5 bg-[#fcf8f3] border border-[#ecd9be] rounded-xl space-y-1.5">
                  <span className="block text-[0.65rem] font-bold uppercase text-[#8c7a72]">
                    Estimado de Servicios Futuros (Precios del Catálogo Vigente)
                  </span>
                  <div className="space-y-1">
                    {advice.futureCombinations.suggestedServices.map((service, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs py-1 border-b border-[#ecd9be]/40 last:border-0"
                      >
                        <span className="text-[0.74rem] text-[#4a3e38] font-medium">{service.name}</span>
                        <strong className="text-[0.76rem] text-[#94671e] font-semibold">
                          {service.estimatedPriceText}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[0.68rem] text-[#8c7a72] italic px-1">
                  ⏰ {advice.futureCombinations.retouchTimeframe}
                </p>
              </div>
            )}

            {/* Tab 4: Cuidados */}
            {activeTab === 'care' && (
              <div className="space-y-2.5 animate-fade-in">
                <h4 className="text-xs font-semibold text-[#8c5d18]">
                  {advice.careProtocol.title}
                </h4>
                <ul className="space-y-1.5">
                  {advice.careProtocol.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-[0.74rem] text-[#5e514a] leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a054] mt-1.5 flex-shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
                <div className="p-2.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-[0.7rem] text-amber-900 leading-relaxed">
                  ⚠️ <strong>Protocolo de seguridad:</strong> {advice.careProtocol.urgencyWarning}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-3.5 sm:p-4 bg-[#fbf6f1] border-t border-[#eadcd6] flex items-center justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-[0.72rem] text-[#7d6b63] hover:text-[#281f1c] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            Volver a la web
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="gold-button text-xs py-1.5 px-4 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Ver chat de WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
