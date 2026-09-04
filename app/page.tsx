'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gem,
  Heart,
  HelpCircle,
  MessageCircle,
  Minus,
  Paintbrush,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
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
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShaderBackdrop } from '@/components/shader-backdrop';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_CATALOG, normalizeCatalog, type SalonCatalog } from '@/lib/catalog';
import type { DesignExample } from '@/lib/designs';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

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

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function ChatAssistant({ summary, total }: { summary: string[]; total: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de Valentina Nails. Puedo orientarte con técnicas, diseños, precios y reservas.' },
  ]);
  const chatApiUrl = import.meta.env.VITE_CHAT_API_URL as string | undefined;

  const localAnswer = (question: string) => {
    const normalized = question.toLowerCase();
    if (normalized.includes('precio') || normalized.includes('cuánto')) return `Tu selección actual está estimada en ${formatMoney(total)}. El total cambia automáticamente cuando agregas o quitas opciones.`;
    if (normalized.includes('cita') || normalized.includes('reserv')) return 'Diseña tu set o elige una foto de la galería, toca “Elegir fecha”, completa tus datos y selecciona un horario disponible.';
    if (normalized.includes('gel') || normalized.includes('acrílico') || normalized.includes('rubber')) return 'El acrílico permite construir largo y estructura; el gel semipermanente aporta color duradero; y el rubber gel refuerza la uña natural con flexibilidad.';
    return 'Puedo ayudarte a elegir técnica, entender los extras o completar tu reserva. Cuéntame qué estilo, largo o acabado buscas.';
  };

  const send = async (preset?: string) => {
    const question = (preset ?? text).trim();
    if (!question || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setText('');
    setSending(true);
    try {
      if (!chatApiUrl) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        setMessages((current) => [...current, { role: 'assistant', content: localAnswer(question) }]);
        return;
      }
      const response = await fetch(chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages.slice(-10), context: { selection: summary, estimatedPrice: total } }),
      });
      if (!response.ok) throw new Error('El asistente no está disponible en este momento.');
      const data = await response.json() as { answer?: string };
      setMessages((current) => [...current, { role: 'assistant', content: data.answer || localAnswer(question) }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: `${localAnswer(question)} Si necesitas una recomendación más específica, escríbenos por WhatsApp.` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`chat-assistant ${open ? 'open' : ''}`}>
      {open && (
        <section className="chat-panel" aria-label="Asistente de Valentina Nails">
          <header><span><Bot /></span><div><strong>Asistente Valentina</strong><small><i /> Lista para ayudarte</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat"><X /></button></header>
          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => <p key={`${message.role}-${index}`} className={message.role}>{message.content}</p>)}
            {sending && <p className="assistant typing">Pensando…</p>}
          </div>
          {messages.length === 1 && <div className="chat-prompts">
            {['¿Qué técnica me conviene?', '¿Cómo reservo?', '¿Cuál es mi precio?'].map((prompt) => <button type="button" key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}
          </div>}
          <form onSubmit={(event) => { event.preventDefault(); void send(); }}><input value={text} onChange={(event) => setText(event.target.value)} maxLength={600} placeholder="Escribe tu pregunta…" aria-label="Mensaje para el asistente" /><button type="submit" disabled={!text.trim() || sending} aria-label="Enviar mensaje"><Send /></button></form>
        </section>
      )}
      <button className="chat-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}><Bot /><span>{open ? 'Cerrar' : '¿Te ayudo?'}</span></button>
    </div>
  );
}

