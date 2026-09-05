'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gem,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Copy,
  Sparkles,
  Star,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { es } from 'date-fns/locale';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShaderBackdrop } from '@/components/shader-backdrop';
import { LiquidGlassHero } from '@/components/liquid-glass-hero';
import { ChatAssistant } from '@/components/chat-assistant';
import { FloatingSummaryBar } from '@/components/floating-summary-bar';
import { AvailabilityView } from '@/components/availability-view';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_CATALOG, normalizeCatalog, type SalonCatalog } from '@/lib/catalog';
import {
  formatBookingDatePEN,
  formatMoneyPEN,
  generateQuoteShareText,
  sanitizePhoneNumber,
} from '@/lib/format-utils';
import {
  calculateSetPrice,
  createAnchorCatalog,
  formatLengthSupplement,
  getAnchorPrice,
  getNailLengthClass,
  getTechniqueStartingPrice,
} from '@/lib/pricing';
import type { DesignExample } from '@/lib/designs';

const formatMoney = formatMoneyPEN;

const TOUR_STEPS = [
  { selector: '[data-tour="intro"]', title: 'Aquí comienza tu diseño', copy: 'La calculadora te acompaña en orden. Cada elección actualiza el precio automáticamente.', tip: 'Puedes cambiar cualquier opción antes de reservar.' },
  { selector: '[data-tour="technique"]', title: 'Primero, elige la técnica', copy: 'Toca acrílico, gel semipermanente o rubber gel para definir la base de tu set.', tip: 'Las opciones seleccionadas quedan marcadas en rosa y dorado.' },
  { selector: '[data-tour="shape"]', title: 'Después, elige la forma', copy: 'Compara las siluetas y selecciona la que más te guste. Si eliges acrílico, también podrás definir el largo.', tip: 'La vista previa cambia junto con tu selección.' },
  { selector: '[data-tour="decorations"]', title: 'Agrega detalles por uña', copy: 'Usa los botones + y − para indicar cuántas uñas llevarán cada decoración.', tip: 'El precio mostrado es por cada uña decorada.' },
  { selector: '[data-tour="summary"]', title: 'Revisa tu set y tu total', copy: 'Este resumen reúne todas tus elecciones. Cuando estés lista, toca “Elegir fecha”.', tip: 'El precio es estimado y siempre estará visible.' },
  { selector: '[data-tour="client-data"]', title: 'Escribe tus datos', copy: 'Solo necesitamos tu nombre y teléfono para identificar tu reserva. No tienes que crear una cuenta.', tip: 'Tus datos se usan únicamente para coordinar la cita.' },
  { selector: '[data-tour="calendar"]', title: 'Selecciona fecha y hora', copy: 'Elige un día disponible y luego uno de los horarios libres que aparecerán a la derecha.', tip: 'Los domingos y horarios ocupados quedan desactivados.' },
  { selector: '[data-tour="confirm"]', title: 'Confirma por WhatsApp', copy: 'Guardaremos el horario y abriremos WhatsApp con tu diseño, fecha, hora y total listos para enviar.', tip: 'Revisa el mensaje y envíalo para terminar.' },
] as const;

