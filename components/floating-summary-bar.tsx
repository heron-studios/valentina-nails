'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, ChevronUp, Copy, Check, RotateCcw, X } from 'lucide-react';

export type FloatingSummaryBarProps = {
  summary: string[];
  total: number;
  anchorTotal: number;
  discountAmount: number;
  formatMoney: (val: number) => string;
  hasTechnique: boolean;
  hasSelectedDesign: boolean;
  onNavigateToBooking: () => void;
  onCopyQuote: () => void;
  onReset: () => void;
  copiedQuote: boolean;
  stage: 'design' | 'booking';
};

export function FloatingSummaryBar({
  summary,
  total,
  anchorTotal,
  discountAmount,
  formatMoney,
  hasTechnique,
  hasSelectedDesign,
  onNavigateToBooking,
  onCopyQuote,
  onReset,
  copiedQuote,
}: FloatingSummaryBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [summaryCardInView, setSummaryCardInView] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Monitor window resize for responsive mode
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 1050);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Observe desktop summary-card to avoid redundancy when sidebar is on screen
  useEffect(() => {
    const cardEl = document.querySelector('.summary-card');
    if (!cardEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSummaryCardInView(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(cardEl);
    return () => observer.disconnect();
  }, []);

  // Monitor scroll position
  useEffect(() => {
    const handleScroll = () => {
      setScrolledPastHero(window.scrollY > 280);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawer on click outside or Escape
  useEffect(() => {
    if (!expanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  // Determine whether to display:
  // On mobile/tablet: show whenever scrolled past hero.
  // On desktop: show whenever scrolled past hero AND summary card is not in view.
  const shouldShow = scrolledPastHero && (!isDesktop || !summaryCardInView);

  if (!shouldShow) return null;

  return (
    <div className="floating-summary-container" ref={drawerRef} aria-label="Resumen de cotización flotante">
      {/* Expandable Luxury Detail Drawer */}
      {expanded && (
        <dialog open className="floating-summary-drawer" aria-label="Detalle de tu set">
          <div className="floating-drawer-header">
            <div className="flex items-center gap-2">
              <span className="floating-drawer-badge">
                <Sparkles className="w-3.5 h-3.5 text-[#b58838]" />
              </span>
              <div>
                <p className="floating-drawer-eyebrow">Tu selección en vivo</p>
                <h4 className="floating-drawer-title">Un set muy tú</h4>
              </div>
            </div>
            <button
              type="button"
              className="floating-drawer-close"
              onClick={() => setExpanded(false)}
              aria-label="Cerrar detalle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="floating-drawer-body">
            <ul className="floating-items-list">
              {summary.map((item) => (
                <li key={item}>
                  <Check className="w-3.5 h-3.5 text-[#b58838] flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="floating-cost-breakdown">
              {discountAmount > 0 ? (
                <>
                  <div className="floating-cost-row">
                    <span>Precio en salón:</span>
                    <span className="line-through text-[#998982]">{formatMoney(anchorTotal)}</span>
                  </div>
                  <div className="floating-cost-row text-[#c4432b] font-semibold bg-[rgba(235,94,69,0.08)] px-2 py-1 rounded-md">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Descuento web:
                    </span>
                    <strong>-{formatMoney(discountAmount)}</strong>
                  </div>
                  <div className="floating-cost-row pt-2 border-t border-[#ebd9d2] font-semibold text-[#2f2522]">
                    <span>Total final a pagar:</span>
                    <strong className="text-lg font-heading text-[#976a21]">{formatMoney(total)}</strong>
                  </div>
                </>
              ) : (
                <div className="floating-cost-row">
                  <span>Total estimado:</span>
                  <strong className="text-lg font-heading text-[#976a21]">{formatMoney(total)}</strong>
                </div>
              )}
            </div>

            <div className="floating-drawer-actions">
              <button
                type="button"
                className={`floating-action-btn ${copiedQuote ? 'is-copied' : ''}`}
                onClick={onCopyQuote}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedQuote ? '¡Copiado!' : 'Copiar cotización'}</span>
              </button>
              <button
                type="button"
                className="floating-action-btn text-[#8a7d77]"
                onClick={() => {
                  onReset();
                  setExpanded(false);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Main Persistent Floating Bar */}
      <div className="floating-summary-bar">
        {/* Info & Price Trigger */}
        <button
          type="button"
          className="floating-bar-info"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label="Abrir detalle de cotización"
        >
          <div className="floating-bar-top-line">
            <span className="floating-badge-tag">
              <Sparkles className="w-3 h-3 text-[#b58838]" /> Un set muy tú
            </span>
            <span className="floating-expand-hint">
              <span>{summary.length} {summary.length === 1 ? 'detalle' : 'detalles'}</span>
              <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </span>
          </div>

          <div className="floating-bar-price-line">
            {discountAmount > 0 && anchorTotal > total ? (
              <div className="floating-price-group">
                <span className="floating-anchor-price">{formatMoney(anchorTotal)}</span>
                <span className="floating-discount-badge">-{formatMoney(discountAmount)} OFF</span>
                <strong className="floating-price-val">{formatMoney(total)}</strong>
              </div>
            ) : (
              <div className="floating-price-group">
                <strong className="floating-price-val">{formatMoney(total)}</strong>
                <span className="floating-zero-hint">
                  {hasTechnique || hasSelectedDesign ? 'Base incluida' : 'Comienza en S/ 0'}
                </span>
              </div>
            )}
          </div>
        </button>

        {/* Action Button */}
        <button
          type="button"
          className="floating-bar-cta"
          onClick={onNavigateToBooking}
          aria-label="Continuar a la reserva"
        >
          <span>{hasTechnique || hasSelectedDesign ? 'Elegir fecha' : 'Elegir técnica'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