export default function Home() {
  const [catalog, setCatalog] = useState<SalonCatalog>(() => structuredClone(DEFAULT_CATALOG));
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [technique, setTechnique] = useState('acrylic');
  const [length, setLength] = useState('length-4');
  const [shape, setShape] = useState('stiletto');
  const [decorations, setDecorations] = useState<Record<string, number>>({});
  const [extraTones, setExtraTones] = useState(0);
  const [changeShape, setChangeShape] = useState(false);
  const [removal, setRemoval] = useState({ acrylic: 0, gel: 0 });
  const [repairs, setRepairs] = useState({ acrylic: 0, gel: 0 });
  const [showAll, setShowAll] = useState(false);
  const [stage, setStage] = useState<'design' | 'booking'>('design');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [occupied, setOccupied] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [wizardStep, setWizardStep] = useState<number | null>(null);
  const [tourTarget, setTourTarget] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tourCard, setTourCard] = useState({ top: 16, left: 16, width: 360, placement: 'below' as 'above' | 'below' });
  const [designExamples, setDesignExamples] = useState<DesignExample[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignExample | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const techniques = catalog.techniques.filter((item) => item.active);
  const lengths = catalog.lengths.filter((item) => item.active);
  const shapes = catalog.shapes.filter((item) => item.active);
  const decorationOptions = catalog.decorations.filter((item) => item.active);
  const techniqueInfo = techniques.find((item) => item.id === technique) || techniques[0] || DEFAULT_CATALOG.techniques[0];
  const lengthInfo = lengths.find((item) => item.id === length) || lengths[0] || DEFAULT_CATALOG.lengths[0];
  const shapeInfo = shapes.find((item) => item.id === shape) || shapes[0] || DEFAULT_CATALOG.shapes[0];
  const brandName = catalog.businessName.replace(/by priscila/gi, '').trim() || 'Valentina Nails';
  const startingPrice = Math.min(
    ...techniques.map((item) => item.usesLengths && lengths.length ? Math.min(...lengths.map((option) => option.price)) : item.price),
  );

  const customTotal = useMemo(() => {
    const base = techniqueInfo.usesLengths ? lengthInfo.price : techniqueInfo.price;
    const decorationTotal = decorationOptions.reduce(
      (sum, item) => sum + (decorations[item.id] || 0) * item.price,
      0,
    );
    return (
      base +
      decorationTotal +
      extraTones * catalog.extras.extraTone +
      (changeShape ? catalog.extras.changeShape : 0) +
      removal.acrylic * catalog.extras.removalAcrylic +
      removal.gel * catalog.extras.removalGel +
      repairs.acrylic * catalog.extras.repairAcrylic +
      repairs.gel * catalog.extras.repairGel
    );
  }, [techniqueInfo, lengthInfo.price, decorationOptions, decorations, extraTones, changeShape, removal, repairs, catalog.extras]);

  const total = selectedDesign?.price ?? customTotal;

  const selectedDecorations = decorationOptions.filter((item) => (decorations[item.id] || 0) > 0);
  const customSummary = [
    `${techniqueInfo.name}${techniqueInfo.usesLengths ? ` · ${lengthInfo.name.toLowerCase()}` : ''}`,
    `Forma ${shapeInfo.name}`,
    ...selectedDecorations.map((item) => `${item.name} ×${decorations[item.id]} uña${decorations[item.id] > 1 ? 's' : ''}`),
    ...(extraTones ? [`${extraTones} tono${extraTones > 1 ? 's' : ''} extra`] : []),
    ...(changeShape ? ['Cambio de forma'] : []),
    ...(removal.acrylic ? [`Retiro acrílico ×${removal.acrylic}`] : []),
    ...(removal.gel ? [`Retiro gel ×${removal.gel}`] : []),
    ...(repairs.acrylic ? [`Reposición acrílico ×${repairs.acrylic}`] : []),
    ...(repairs.gel ? [`Reposición gel ×${repairs.gel}`] : []),
  ];
  const summary = selectedDesign
    ? [`Diseño para replicar: ${selectedDesign.title}`, selectedDesign.description || 'Referencia visual seleccionada']
    : customSummary;

  const day = selectedDate?.getDay();
  const times = day === 6 ? catalog.schedule.saturday : catalog.schedule.weekdays;

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
    if (!techniques.some((item) => item.id === technique) && techniques[0]) setTechnique(techniques[0].id);
    if (!lengths.some((item) => item.id === length) && lengths[0]) setLength(lengths[0].id);
    if (!shapes.some((item) => item.id === shape) && shapes[0]) setShape(shapes[0].id);
  }, [catalog, technique, length, shape, techniques, lengths, shapes]);

  useEffect(() => {
    if (!selectedDate) return;
    setSelectedTime('');
    setLoadingSlots(true);
    getDocs(query(collection(db, 'slots'), where('bookingDate', '==', dateKey(selectedDate))))
      .then((snapshot) => setOccupied(snapshot.docs.map((slot) => String(slot.data().bookingTime))))
      .catch(() => setOccupied([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  const reset = () => {
    setTechnique(techniques[0]?.id || 'acrylic');
    setLength(lengths[0]?.id || 'length-1');
    setShape(shapes[0]?.id || 'stiletto');
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
    setStage('booking');
    setTimeout(() => document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const replicateDesign = (design: DesignExample) => {
    setSelectedDesign(design);
    setStage('booking');
    setTimeout(() => document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const closeWizard = (startDesign = false) => {
    try {
      window.localStorage.setItem('valentina-client-guide-v1', 'seen');
    } catch {
      // The guide still closes when browser storage is unavailable.
    }
    setWizardStep(null);
    if (startDesign) setTimeout(() => document.querySelector('#calculadora')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
    const payload = {
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
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
      const displayDate = selectedDate.toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const message = [
        '¡Hola! Quiero confirmar mi cita 🌸',
        `Nombre: ${clientName.trim()}`,
        clientPhone.trim() ? `Teléfono: ${clientPhone.trim()}` : '',
        `Servicio(s): ${summary.join(', ')}`,
        `Fecha: ${displayDate}`,
        `Hora: ${selectedTime}`,
        `Precio estimado: ${formatMoney(total)}`,
      ].filter(Boolean).join('\n');
      window.location.href = `https://wa.me/${catalog.whatsapp}?text=${encodeURIComponent(message)}`;
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'Ocurrió un error. Intenta otra vez.');
      if (selectedDate) {
        const snapshot = await getDocs(query(collection(db, 'slots'), where('bookingDate', '==', dateKey(selectedDate))));
        setOccupied(snapshot.docs.map((slot) => String(slot.data().bookingTime)));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <section id="inicio" className="hero relative isolate border-b border-[#b9944f]/25 px-5 pb-20 pt-7 sm:px-10 lg:px-16">
        <div className="marble absolute inset-0 -z-20" />
        <ShaderBackdrop />
        <div className="blush-orb absolute -right-24 top-20 -z-10 h-80 w-80 rounded-full" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="#inicio" className="brand-mark" aria-label={`Inicio ${brandName}`}>
            <span>V</span>
            <span className="brand-name">{brandName.toUpperCase()}<small>by Priscila</small></span>
          </a>
          <div className="hidden items-center gap-7 md:flex">
            <a className="nav-link" href="#experiencia">Experiencia</a>
            <a className="nav-link" href="#calculadora">Calculadora</a>
            <a className="gold-button" href="#booking" onClick={goToBooking}>
              Reservar cita <ArrowRight />
            </a>
          </div>
          <a className="nav-mobile" href="#calculadora" aria-label="Ir a la calculadora"><Sparkles /></a>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-12 pb-4 pt-16 lg:grid-cols-[1.06fr_.94fr] lg:items-center lg:pt-24">
          <div>
            <p className="eyebrow">Nail atelier · Diseño a tu medida</p>
            <h1 className="hero-title mt-5">
              Tus uñas,
              <span>tu firma.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#5f5651] sm:text-lg">
              Diseña tu set, conoce el precio al instante y reserva el momento perfecto para ti.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a className="gold-button" href="#calculadora">
                Crear mi set <WandSparkles />
              </a>
              <a className="soft-button" href="#booking" onClick={goToBooking}>
                <CalendarDays /> Ver disponibilidad
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack"><span>V</span><span>P</span><span>✿</span></div>
              <div><div className="stars"><Star /><Star /><Star /><Star /><Star /></div><p>Detalles impecables. Experiencia personalizada.</p></div>
            </div>
          </div>

          <div className="hero-art">
            <img src={`${import.meta.env.BASE_URL}og.png`} alt="Manicure almendra en rosa blush con un delicado detalle dorado" />
            <div className="hero-price"><span>sets desde</span><strong>{formatMoney(Number.isFinite(startingPrice) ? startingPrice : 0)}</strong></div>
          </div>
        </div>
      </section>

      <section id="experiencia" className="experience-strip">
        <div><Sparkles /><span><strong>Diseño personalizado</strong>Elige cada detalle de tu set</span></div>
        <div><ShieldCheck /><span><strong>Precio transparente</strong>Sin sorpresas al reservar</span></div>
        <div><CalendarDays /><span><strong>Agenda simple</strong>Tu horario en pocos pasos</span></div>
      </section>

      {designExamples.length > 0 && (
        <section className="inspiration-section" aria-labelledby="inspiration-title">
          <div className="inspiration-heading">
            <div><p className="eyebrow">Trabajos realizados</p><h2 id="inspiration-title">Elige uno y lo replicamos</h2><p>¿No quieres configurar cada detalle? Escoge una referencia, reserva y listo.</p></div>
            <div className="carousel-controls">
              <button type="button" aria-label="Ver diseños anteriores" onClick={() => galleryRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}><ChevronLeft /></button>
              <button type="button" aria-label="Ver más diseños" onClick={() => galleryRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}><ChevronRight /></button>
            </div>
          </div>
          <div className="design-carousel" ref={galleryRef}>
            {designExamples.map((design) => (
              <article className="design-example" key={design.id}>
                <div className="design-example-photo"><img src={design.imageData} alt={design.title} loading="lazy" /></div>
                <div className="design-example-copy">
                  <span>Diseño listo · {formatMoney(design.price)}</span>
                  <h3>{design.title}</h3>
                  <p>{design.description}</p>
                  <Button onClick={() => replicateDesign(design)}>Quiero replicar este diseño <ArrowRight /></Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="calculadora" className="builder-section">
        <div className="section-heading" data-tour="intro">
          <p className="eyebrow">Tu set, a tu manera</p>
          <h2>Diseña y cotiza</h2>
          <p>Combina técnica, forma y decoraciones. El precio se actualiza en cada elección.</p>
        </div>

        <div className="builder-layout">
          <div className="builder-main">
            <div className="step-card">
              <div className="step-title"><span>01</span><div><h3>Elige tu técnica</h3><p>La base perfecta para tu estilo.</p></div></div>
              <div className="technique-grid" data-tour="technique">
                {techniques.map((item) => (
                  <button key={item.id} type="button" className={`technique-card ${technique === item.id ? 'selected' : ''}`} onClick={() => setTechnique(item.id)} aria-pressed={technique === item.id}>
                    <span className="technique-icon">{item.id === 'acrylic' ? <Gem /> : item.id === 'gel' ? <Heart /> : <Sparkles />}</span>
                    <span><strong>{item.name}</strong><small>{item.note}</small></span>
                    <span className="technique-price">{item.usesLengths && lengths.length ? `desde ${formatMoney(Math.min(...lengths.map((option) => option.price)))}` : formatMoney(item.price)}</span>
                    {technique === item.id && <span className="selected-check"><Check /></span>}
                  </button>
                ))}
              </div>
            </div>

            {techniqueInfo.usesLengths && (
              <div className="step-card">
                <div className="step-title"><span>02</span><div><h3>Define el largo</h3><p>Del natural al extra largo.</p></div></div>
                <div className="length-grid">
                  {lengths.map((item, index) => (
                    <button key={item.id} type="button" className={length === item.id ? 'selected' : ''} onClick={() => setLength(item.id)} aria-pressed={length === item.id}>
                      <span className="length-line" style={{ height: `${18 + index * 3}px` }} />
                      <strong>{item.name}</strong><small>{formatMoney(item.price)}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="step-card">
              <div className="step-title"><span>{techniqueInfo.usesLengths ? '03' : '02'}</span><div><h3>Elige la forma</h3><p>Una silueta que hable de ti.</p></div></div>
              <div className="shape-grid" data-tour="shape">
                {shapes.map((item) => (
                  <button key={item.id} type="button" className={shape === item.id ? 'selected' : ''} onClick={() => setShape(item.id)} aria-pressed={shape === item.id}>
                    <span className={`nail-shape ${item.className}`} /><strong>{item.name}</strong>{shape === item.id && <Check />}
                  </button>
                ))}
              </div>
            </div>

            <div className="step-card">
              <div className="step-title"><span>{techniqueInfo.usesLengths ? '04' : '03'}</span><div><h3>Agrega decoraciones</h3><p>Selecciona cuántas uñas llevarán cada diseño.</p></div></div>
              <div className="decoration-grid" data-tour="decorations">
                {decorationOptions.slice(0, showAll ? decorationOptions.length : 10).map((item) => (
                  <div className={`decoration-row ${(decorations[item.id] || 0) > 0 ? 'selected' : ''}`} key={item.id}>
                    <span className="decor-icon">{item.icon}</span>
                    <span className="decor-name"><strong>{item.name}</strong><small>{formatMoney(item.price)} / uña</small></span>
                    <Counter label={item.name} value={decorations[item.id] || 0} onChange={(value) => setDecorations((current) => ({ ...current, [item.id]: value }))} />
                  </div>
                ))}
              </div>
              {decorationOptions.length > 10 && <button className="show-more" type="button" onClick={() => setShowAll((value) => !value)}>
                {showAll ? 'Ver menos diseños' : `Descubrir ${decorationOptions.length - 10} diseños más`} <ChevronRight className={showAll ? 'rotate-90' : ''} />
              </button>}
            </div>

            <div className="step-card">
              <div className="step-title"><span>{techniqueInfo.usesLengths ? '05' : '04'}</span><div><h3>Últimos detalles</h3><p>Personaliza tonos, retiro y reposiciones.</p></div></div>
              <div className="extras-grid">
                <div className="extra-control"><span><Paintbrush /><span><strong>Tonos extra</strong><small>2 tonos lisos incluidos · +{formatMoney(catalog.extras.extraTone)} c/u</small></span></span><Counter label="tono extra" value={extraTones} onChange={setExtraTones} max={8} /></div>
                <button className={`extra-toggle ${changeShape ? 'selected' : ''}`} type="button" onClick={() => setChangeShape((value) => !value)} aria-pressed={changeShape}>
                  <span><RotateCcw /><span><strong>Cambio de forma</strong><small>Precio único</small></span></span><b>+{formatMoney(catalog.extras.changeShape)}</b>{changeShape && <Check />}
                </button>
                <div className="extra-control"><span><Trash2 /><span><strong>Retiro acrílico</strong><small>{formatMoney(catalog.extras.removalAcrylic)} por uña</small></span></span><Counter label="retiro acrílico" value={removal.acrylic} onChange={(value) => setRemoval((current) => ({ ...current, acrylic: value }))} /></div>
                <div className="extra-control"><span><Trash2 /><span><strong>Retiro gel semi</strong><small>{formatMoney(catalog.extras.removalGel)} por uña</small></span></span><Counter label="retiro gel" value={removal.gel} onChange={(value) => setRemoval((current) => ({ ...current, gel: value }))} /></div>
                <div className="extra-control"><span><WandSparkles /><span><strong>Reposición acrílico</strong><small>{formatMoney(catalog.extras.repairAcrylic)} por uña</small></span></span><Counter label="reposición acrílico" value={repairs.acrylic} onChange={(value) => setRepairs((current) => ({ ...current, acrylic: value }))} /></div>
                <div className="extra-control"><span><WandSparkles /><span><strong>Reposición gel</strong><small>{formatMoney(catalog.extras.repairGel)} por uña</small></span></span><Counter label="reposición gel" value={repairs.gel} onChange={(value) => setRepairs((current) => ({ ...current, gel: value }))} /></div>
              </div>
            </div>
          </div>

          <aside className="summary-card" data-tour="summary">
            <p className="eyebrow">Tu selección</p>
            <h3>Un set muy tú</h3>
            <div className="summary-preview"><span className={`nail-shape ${shapeInfo.className}`} /><Sparkles /></div>
            <ul>{summary.map((item) => <li key={item}><Check />{item}</li>)}</ul>
            <div className="summary-total"><span>Precio estimado<small>MXN · sujeto a valoración</small></span><strong>{formatMoney(total)}</strong></div>
            <Button className="summary-cta" onClick={goToBooking}>Elegir fecha <ArrowRight /></Button>
            <button className="reset-button" type="button" onClick={reset}><RotateCcw /> Limpiar selección</button>
          </aside>
        </div>
      </section>

      {stage === 'booking' && (
        <section id="booking" className="booking-section">
          <div className="booking-header"><div><p className="eyebrow">Tu momento</p><h2>Agenda tu cita</h2><p>{selectedDesign ? `Reservando “${selectedDesign.title}”. Completa tus datos y elige un horario.` : 'Elige una fecha disponible y el horario que mejor te quede.'}</p></div><div className="booking-total"><span>Tu set</span><strong>{formatMoney(total)}</strong></div></div>
          <div className="booking-grid">
            <div className="booking-form" data-tour="client-data">
              <label htmlFor="name">Nombre de la clienta</label>
              <Input id="name" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Tu nombre completo" className="booking-input" autoComplete="name" />
              <label htmlFor="phone">Teléfono</label>
              <Input id="phone" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Tu número de contacto" className="booking-input" inputMode="tel" autoComplete="tel" />
              <div className="mini-summary"><span><Gem /></span><div><strong>{summary[0]}</strong><p>{summary.slice(1, 4).join(' · ')}{summary.length > 4 ? ` · +${summary.length - 4} más` : ''}</p></div></div>
              <button type="button" className="back-link" onClick={() => { setSelectedDesign(null); setStage('design'); document.querySelector('#calculadora')?.scrollIntoView({ behavior: 'smooth' }); }}>← {selectedDesign ? 'Prefiero personalizarlo' : 'Editar mi diseño'}</button>
            </div>
            <div className="calendar-panel" data-tour="calendar">
              <Calendar
                mode="single"
                locale={es}
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={{ before: new Date(), dayOfWeek: [0] }}
                className="booking-calendar"
                classNames={{
                  month_grid: 'w-full border-collapse',
                  day: 'relative aspect-square h-full w-full rounded-full p-0 text-center',
                  today: 'rounded-full bg-[#f8e7eb] text-[#8d4b60]',
                }}
              />
              <div className="hours-panel">
                <div className="hours-title"><Clock3 /><span><strong>{selectedDate ? 'Horarios disponibles' : 'Selecciona una fecha'}</strong><small>{selectedDate ? selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Domingos permanecemos cerradas'}</small></span></div>
                {selectedDate && <div className="time-grid">{times.map((time) => { const unavailable = occupied.includes(time); return <button key={time} type="button" disabled={unavailable || loadingSlots} className={selectedTime === time ? 'selected' : ''} onClick={() => setSelectedTime(time)}>{time}<small>{unavailable ? 'Ocupado' : 'Disponible'}</small></button>; })}</div>}
              </div>
            </div>
          </div>
          {error && <p className="booking-error" role="alert">{error}</p>}
          {confirmed && <p className="booking-success"><Check /> Cita guardada. Abriendo WhatsApp…</p>}
          <div className="booking-actions" data-tour="confirm">
            <Button variant="outline" className="clear-booking" onClick={reset}><Trash2 /> Limpiar todo</Button>
            <Button className="whatsapp-button" onClick={confirmBooking} disabled={submitting || confirmed || !authReady || catalogLoading}>{submitting ? 'Guardando cita…' : 'Guardar y confirmar por WhatsApp'} <MessageCircle /></Button>
          </div>
        </section>
      )}

      <section className="closing-section">
        <div><p className="eyebrow">{catalog.businessName}</p><h2>El lujo está<br />en los detalles.</h2></div>
        <div className="closing-note"><span>✿</span><p>Una experiencia creada para que cada elección se sienta personal, clara y especial.</p></div>
      </section>

      <footer>
        <a href="#inicio" className="brand-mark"><span>V</span><span className="brand-name">{brandName.toUpperCase()}<small>by Priscila</small></span></a>
        <p>Lunes a viernes · {catalog.schedule.weekdays.join(', ')}<br />Sábado · {catalog.schedule.saturday.join(', ')} · Domingo cerrado</p>
        <a className="footer-whatsapp" href={`https://wa.me/${catalog.whatsapp}`}><MessageCircle /> WhatsApp</a>
      </footer>

      {stage === 'design' && (
        <div className="mobile-price-bar" aria-label="Resumen de precio">
          <span><small>Tu set estimado</small><strong>{formatMoney(total)}</strong></span>
          <Button onClick={goToBooking}>Elegir fecha <ArrowRight /></Button>
        </div>
      )}

      <ChatAssistant summary={summary} total={total} />

      <button className="guide-reopen" type="button" onClick={() => setWizardStep(0)} aria-label="Abrir guía de uso">
        <HelpCircle /><span>Recorrido guiado</span>
      </button>

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