const CALC_STEPS = [
  { id: 'technique', label: 'Técnica', num: '01' },
  { id: 'shape', label: 'Silueta & Largo', num: '02' },
  { id: 'decorations', label: 'Diseños', num: '03' },
  { id: 'extras', label: 'Extras', num: '04' },
] as const;

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function Counter({ value, onChange, label, max = 10 }: { value: number; onChange: (value: number) => void; label: string; max?: number }) {
  return (
    <div className="counter" aria-label={label}>
      <button type="button" aria-label={`Quitar ${label}`} onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}>
        <Minus />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label={`Agregar ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value === max}>
        <Plus />
      </button>
    </div>
  );
}

export type ActiveTab = 'inicio' | 'disponibilidad' | 'experiencia' | 'galeria' | 'calculadora' | 'booking';

export default function Home() {
  const [catalog, setCatalog] = useState<SalonCatalog>(() => structuredClone(DEFAULT_CATALOG));
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('inicio');
  const [technique, setTechnique] = useState('');
  const [length, setLength] = useState('length-4');
  const [shape, setShape] = useState('almond');
  const [decorations, setDecorations] = useState<Record<string, number>>({});
  const [extraTones, setExtraTones] = useState(0);
  const [changeShape, setChangeShape] = useState(false);
  const [removal, setRemoval] = useState({ acrylic: 0, gel: 0 });
  const [repairs, setRepairs] = useState({ acrylic: 0, gel: 0 });
  const [showAll, setShowAll] = useState(false);
  const [stage, setStage] = useState<'design' | 'booking'>('design');
  const [calcStepIndex, setCalcStepIndex] = useState(0);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'booking') {
      setStage('booking');
    } else {
      setStage('design');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      window.history.replaceState(null, '', `#${tab}`);
    } catch {}
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['inicio', 'disponibilidad', 'experiencia', 'galeria', 'calculadora', 'booking'].includes(hash)) {
        setActiveTab(hash as ActiveTab);
        if (hash === 'booking') setStage('booking');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [occupiedByDate, setOccupiedByDate] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [wizardStep, setWizardStep] = useState<number | null>(null);
  const [tourTarget, setTourTarget] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tourCard, setTourCard] = useState({ top: 16, left: 16, width: 360, placement: 'below' as 'above' | 'below' });
  const [designExamples, setDesignExamples] = useState<DesignExample[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignExample | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const anchorCatalog = useMemo(() => createAnchorCatalog(catalog), [catalog]);

  const techniques = catalog.techniques.filter((item) => item.active);
  const lengths = catalog.lengths.filter((item) => item.active);
  const shapes = catalog.shapes.filter((item) => item.active);
  const decorationOptions = catalog.decorations.filter((item) => item.active);

  const displayTechniques = anchorCatalog.techniques.filter((item) => item.active);
  const displayLengths = anchorCatalog.lengths.filter((item) => item.active);
  const displayDecorations = anchorCatalog.decorations.filter((item) => item.active);

  const techniqueInfo = techniques.find((item) => item.id === technique) || null;
  const lengthInfo = lengths.find((item) => item.id === length) || lengths[0] || DEFAULT_CATALOG.lengths[0];
  const shapeInfo = shapes.find((item) => item.id === shape) || shapes[0] || DEFAULT_CATALOG.shapes[0];

  const anchorTechniqueInfo = displayTechniques.find((item) => item.id === technique) || null;
  const anchorLengthInfo = displayLengths.find((item) => item.id === length) || displayLengths[0] || DEFAULT_CATALOG.lengths[0];

  const realCustomTotal = useMemo(() => calculateSetPrice({
    technique: techniqueInfo,
    length: lengthInfo,
    decorations,
    decorationOptions,
    extraTones,
    changeShape,
    removal,
    repairs,
    extras: catalog.extras,
  }), [techniqueInfo, lengthInfo, decorationOptions, decorations, extraTones, changeShape, removal, repairs, catalog.extras]);

  const anchorCustomTotal = useMemo(() => calculateSetPrice({
    technique: anchorTechniqueInfo,
    length: anchorLengthInfo,
    decorations,
    decorationOptions: displayDecorations,
    extraTones,
    changeShape,
    removal,
    repairs,
    extras: anchorCatalog.extras,
  }), [anchorTechniqueInfo, anchorLengthInfo, displayDecorations, decorations, extraTones, changeShape, removal, repairs, anchorCatalog.extras]);

  const total = selectedDesign?.price ?? realCustomTotal;
  const anchorTotal = selectedDesign ? getAnchorPrice(selectedDesign.price) : anchorCustomTotal;
  const discountAmount = Math.max(0, anchorTotal - total);

  const selectedDecorations = decorationOptions.filter((item) => (decorations[item.id] || 0) > 0);
  const lengthSupplement = techniqueInfo?.usesLengths && lengthInfo.price > 0 ? ` (+${formatMoney(lengthInfo.price)})` : '';
  const customSummary = techniqueInfo
    ? [
        `${techniqueInfo.name}${techniqueInfo.usesLengths ? ` · ${lengthInfo.name.toLowerCase()}${lengthSupplement}` : ''}`,
        `Forma ${shapeInfo.name}`,
        ...selectedDecorations.map((item) => `${item.name} ×${decorations[item.id]} uña${decorations[item.id] > 1 ? 's' : ''}`),
        ...(extraTones ? [`${extraTones} tono${extraTones > 1 ? 's' : ''} extra`] : []),
        ...(changeShape ? ['Cambio de forma'] : []),
        ...(removal.acrylic ? [`Retiro acrílico ×${removal.acrylic}`] : []),
        ...(removal.gel ? [`Retiro gel ×${removal.gel}`] : []),
        ...(repairs.acrylic ? [`Reposición acrílico ×${repairs.acrylic}`] : []),
        ...(repairs.gel ? [`Reposición gel ×${repairs.gel}`] : []),
      ]
    : ['Elige tu técnica para iniciar tu diseño'];
  const summary = selectedDesign
    ? [`Diseño para replicar: ${selectedDesign.title}`, selectedDesign.description || 'Referencia visual seleccionada']
    : customSummary;

  const day = selectedDate?.getDay();
  const times = day === 6 ? catalog.schedule.saturday : catalog.schedule.weekdays;
  const occupied = useMemo(
    () => selectedDate ? occupiedByDate[dateKey(selectedDate)] ?? [] : [],
    [occupiedByDate, selectedDate],
  );
  const isFullyBooked = (date: Date) => {
    const availableTimes = date.getDay() === 6 ? catalog.schedule.saturday : catalog.schedule.weekdays;
    return availableTimes.length > 0 && (occupiedByDate[dateKey(date)]?.length ?? 0) >= availableTimes.length;
  };

  useEffect(() => onSnapshot(doc(db, 'catalog', 'main'), (snapshot) => {
    setCatalog(normalizeCatalog(snapshot.exists() ? snapshot.data() : DEFAULT_CATALOG));
    setCatalogLoading(false);
  }, () => setCatalogLoading(false)), []);

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      setUser(currentUser);
      setAuthReady(true);
      return;
    }
    try {
      const result = await signInAnonymously(auth);
      setUser(result.user);
    } catch {
      setError('No pudimos preparar la reserva. Recarga la página e intenta nuevamente.');
    } finally {
      setAuthReady(true);
    }
  }), []);

  useEffect(() => onSnapshot(collection(db, 'designs'), (snapshot) => {
    setDesignExamples(snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as DesignExample))
      .filter((item) => item.active));
  }, () => setDesignExamples([])), []);

  useEffect(() => onSnapshot(collection(db, 'slots'), (snapshot) => {
    const next: Record<string, string[]> = {};
    snapshot.docs.forEach((slot) => {
      const data = slot.data();
      const bookingDate = String(data.bookingDate || '');
      const bookingTime = String(data.bookingTime || '');
      if (!bookingDate || !bookingTime) return;
      next[bookingDate] = [...(next[bookingDate] ?? []), bookingTime];
    });
    setOccupiedByDate(next);
    setLoadingSlots(false);
  }, () => {
    setOccupiedByDate({});
    setLoadingSlots(false);
  }), []);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem('valentina-client-guide-v1')) setWizardStep(0);
    } catch {
      setWizardStep(0);
    }
  }, []);

  useEffect(() => {
    if (wizardStep === null) return;
    if (wizardStep >= 5) setStage('booking');

    let target: HTMLElement | null = null;
    let positionTimer = 0;
    const updatePosition = () => {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const padding = window.innerWidth < 560 ? 6 : 10;
      const visibleTop = Math.max(8, rect.top - padding);
      const visibleBottom = Math.min(window.innerHeight - 8, rect.bottom + padding);
      const width = Math.min(rect.width + padding * 2, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left - padding, window.innerWidth - width - 8));
      setTourTarget({ top: visibleTop, left, width, height: Math.max(56, visibleBottom - visibleTop) });

      const cardWidth = Math.min(370, window.innerWidth - 24);
      const estimatedHeight = 250;
      const canPlaceBelow = visibleBottom + estimatedHeight + 20 < window.innerHeight;
      setTourCard({
        top: canPlaceBelow ? visibleBottom + 14 : Math.max(12, visibleTop - estimatedHeight - 14),
        left: Math.max(12, Math.min(rect.left + rect.width / 2 - cardWidth / 2, window.innerWidth - cardWidth - 12)),
        width: cardWidth,
        placement: canPlaceBelow ? 'below' : 'above',
      });
    };
    const focusTarget = () => {
      target = document.querySelector<HTMLElement>(TOUR_STEPS[wizardStep].selector);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      positionTimer = window.setTimeout(updatePosition, 420);
    };
    const startTimer = window.setTimeout(focusTarget, wizardStep >= 5 ? 120 : 20);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeWizard();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(positionTimer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep === null) return;
    if (wizardStep < 5 && activeTab !== 'calculadora') {
      setActiveTab('calculadora');
    } else if (wizardStep >= 5 && activeTab !== 'booking') {
      setActiveTab('booking');
      setStage('booking');
    }
    if (wizardStep === 1) setCalcStepIndex(0);
    if (wizardStep === 2) setCalcStepIndex(1);
    if (wizardStep === 3) setCalcStepIndex(2);
    if (wizardStep === 4) setCalcStepIndex(3);
  }, [wizardStep, activeTab]);

  useEffect(() => {
    if (technique && !techniques.some((item) => item.id === technique)) {
      setTechnique(techniques[0]?.id || '');
    }
    if (!lengths.some((item) => item.id === length) && lengths[0]) setLength(lengths[0].id);
    if (!shapes.some((item) => item.id === shape) && shapes[0]) setShape(shapes[0].id);
  }, [catalog, technique, length, shape, techniques, lengths, shapes]);

  useEffect(() => {
    setSelectedTime('');
  }, [selectedDate]);

  useEffect(() => {
    if (selectedTime && occupied.includes(selectedTime)) {
      setSelectedTime('');
      setError('Ese horario acaba de reservarse. Elige otro disponible.');
    }
  }, [occupied, selectedTime]);

  const reset = () => {
    setTechnique('');
    setLength(lengths[0]?.id || 'length-1');
    setShape(shapes[0]?.id || 'almond');
    setDecorations({});
    setExtraTones(0);
    setChangeShape(false);
    setRemoval({ acrylic: 0, gel: 0 });
    setRepairs({ acrylic: 0, gel: 0 });
    setClientName('');
    setClientPhone('');
    setSelectedDate(undefined);
    setSelectedTime('');
    setConfirmed(false);
    setSelectedDesign(null);
    setError('');
    setStage('design');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToBooking = () => {
    if (!technique && !selectedDesign) {
      setError('Por favor elige una técnica base (Acrílico, Gel o Rubber) antes de continuar con tu cita.');
      handleTabChange('calculadora');
      return;
    }
    setError('');
    handleTabChange('booking');
  };

  const replicateDesign = (design: DesignExample) => {
    setSelectedDesign(design);
    handleTabChange('booking');
  };

  const handleSelectSlotAndBook = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    handleTabChange('booking');
  };

  const closeWizard = (startDesign = false) => {
    try {
      window.localStorage.setItem('valentina-client-guide-v1', 'seen');
    } catch {
      // The guide still closes when browser storage is unavailable.
    }
    setWizardStep(null);
    if (startDesign) handleTabChange('calculadora');
  };

  const handleCopyQuote = async () => {
    const text = generateQuoteShareText({
      businessName: catalog.businessName,
      summary,
      total,
      anchorTotal,
      discount: discountAmount,
      whatsapp: catalog.whatsapp,
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedQuote(true);
        setTimeout(() => setCopiedQuote(false), 2400);
      }
    } catch {
      // Ignore clipboard write failures gracefully
    }
  };

  const confirmBooking = async () => {
    if (!user) {
      setError('La reserva aún se está preparando. Intenta nuevamente en unos segundos.');
      return;
    }
    if (!clientName.trim() || !clientPhone.trim() || !selectedDate || !selectedTime) {
      setError('Completa tu nombre, teléfono, fecha y hora para confirmar.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { cleanPhone } = sanitizePhoneNumber(clientPhone);
    const finalPhone = cleanPhone || clientPhone.trim();
    const payload = {
      clientName: clientName.trim(),
      clientPhone: finalPhone,
      serviceSummary: summary.join(' | '),
      bookingDate: dateKey(selectedDate),
      bookingTime: selectedTime,
      estimatedPrice: total,
    };
    try {
      const slotId = `${payload.bookingDate}_${payload.bookingTime.replace(':', '')}`;
      await runTransaction(db, async (transaction) => {
        const slotRef = doc(db, 'slots', slotId);
        const slotSnapshot = await transaction.get(slotRef);
        if (slotSnapshot.exists()) {
          throw new Error('Ese horario acaba de ocuparse. Elige otro disponible.');
        }
        const bookingRef = doc(collection(db, 'bookings'));
        transaction.set(slotRef, {
          bookingDate: payload.bookingDate,
          bookingTime: payload.bookingTime,
          bookedAt: serverTimestamp(),
          userId: user.uid,
        });
        transaction.set(bookingRef, {
          ...payload,
          userId: user.uid,
          slotId,
          createdAt: serverTimestamp(),
        });
      });
      setConfirmed(true);
      const displayDate = formatBookingDatePEN(selectedDate);
      const message = [
        '¡Hola! Quiero confirmar mi cita 🌸',
        `Nombre: ${clientName.trim()}`,
        finalPhone ? `Teléfono: ${finalPhone}` : '',
        `Servicio(s): ${summary.join(', ')}`,
        `Fecha: ${displayDate}`,
        `Hora: ${selectedTime}`,
        discountAmount > 0 ? `Precio regular en salón: ${formatMoney(anchorTotal)}` : '',
        discountAmount > 0 ? `Descuento exclusivo web: -${formatMoney(discountAmount)} 🏷️` : '',
        `Total final a pagar: ${formatMoney(total)}`,
      ].filter(Boolean).join('\n');
      window.location.href = `https://wa.me/${catalog.whatsapp}?text=${encodeURIComponent(message)}`;
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'Ocurrió un error. Intenta otra vez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground flex flex-col">
      {/* Atelier Global Tab Header */}
      <header className="atelier-header">
        <div className="atelier-nav">
          <button
            type="button"
            className="brand-lockup"
            onClick={() => handleTabChange('inicio')}
            aria-label="Ir a Inicio"
          >
            <span className="brand-mark">V</span>
            <span className="brand-text">
              <strong>{catalog.businessName || 'Valentina Nails'}</strong>
              <small>Nail Atelier</small>
            </span>
          </button>

          {/* Desktop Tab Links */}
          <nav className="nav-tab-links" aria-label="Navegación principal">
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'inicio' ? 'active' : ''}`}
              onClick={() => handleTabChange('inicio')}
            >
              Inicio
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'disponibilidad' ? 'active' : ''}`}
              onClick={() => handleTabChange('disponibilidad')}
            >
              Disponibilidad
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'experiencia' ? 'active' : ''}`}
              onClick={() => handleTabChange('experiencia')}
            >
              Experiencia
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'galeria' ? 'active' : ''}`}
              onClick={() => handleTabChange('galeria')}
            >
              Galería
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'calculadora' ? 'active' : ''}`}
              onClick={() => handleTabChange('calculadora')}
            >
              Calculadora
            </button>
            <button
              type="button"
              className={`nav-tab-btn nav-tab-cta ${activeTab === 'booking' ? 'active' : ''}`}
              onClick={() => handleTabChange('booking')}
            >
              Reservar cita <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>

        {/* Mobile Horizontal Tabs */}
        <div className="mobile-tabs-bar" role="tablist" aria-label="Pestañas móviles">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inicio'}
            className={`mobile-tab-btn ${activeTab === 'inicio' ? 'active' : ''}`}
            onClick={() => handleTabChange('inicio')}
          >
            Inicio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'disponibilidad'}
            className={`mobile-tab-btn ${activeTab === 'disponibilidad' ? 'active' : ''}`}
            onClick={() => handleTabChange('disponibilidad')}
          >
            Disponibilidad
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'experiencia'}
            className={`mobile-tab-btn ${activeTab === 'experiencia' ? 'active' : ''}`}
            onClick={() => handleTabChange('experiencia')}
          >
            Experiencia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'galeria'}
            className={`mobile-tab-btn ${activeTab === 'galeria' ? 'active' : ''}`}
            onClick={() => handleTabChange('galeria')}
          >
            Galería
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'calculadora'}
            className={`mobile-tab-btn ${activeTab === 'calculadora' ? 'active' : ''}`}
            onClick={() => handleTabChange('calculadora')}
          >
            Calculadora
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'booking'}
            className={`mobile-tab-btn mobile-tab-cta ${activeTab === 'booking' ? 'active' : ''}`}
            onClick={() => handleTabChange('booking')}
          >
            Reservar
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="flex-1">
        {/* TAB 1: INICIO (Hero View Only - ZERO CONTENT BELOW) */}
        {activeTab === 'inicio' && (
          <section id="inicio" className="hero hero-tab-view relative isolate px-5 py-6 sm:px-10 lg:px-16">
            <div className="marble absolute inset-0 -z-20" />
            <ShaderBackdrop />
            <div className="blush-orb absolute -right-24 top-12 -z-10 h-96 w-96 rounded-full" />
            <div className="gold-orb" aria-hidden="true" />

            <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.06fr_.94fr] lg:items-center">
              <div>
                <p className="eyebrow">Nail atelier · Diseño a tu medida</p>
                <h1 className="hero-title mt-4">
                  Tus uñas,
                  <span>tu firma.</span>
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#5f5651] sm:text-lg">
                  Diseña tu set, conoce el precio al instante y reserva el momento perfecto para ti.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="gold-button"
                    onClick={() => handleTabChange('calculadora')}
                  >
                    Crear mi set <WandSparkles />
                  </button>
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => handleTabChange('disponibilidad')}
                  >
                    <CalendarDays /> Ver disponibilidad
                  </button>
                </div>
                <div className="hero-proof">
                  <div className="avatar-stack"><span>V</span><span>P</span><span>✿</span></div>
                  <div><div className="stars"><Star /><Star /><Star /><Star /><Star /></div><p>Detalles impecables. Experiencia personalizada.</p></div>
                </div>
              </div>

              <LiquidGlassHero
                currentShape={shape}
                onSelectShape={(newShape) => setShape(newShape)}
                currentLength={length}
                onSelectLength={(newLength) => setLength(newLength)}
                currentTechnique={technique}
                onSelectTechnique={(newTech) => setTechnique(newTech)}
                availableTechniques={displayTechniques}
                totalPrice={total}
                anchorPrice={anchorTotal}
                discountAmount={discountAmount}
                formatMoney={formatMoney}
                onStartCustomizing={() => handleTabChange('calculadora')}
              />
            </div>
          </section>
        )}

        {/* TAB 2: DISPONIBILIDAD (Calendario en vivo y próximo turno) */}
        {activeTab === 'disponibilidad' && (
          <AvailabilityView
            catalog={catalog}
            occupiedByDate={occupiedByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectSlotAndBook={handleSelectSlotAndBook}
            onGoToBooking={() => handleTabChange('booking')}
          />
        )}

        {/* TAB 3: EXPERIENCIA */}
        {activeTab === 'experiencia' && (
          <div className="tab-view-container">
            <section id="experiencia" className="px-4 py-3 sm:px-8 sm:py-4 lg:px-12 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-between overflow-hidden">
              <div className="section-heading text-center max-w-2xl mx-auto mb-2 flex-shrink-0">
                <p className="eyebrow text-xs">Experiencia Atelier</p>
                <h2 className="text-xl sm:text-2xl font-display font-medium text-[#2d221e] mt-0.5">El lujo está en los detalles</h2>
                <p className="text-xs text-[#685c56] mt-0.5">Una experiencia creada para que cada elección se sienta personal, impecable y segura.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-auto">
                <div className="experience-feature-card py-3 px-3.5">
                  <div className="experience-icon-badge mb-1.5"><Sparkles className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold mb-1">Diseño Personalizado</h3>
                  <p className="text-[0.72rem] leading-relaxed">Cada set es una obra única. Selecciona técnica, largo milimétrico, curvatura y decoraciones exclusivas.</p>
                </div>
                <div className="experience-feature-card py-3 px-3.5">
                  <div className="experience-icon-badge mb-1.5"><ShieldCheck className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold mb-1">Bioseguridad Total</h3>
                  <p className="text-[0.72rem] leading-relaxed">Herramientas esterilizadas bajo normas estrictas, insumos descartables por clienta y ambiente seguro.</p>
                </div>
                <div className="experience-feature-card py-3 px-3.5">
                  <div className="experience-icon-badge mb-1.5"><Heart className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold mb-1">Manicura Rusa</h3>
                  <p className="text-[0.72rem] leading-relaxed">Tratamiento profundo de cutículas y nivelación anatómica para un acabado limpio que dura hasta 4 semanas.</p>
                </div>
                <div className="experience-feature-card py-3 px-3.5">
                  <div className="experience-icon-badge mb-1.5"><Clock3 className="w-3.5 h-3.5" /></div>
                  <h3 className="text-sm font-semibold mb-1">Agenda en Vivo</h3>
                  <p className="text-[0.72rem] leading-relaxed">Citas exclusivas sin esperas ni sobrecupos. Selecciona tu horario disponible y confirma por WhatsApp.</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3 py-2 flex-shrink-0">
                <button type="button" className="gold-button text-xs py-2 px-4" onClick={() => handleTabChange('calculadora')}>
                  Cotizar mi set en la calculadora <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="soft-button text-xs py-2 px-4" onClick={() => handleTabChange('disponibilidad')}>
                  <CalendarDays className="w-3.5 h-3.5" /> Ver disponibilidad en agenda
                </button>
              </div>

              <div className="flex items-center justify-between text-[0.68rem] text-[#8c7b74] pt-2 border-t border-[#ebd8ce]/50 flex-shrink-0">
                <span>Lunes a viernes · {catalog.schedule.weekdays.join(', ')} · Sábado · {catalog.schedule.saturday.join(', ')}</span>
                <a className="text-[#94671e] hover:underline font-medium inline-flex items-center gap-1" href={`https://wa.me/${catalog.whatsapp}`}>
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </a>
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: GALERIA */}
        {activeTab === 'galeria' && (
          <div className="tab-view-container">
            <section id="galeria" className="inspiration-section px-4 py-3 sm:px-8 sm:py-4 lg:px-12 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-between overflow-hidden" aria-labelledby="inspiration-title">
              <div className="inspiration-heading flex items-center justify-between pb-2 border-b border-[#ebd8ce]/60 flex-shrink-0">
                <div>
                  <p className="eyebrow text-xs">Trabajos realizados</p>
                  <h2 id="inspiration-title" className="text-xl sm:text-2xl font-display font-medium text-[#2d221e] mt-0.5">Elige uno y lo replicamos</h2>
                  <p className="text-xs text-[#685c56] mt-0.5">¿No quieres configurar cada detalle? Escoge una referencia, reserva y listo.</p>
                </div>
                <div className="carousel-controls flex-shrink-0">
                  <button type="button" aria-label="Ver diseños anteriores" onClick={() => galleryRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}><ChevronLeft className="w-4 h-4" /></button>
                  <button type="button" aria-label="Ver más diseños" onClick={() => galleryRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              {designExamples.length > 0 ? (
                <div className="design-carousel flex-1 my-auto items-center py-2" ref={galleryRef}>
                  {designExamples.map((item) => {
                    const anchorPrice = getAnchorPrice(item.price);
                    return (
                      <article key={item.id} className="design-card max-h-[380px]">
                        <img src={item.imageData} alt={item.title} loading="lazy" className="h-44 object-cover" />
                        <div className="design-card-content p-3.5">
                          <div className="design-card-header mb-1.5">
                            <h3 className="text-sm">{item.title}</h3>
                            <div className="flex flex-col items-end">
                              <span className="line-through text-[0.65rem] text-[#9c8a82]">{formatMoney(anchorPrice)}</span>
                              <span className="design-tag text-xs">{formatMoney(item.price)}</span>
                            </div>
                          </div>
                          <p className="text-[0.72rem] line-clamp-2 mb-2">{item.description || 'Set de catálogo listo para replicar con técnica profesional.'}</p>
                          <button type="button" className="gold-button w-full justify-center text-xs py-1.5" onClick={() => replicateDesign(item)}>
                            Replicar este set <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-8 text-[#8c7a72] my-auto">No hay diseños cargados en este momento.</p>
              )}

              <div className="flex items-center justify-between text-[0.68rem] text-[#8c7b74] pt-2 border-t border-[#ebd8ce]/50 flex-shrink-0">
                <span>Lunes a viernes · {catalog.schedule.weekdays.join(', ')} · Sábado · {catalog.schedule.saturday.join(', ')}</span>
                <a className="text-[#94671e] hover:underline font-medium inline-flex items-center gap-1" href={`https://wa.me/${catalog.whatsapp}`}>
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </a>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: CALCULADORA */}
        {activeTab === 'calculadora' && (
          <div className="tab-view-container">
            <section id="calculadora" className="px-4 py-3 sm:px-8 sm:py-3 lg:px-12 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-between overflow-hidden">
              {/* Step Navigation Bar */}
              <div className="calc-step-nav flex-shrink-0" role="tablist" aria-label="Pasos de personalización">
                {CALC_STEPS.map((step, idx) => (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={calcStepIndex === idx}
                    className={`calc-step-tab ${calcStepIndex === idx ? 'active' : ''}`}
                    onClick={() => setCalcStepIndex(idx)}
                  >
                    <span className="step-num">{step.num}</span>
                    <span>{step.label}</span>
                  </button>
                ))}
              </div>

              {/* Main Studio: Active Step Workspace on Left, Summary Card on Right */}
              <div className="calc-studio-layout flex-1 min-h-0">
                {/* Left Workspace Panel */}
                <div className="calc-workspace-panel" data-tour="intro">
                  <div className="calc-step-body">
                    {/* STEP 1: TECNICA */}
                    {calcStepIndex === 0 && (
                      <div>
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-[#281f1c]">Elige tu técnica base</h3>
                          <p className="text-xs text-[#6a5c55]">La base perfecta para tu estilo y duración deseada.</p>
                        </div>
                        <div className="technique-grid" data-tour="technique">
                          {displayTechniques.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`technique-card ${technique === item.id ? 'selected' : ''}`}
                              onClick={() => setTechnique(item.id)}
                              aria-pressed={technique === item.id}
                            >
                              <span className="technique-icon">
                                {item.id === 'acrylic' ? <Gem /> : item.id === 'gel' ? <Heart /> : <Sparkles />}
                              </span>
                              <span>
                                <strong>{item.name}</strong>
                                <small>{item.note}</small>
                              </span>
                              <span className="technique-price">
                                {item.usesLengths && displayLengths.length
                                  ? `desde ${formatMoney(getTechniqueStartingPrice(item, displayLengths))}`
                                  : formatMoney(item.price)}
                              </span>
                              {technique === item.id && <span className="selected-check"><Check /></span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STEP 2: SILUETA Y LARGO */}
                    {calcStepIndex === 1 && (
                      <div>
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-[#281f1c]">Silueta anatómica y largo</h3>
                          <p className="text-xs text-[#6a5c55]">Compara las formas y define la extensión de tus uñas.</p>
                        </div>

                        {techniqueInfo?.usesLengths && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-[#7a5925] uppercase tracking-wider mb-2">
                              Largo milimétrico
                            </h4>
                            <div className="length-grid">
                              {displayLengths.map((item, index) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={length === item.id ? 'selected' : ''}
                                  onClick={() => setLength(item.id)}
                                  aria-pressed={length === item.id}
                                >
                                  <span className="length-line" style={{ height: `${16 + index * 3}px` }} />
                                  <strong>{item.name}</strong>
                                  <small>{formatLengthSupplement(item.price)}</small>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold text-[#7a5925] uppercase tracking-wider mb-2">
                            Forma de uña
                          </h4>
                          <div className="shape-grid" data-tour="shape">
                            {shapes.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={shape === item.id ? 'selected' : ''}
                                onClick={() => setShape(item.id)}
                                aria-pressed={shape === item.id}
                              >
                                <span className={`nail-shape ${item.className}`} />
                                <strong>{item.name}</strong>
                                {shape === item.id && <Check />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: DECORACIONES */}
                    {calcStepIndex === 2 && (
                      <div>
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-[#281f1c]">Diseños y decoraciones</h3>
                          <p className="text-xs text-[#6a5c55]">Selecciona cuántas uñas llevarán cada efecto artesanal.</p>
                        </div>
                        <div className="decoration-grid" data-tour="decorations">
                          {displayDecorations.slice(0, showAll ? displayDecorations.length : 10).map((item) => (
                            <div className={`decoration-row ${(decorations[item.id] || 0) > 0 ? 'selected' : ''}`} key={item.id}>
                              <span className="decor-icon">{item.icon}</span>
                              <span className="decor-name">
                                <strong>{item.name}</strong>
                                <small>{formatMoney(item.price)} / uña</small>
                              </span>
                              <Counter
                                label={item.name}
                                value={decorations[item.id] || 0}
                                onChange={(value) => setDecorations((current) => ({ ...current, [item.id]: value }))}
                              />
                            </div>
                          ))}
                        </div>
                        {decorationOptions.length > 10 && (
                          <button className="show-more mt-2" type="button" onClick={() => setShowAll((v) => !v)}>
                            {showAll ? 'Ver menos diseños' : `Ver ${decorationOptions.length - 10} diseños más`}
                            <ChevronRight className={showAll ? 'rotate-90' : ''} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* STEP 4: EXTRAS */}
                    {calcStepIndex === 3 && (
                      <div>
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-[#281f1c]">Últimos detalles y cuidados</h3>
                          <p className="text-xs text-[#6a5c55]">Personaliza tonos extra, cambio de forma o retiros profesionales.</p>
                        </div>
                        <div className="extras-grid" data-tour="extras">
                          <div className="extra-control">
                            <span><WandSparkles /><span><strong>Tonos extra</strong><small>2 tonos incluidos · {formatMoney(anchorCatalog.extras.extraTone)} c/u</small></span></span>
                            <Counter label="tonos extra" value={extraTones} onChange={setExtraTones} />
                          </div>
                          <div className="extra-control">
                            <span><Sparkles /><span><strong>Cambio de forma</strong><small>{formatMoney(anchorCatalog.extras.changeShape)} set</small></span></span>
                            <button type="button" className={`toggle-pill ${changeShape ? 'active' : ''}`} onClick={() => setChangeShape((v) => !v)} aria-pressed={changeShape}>
                              {changeShape ? 'Incluido' : 'No'}
                            </button>
                          </div>
                          <div className="extra-control">
                            <span><Sparkles /><span><strong>Retiro acrílico</strong><small>{formatMoney(anchorCatalog.extras.removalAcrylic)} / uña</small></span></span>
                            <Counter label="retiro acrílico" value={removal.acrylic} onChange={(v) => setRemoval((c) => ({ ...c, acrylic: v }))} />
                          </div>
                          <div className="extra-control">
                            <span><Sparkles /><span><strong>Retiro gel</strong><small>{formatMoney(anchorCatalog.extras.removalGel)} / uña</small></span></span>
                            <Counter label="retiro gel" value={removal.gel} onChange={(v) => setRemoval((c) => ({ ...c, gel: v }))} />
                          </div>
                          <div className="extra-control">
                            <span><WandSparkles /><span><strong>Reposición acrílico</strong><small>{formatMoney(anchorCatalog.extras.repairAcrylic)} / uña</small></span></span>
                            <Counter label="reposición acrílico" value={repairs.acrylic} onChange={(v) => setRepairs((c) => ({ ...c, acrylic: v }))} />
                          </div>
                          <div className="extra-control">
                            <span><WandSparkles /><span><strong>Reposición gel</strong><small>{formatMoney(anchorCatalog.extras.repairGel)} / uña</small></span></span>
                            <Counter label="reposición gel" value={repairs.gel} onChange={(v) => setRepairs((c) => ({ ...c, gel: v }))} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step Footer Navigation */}
                  <div className="calc-step-footer">
                    {calcStepIndex > 0 ? (
                      <button
                        type="button"
                        className="soft-button text-xs py-1.5 px-3"
                        onClick={() => setCalcStepIndex(calcStepIndex - 1)}
                      >
                        ← Anterior
                      </button>
                    ) : <div />}

                    {calcStepIndex < 3 ? (
                      <button
                        type="button"
                        className="gold-button text-xs py-1.5 px-3.5"
                        onClick={() => setCalcStepIndex(calcStepIndex + 1)}
                      >
                        Siguiente paso ({CALC_STEPS[calcStepIndex + 1].label}) →
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="gold-button text-xs py-1.5 px-3.5"
                        onClick={goToBooking}
                      >
                        Elegir fecha de cita <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Compact Summary Card */}
                <aside className="compact-summary-card" data-tour="summary">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="eyebrow text-xs">Tu selección</p>
                      <span className="text-[0.68rem] text-[#94671e] font-semibold uppercase">Atelier</span>
                    </div>
                    <h3 className="text-base font-semibold text-[#281f1c] mb-1.5">Un set muy tú</h3>
                    <div className="summary-preview mb-2 py-0.5">
                      <span
                        className={`nail-shape ${shapeInfo.className} ${
                          techniqueInfo?.usesLengths ? getNailLengthClass(length, lengths) : 'len-3'
                        }`}
                      />
                      <Sparkles className="w-4 h-4 text-[#c9a054]" />
                    </div>
                    <ul className="text-xs space-y-1 max-h-28 overflow-y-auto pr-1 mb-2">
                      {summary.map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-[#5e514a]">
                          <Check className="w-3 h-3 text-[#c9a054] flex-shrink-0" />
                          <span className="truncate">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="summary-total mb-2 pt-2 border-t border-[#ebd8ce]">
                      {discountAmount > 0 ? (
                        <div className="summary-discount-box p-2">
                          <div className="summary-discount-row text-xs">
                            <span>Precio en salón:</span>
                            <span className="line-through-price">{formatMoney(anchorTotal)}</span>
                          </div>
                          <div className="summary-discount-row promo-highlight text-xs py-0.5">
                            <span className="promo-badge text-[0.68rem]">
                              <Sparkles className="w-3 h-3" /> Descuento web:
                            </span>
                            <strong className="promo-value text-xs">-{formatMoney(discountAmount)}</strong>
                          </div>
                          <div className="summary-discount-row final-row pt-1">
                            <span className="text-xs font-semibold">Total final:</span>
                            <strong className="final-total text-base">{formatMoney(total)}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs">
                            Precio estimado
                            <small className="block text-[0.65rem] text-[#8c7a72]">
                              {technique ? 'Soles' : 'Desde S/ 0'}
                            </small>
                          </span>
                          <strong className="text-lg text-[#281f1c]">{formatMoney(total)}</strong>
                        </div>
                      )}
                    </div>

                    <Button className="summary-cta w-full py-2 text-xs" onClick={goToBooking}>
                      {technique || selectedDesign ? <>Elegir fecha <ArrowRight className="w-3.5 h-3.5" /></> : <>Elegir técnica <ArrowRight className="w-3.5 h-3.5" /></>}
                    </Button>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        className={`copy-quote-button flex-1 text-[0.68rem] py-1 ${copiedQuote ? 'copied' : ''}`}
                        onClick={handleCopyQuote}
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedQuote ? '¡Copiada!' : 'Copiar'}</span>
                      </button>
                      <button className="reset-button text-[0.68rem] py-1" type="button" onClick={reset}>
                        <RotateCcw className="w-3 h-3" /> Limpiar
                      </button>
                    </div>
                  </div>
                </aside>
              </div>

              {/* Micro Footer Line */}
              <div className="flex items-center justify-between text-[0.68rem] text-[#8c7b74] pt-2 border-t border-[#ebd8ce]/50 flex-shrink-0">
                <span>Precios en Soles (PEN) · Incluye manicura rusa y preparación anatómica</span>
                <a className="text-[#94671e] hover:underline font-medium inline-flex items-center gap-1" href={`https://wa.me/${catalog.whatsapp}`}>
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </a>
              </div>

              <FloatingSummaryBar
                summary={summary}
                total={total}
                anchorTotal={anchorTotal}
                discountAmount={discountAmount}
                formatMoney={formatMoney}
                hasTechnique={Boolean(technique)}
                hasSelectedDesign={Boolean(selectedDesign)}
                onNavigateToBooking={goToBooking}
                onCopyQuote={handleCopyQuote}
                onReset={reset}
                copiedQuote={copiedQuote}
                stage={stage}
              />
            </section>
          </div>
        )}

        {/* TAB 5: RESERVAR CITA */}
        {activeTab === 'booking' && (
          <div className="tab-view-container">
            <div className="flex flex-col h-full gap-2 min-h-0">
              {/* Header Mini-Bar */}
              <div className="flex items-center justify-between bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#eaded8]/60 shadow-xs flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="eyebrow text-xs mb-0">Atelier Valentina</span>
                  <span className="text-[#c9a054]">·</span>
                  <h2 className="text-sm md:text-base font-serif font-bold text-[#281f1c] mb-0">
                    Agenda tu cita
                  </h2>
                  {selectedDesign && (
                    <span className="hidden sm:inline text-xs text-[#8c7b74] truncate max-w-xs">
                      (Reservando “{selectedDesign.title}”)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-amber-50/90 border border-amber-200/80 rounded-full px-2.5 py-0.5">
                  <span className="text-[0.68rem] text-[#8a7e78] uppercase font-semibold">Total:</span>
                  {discountAmount > 0 && (
                    <span className="text-xs line-through text-[#8e817b]">{formatMoney(anchorTotal)}</span>
                  )}
                  <strong className="text-sm font-serif font-bold text-[#9c6d20]">{formatMoney(total)}</strong>
                  {discountAmount > 0 && (
                    <span className="text-[0.62rem] bg-[#c9a054] text-white px-1.5 py-0.5 rounded-full font-bold">
                      Beneficio web -{formatMoney(discountAmount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Main 2-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0">
                {/* Left Column: Form & Confirmation (md:col-span-5) */}
                <div
                  className="md:col-span-5 bg-white/95 rounded-2xl border border-[#eaded8] p-3.5 shadow-sm flex flex-col justify-between min-h-0 overflow-y-auto"
                  data-tour="client-data"
                >
                  <div className="space-y-2">
                    <div>
                      <label htmlFor="name" className="text-xs font-bold text-[#4a3e39] block mb-1">
                        Nombre de la clienta
                      </label>
                      <Input
                        id="name"
                        value={clientName}
                        onChange={(event) => setClientName(event.target.value)}
                        placeholder="Tu nombre completo"
                        className="h-8 text-xs rounded-xl bg-[#fffaf8]"
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="text-xs font-bold text-[#4a3e39] block mb-1">
                        Teléfono WhatsApp
                      </label>
                      <Input
                        id="phone"
                        value={clientPhone}
                        onChange={(event) => setClientPhone(event.target.value)}
                        placeholder="Ej. 987 654 321"
                        className="h-8 text-xs rounded-xl bg-[#fffaf8]"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>

                    {/* Mini Summary */}
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[#fdf5f6] border border-[#ecdde1] text-xs">
                      <span className="w-7 h-7 rounded-lg bg-[#f5e7cd] text-[#9b6b1e] flex items-center justify-center flex-shrink-0">
                        <Gem className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="text-xs text-[#281f1c] block truncate">{summary[0]}</strong>
                        <p className="text-[0.65rem] text-[#857873] truncate">
                          {summary.slice(1, 4).join(' · ')}{summary.length > 4 ? ` · +${summary.length - 4}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Selection Pill */}
                    <div className="text-[0.72rem] text-[#6d5e56] bg-[#faf6f3] rounded-xl p-2 border border-[#eaded8]/70 flex items-center justify-between">
                      <span className="flex items-center gap-1 font-medium truncate">
                        <CalendarDays className="w-3.5 h-3.5 text-[#94671e] flex-shrink-0" />
                        <span className="truncate">
                          {selectedDate ? formatBookingDatePEN(selectedDate) : 'Fecha sin elegir'}
                        </span>
                      </span>
                      <span className="font-semibold text-[#94671e] ml-1 flex-shrink-0">
                        {selectedTime || 'Hora pendiente'}
                      </span>
                    </div>

                    {error && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-center" role="alert">
                        {error}
                      </p>
                    )}
                    {confirmed && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Cita guardada. Abriendo WhatsApp…
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-[#ebd8ce]/50 space-y-1.5" data-tour="confirm">
                    <Button
                      className="whatsapp-button w-full h-9 text-xs font-semibold rounded-full flex items-center justify-center gap-2"
                      onClick={confirmBooking}
                      disabled={submitting || confirmed || !authReady || catalogLoading}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {submitting ? 'Guardando cita…' : 'Guardar y confirmar por WhatsApp'}
                    </Button>
                    <div className="flex items-center justify-between text-[0.68rem] px-1">
                      <button
                        type="button"
                        className="text-[#936820] hover:underline"
                        onClick={() => {
                          setSelectedDesign(null);
                          setStage('design');
                          handleTabChange('calculadora');
                        }}
                      >
                        ← {selectedDesign ? 'Personalizar set' : 'Editar diseño'}
                      </button>
                      <button
                        type="button"
                        className="text-[#897d77] hover:text-red-500 flex items-center gap-1"
                        onClick={reset}
                      >
                        <Trash2 className="w-3 h-3" /> Limpiar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Calendar & Slots (md:col-span-7) */}
                <div
                  className="md:col-span-7 bg-white/95 rounded-2xl border border-[#eaded8] p-3 shadow-sm flex flex-col justify-between min-h-0"
                  data-tour="calendar"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#eaded8]/60 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-[#a7782a]" />
                      <div>
                        <h4 className="text-xs font-bold text-[#281f1c]">
                          {selectedDate ? formatBookingDatePEN(selectedDate) : '1. Elige una fecha'}
                        </h4>
                        <p className="text-[0.65rem] text-[#897d77]">
                          {selectedDate ? '2. Selecciona un horario disponible' : 'Domingos permanecemos cerradas'}
                        </p>
                      </div>
                    </div>
                    <span className="live-schedule-note text-[0.62rem] py-0.5 px-2">
                      <i /> Agenda en vivo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 flex-1 min-h-0 items-center py-2">
                    {/* Calendar */}
                    <div className="sm:col-span-6 flex justify-center">
                      <Calendar
                        mode="single"
                        locale={es}
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today || date.getDay() === 0 || isFullyBooked(date);
                        }}
                        modifiers={{ fullyBooked: isFullyBooked }}
                        modifiersClassNames={{ fullyBooked: 'fully-booked-day' }}
                        className="booking-calendar scale-95 origin-top p-1"
                        classNames={{
                          month_grid: 'w-full border-collapse',
                          day: 'relative aspect-square h-full w-full rounded-full p-0 text-center text-xs',
                          today: 'rounded-full bg-[#f8e7eb] text-[#8d4b60]',
                        }}
                      />
                    </div>

                    {/* Time Slots */}
                    <div className="sm:col-span-6 flex flex-col h-full justify-center">
                      <p className="text-[0.7rem] font-semibold text-[#5e514a] mb-1.5">
                        Turnos del día:
                      </p>
                      {selectedDate ? (
                        <div className="time-grid max-h-[195px] overflow-y-auto pr-1 gap-1.5">
                          {times.map((time) => {
                            const unavailable = occupied.includes(time);
                            return (
                              <button
                                key={time}
                                type="button"
                                disabled={unavailable || loadingSlots}
                                className={`text-xs py-1.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all min-h-0 ${
                                  selectedTime === time
                                    ? 'border-[#b78633] bg-[#f9e8ec] text-[#281f1c] font-semibold'
                                    : unavailable
                                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed line-through'
                                    : 'border-[#eaded8] bg-white hover:border-[#c9a054] text-[#4a3e39]'
                                }`}
                                onClick={() => setSelectedTime(time)}
                              >
                                <span className="font-medium">{time}</span>
                                <small className="text-[0.58rem] font-normal">{unavailable ? 'Ocupado' : 'Disponible'}</small>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-[#8c7b74]">
                          Selecciona una fecha en el calendario para ver los horarios disponibles.
                        </div>
                      )}
                      {selectedDate && times.length > 0 && times.every((time) => occupied.includes(time)) && (
                        <p className="fully-booked-message mt-1 text-xs">
                          Este día ya está completo. Selecciona otra fecha disponible.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Micro Footer Line */}
              <div className="flex items-center justify-between text-[0.68rem] text-[#8c7b74] pt-1.5 border-t border-[#ebd8ce]/50 flex-shrink-0">
                <span>Lunes a viernes · {catalog.schedule.weekdays.join(', ')} · Sábado · {catalog.schedule.saturday.join(', ')}</span>
                <a className="text-[#94671e] hover:underline font-medium inline-flex items-center gap-1" href={`https://wa.me/${catalog.whatsapp}`}>
                  <MessageCircle className="w-3 h-3" /> WhatsApp directo
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <ChatAssistant
        catalog={catalog}
        summary={summary}
        total={total}
        onNavigateToBooking={goToBooking}
        onNavigateToGallery={() => {
          handleTabChange('galeria');
        }}
        onNavigateToCalculator={() => {
          handleTabChange('calculadora');
        }}
        onStartTour={() => {
          handleTabChange('calculadora');
          setWizardStep(0);
        }}
      />

      {wizardStep !== null && (
        <>
          {tourTarget.width > 0 && <div className="tour-spotlight" style={tourTarget} aria-hidden="true" />}
          <dialog
            className={`tour-card ${tourCard.placement}`}
            style={{ top: tourCard.top, left: tourCard.left, width: tourCard.width }}
            open
            aria-labelledby="tour-title"
          >
            <div className="tour-card-top">
              <span>Paso {wizardStep + 1} de {TOUR_STEPS.length}</span>
              <button type="button" onClick={() => closeWizard()} aria-label="Cerrar recorrido"><X /></button>
            </div>
            <div className="tour-progress" aria-hidden="true"><span style={{ width: `${((wizardStep + 1) / TOUR_STEPS.length) * 100}%` }} /></div>
            <h2 id="tour-title">{TOUR_STEPS[wizardStep].title}</h2>
            <p>{TOUR_STEPS[wizardStep].copy}</p>
            <div className="tour-tip"><Check /> {TOUR_STEPS[wizardStep].tip}</div>
            <div className="tour-actions">
              {wizardStep > 0 ? <button type="button" onClick={() => setWizardStep(wizardStep - 1)}>Atrás</button> : <button type="button" onClick={() => closeWizard()}>Omitir</button>}
              <Button onClick={() => wizardStep === TOUR_STEPS.length - 1 ? closeWizard() : setWizardStep(wizardStep + 1)}>
                {wizardStep === TOUR_STEPS.length - 1 ? 'Terminar' : 'Mostrar siguiente'} <ArrowRight />
              </Button>
            </div>
          </dialog>
        </>
      )}
    </main>
  );
}
