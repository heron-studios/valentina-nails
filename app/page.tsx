'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

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

  const total = useMemo(() => {
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

  const selectedDecorations = decorationOptions.filter((item) => (decorations[item.id] || 0) > 0);
  const summary = [
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

  useEffect(() => {
    try {
      if (!window.localStorage.getItem('valentina-client-guide-v1')) setWizardStep(0);
    } catch {
      setWizardStep(0);
    }
  }, []);

  useEffect(() => {
    if (wizardStep === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWizardStep(null);
    };
    document.body.classList.add('wizard-open');
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.classList.remove('wizard-open');
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
    setError('');
    setStage('design');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToBooking = () => {
    setStage('booking');
    setTimeout(() => document.querySelector('#booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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

      <section id="calculadora" className="builder-section">
        <div className="section-heading">
          <p className="eyebrow">Tu set, a tu manera</p>
          <h2>Diseña y cotiza</h2>
          <p>Combina técnica, forma y decoraciones. El precio se actualiza en cada elección.</p>
        </div>

        <div className="builder-layout">
          <div className="builder-main">
            <div className="step-card">
              <div className="step-title"><span>01</span><div><h3>Elige tu técnica</h3><p>La base perfecta para tu estilo.</p></div></div>
              <div className="technique-grid">
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
              <div className="shape-grid">
                {shapes.map((item) => (
                  <button key={item.id} type="button" className={shape === item.id ? 'selected' : ''} onClick={() => setShape(item.id)} aria-pressed={shape === item.id}>
                    <span className={`nail-shape ${item.className}`} /><strong>{item.name}</strong>{shape === item.id && <Check />}
                  </button>
                ))}
              </div>
            </div>

            <div className="step-card">
              <div className="step-title"><span>{techniqueInfo.usesLengths ? '04' : '03'}</span><div><h3>Agrega decoraciones</h3><p>Selecciona cuántas uñas llevarán cada diseño.</p></div></div>
              <div className="decoration-grid">
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

          <aside className="summary-card">
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
          <div className="booking-header"><div><p className="eyebrow">Tu momento</p><h2>Agenda tu cita</h2><p>Elige una fecha disponible y el horario que mejor te quede.</p></div><div className="booking-total"><span>Tu set</span><strong>{formatMoney(total)}</strong></div></div>
          <div className="booking-grid">
            <div className="booking-form">
              <label htmlFor="name">Nombre de la clienta</label>
              <Input id="name" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Tu nombre completo" className="booking-input" autoComplete="name" />
              <label htmlFor="phone">Teléfono</label>
              <Input id="phone" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} placeholder="Tu número de contacto" className="booking-input" inputMode="tel" autoComplete="tel" />
              <div className="mini-summary"><span><Gem /></span><div><strong>{summary[0]}</strong><p>{summary.slice(1, 4).join(' · ')}{summary.length > 4 ? ` · +${summary.length - 4} más` : ''}</p></div></div>
              <button type="button" className="back-link" onClick={() => { setStage('design'); document.querySelector('#calculadora')?.scrollIntoView({ behavior: 'smooth' }); }}>← Editar mi diseño</button>
            </div>
            <div className="calendar-panel">
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
          <div className="booking-actions">
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

      <button className="guide-reopen" type="button" onClick={() => setWizardStep(0)} aria-label="Abrir guía de uso">
        <HelpCircle /><span>¿Cómo funciona?</span>
      </button>

      {wizardStep !== null && (
        <div className="wizard-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWizard(); }}>
          <dialog className="client-wizard" open aria-labelledby="wizard-title">
            <button className="wizard-close" type="button" onClick={() => closeWizard()} aria-label="Cerrar guía"><X /></button>
            <div className="wizard-progress" aria-label={`Paso ${wizardStep + 1} de 4`}>
              {[0, 1, 2, 3].map((step) => <span key={step} className={step <= wizardStep ? 'active' : ''} />)}
            </div>
            <div className="wizard-visual" aria-hidden="true">
              {wizardStep === 0 && <Sparkles />}
              {wizardStep === 1 && <Gem />}
              {wizardStep === 2 && <Paintbrush />}
              {wizardStep === 3 && <CalendarDays />}
              <span>{String(wizardStep + 1).padStart(2, '0')}</span>
            </div>
            <p className="eyebrow">Guía rápida · {wizardStep + 1} de 4</p>
            <h2 id="wizard-title">{[
              'Crea tu cita en minutos',
              'Elige la base de tu set',
              'Hazlo completamente tuyo',
              'Reserva tu horario',
            ][wizardStep]}</h2>
            <p className="wizard-copy">{[
              'Te acompañamos paso a paso. Verás el precio estimado mientras diseñas y no necesitas crear una cuenta.',
              'Selecciona la técnica, el largo y la forma que prefieras. Puedes cambiar cualquier elección antes de reservar.',
              'Suma decoraciones por uña, tonos y servicios extra. Usa los botones + y − para indicar cantidades.',
              'Revisa tu total, elige una fecha y una hora disponible. Al confirmar, abriremos WhatsApp con todos los detalles listos.',
            ][wizardStep]}</p>
            <div className="wizard-tip"><Check /> <span>{[
              'Tus elecciones no se cobran en esta página.',
              'El precio cambia al instante con cada opción.',
              'Puedes limpiar todo y empezar de nuevo.',
              'Los horarios ocupados aparecen desactivados.',
            ][wizardStep]}</span></div>
            <div className="wizard-actions">
              {wizardStep > 0 ? <button type="button" onClick={() => setWizardStep((step) => Math.max(0, (step ?? 0) - 1))}>Atrás</button> : <button type="button" onClick={() => closeWizard()}>Omitir guía</button>}
              <Button onClick={() => wizardStep === 3 ? closeWizard(true) : setWizardStep((step) => Math.min(3, (step ?? 0) + 1))}>
                {wizardStep === 3 ? 'Empezar mi diseño' : 'Siguiente'} <ArrowRight />
              </Button>
            </div>
          </dialog>
        </div>
      )}
    </main>
  );
}
