'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Check,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Paintbrush,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shapes,
  Trash2,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { auth, db, googleProvider } from '@/lib/firebase';
import {
  DEFAULT_CATALOG,
  makeCatalogId,
  normalizeCatalog,
  type CatalogItem,
  type DecorationItem,
  type SalonCatalog,
  type ShapeItem,
  type TechniqueItem,
} from '@/lib/catalog';

const ADMIN_EMAILS = new Set([
  'brizq02@gmail.com',
  'valentinamelendezzz2010@gmail.com',
]);
type ListKey = 'techniques' | 'lengths' | 'shapes' | 'decorations';

function MoneyInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <label className="admin-money">
      <span>{label}</span>
      <span><b>$</b><Input type="number" min="0" step="1" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /></span>
    </label>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [draft, setDraft] = useState<SalonCatalog>(() => structuredClone(DEFAULT_CATALOG));
  const [savedCatalog, setSavedCatalog] = useState<SalonCatalog>(() => structuredClone(DEFAULT_CATALOG));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [decorationSearch, setDecorationSearch] = useState('');

  const userEmail = user?.email ?? '';
  const isAdmin = ADMIN_EMAILS.has(userEmail.toLowerCase());
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedCatalog);
  const activeServices = draft.techniques.filter((item) => item.active).length;
  const activeDesigns = draft.decorations.filter((item) => item.active).length;
  const filteredDecorations = draft.decorations.filter((item) => item.name.toLowerCase().includes(decorationSearch.toLowerCase()));

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setAuthReady(true);
  }), []);

  useEffect(() => onSnapshot(doc(db, 'catalog', 'main'), (snapshot) => {
    const nextCatalog = normalizeCatalog(snapshot.exists() ? snapshot.data() : DEFAULT_CATALOG);
    setDraft(nextCatalog);
    setSavedCatalog(structuredClone(nextCatalog));
    setLoading(false);
  }, () => setLoading(false)), []);

  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  }, [isDirty]);

  const login = async () => {
    setMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar la sesión administrativa.');
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const updateItem = (key: ListKey, id: string, patch: Record<string, string | number | boolean>) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((item) => item.id === id ? { ...item, ...patch } : item),
    } as SalonCatalog));
  };

  const removeItem = (key: ListKey, id: string) => {
    setDraft((current) => ({ ...current, [key]: current[key].filter((item) => item.id !== id) } as SalonCatalog));
  };

  const addTechnique = () => setDraft((current) => ({
    ...current,
    techniques: [...current.techniques, {
      id: makeCatalogId('technique'), name: 'Nueva técnica', note: 'Descripción del servicio', price: 0, usesLengths: false, active: true,
    }],
  }));

  const addLength = () => setDraft((current) => ({
    ...current,
    lengths: [...current.lengths, {
      id: makeCatalogId('length'), name: `Largo ${current.lengths.length + 1}`, price: 0, active: true,
    }],
  }));

  const addShape = () => setDraft((current) => ({
    ...current,
    shapes: [...current.shapes, {
      id: makeCatalogId('shape'), name: 'Nueva forma', className: 'nail-almond', active: true,
    }],
  }));

  const addDecoration = () => setDraft((current) => ({
    ...current,
    decorations: [...current.decorations, {
      id: makeCatalogId('decoration'), name: 'Nueva decoración', icon: '✦', price: 0, active: true,
    }],
  }));

  const save = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setMessage('');
    try {
      await setDoc(doc(db, 'catalog', 'main'), {
        ...draft,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      setSavedCatalog(structuredClone(draft));
      setMessage('Cambios publicados. La página de reservas ya está actualizada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  if (!authReady || loading) {
    return <main className="admin-loading"><span className="brand-mark"><span>V</span></span><p>Preparando el panel…</p></main>;
  }

  if (!isAdmin) {
    return (
      <main className="admin-login">
        <div className="admin-login-card">
          <span className="admin-login-icon"><Settings2 /></span>
          <p className="eyebrow">Valentina Nails / Priscila</p>
          <h1>Panel administrativo</h1>
          <p>Este espacio es privado. El inicio con Google aparece solamente aquí; las clientas reservan sin crear una cuenta.</p>
          {user && !user.isAnonymous && <p className="admin-warning">La cuenta {user.email} no tiene acceso administrativo.</p>}
          <Button className="gold-button" onClick={login}><LogIn /> Entrar como administradora</Button>
          <button type="button" className="back-link" onClick={() => { window.location.hash = ''; }}>← Volver a reservas</button>
          {message && <p className="admin-message">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <button type="button" className="admin-back" onClick={() => { window.location.hash = ''; }}><ArrowLeft /> Reservas</button>
          <p className="eyebrow">Valentina Nails / Priscila</p>
          <h1>Catálogo y precios</h1>
          <p>Controla servicios, precios y horarios desde un solo lugar.</p>
        </div>
        <div className="admin-actions">
          <span>{userEmail}</span>
          <button type="button" onClick={logout}><LogOut /> Salir</button>
          <Button className="gold-button" onClick={save} disabled={saving || !isDirty}><Save /> {saving ? 'Publicando…' : isDirty ? 'Publicar cambios' : 'Todo guardado'}</Button>
        </div>
      </header>

      {message && <div className={`admin-toast ${message.startsWith('Cambios') ? 'success' : ''}`}><Check /> {message}</div>}

      <section className="admin-overview" aria-label="Resumen del catálogo">
        <div><span><Boxes /></span><p>Servicios activos<strong>{activeServices}</strong></p></div>
        <div><span><Paintbrush /></span><p>Diseños visibles<strong>{activeDesigns}</strong></p></div>
        <div><span><Shapes /></span><p>Formas disponibles<strong>{draft.shapes.filter((item) => item.active).length}</strong></p></div>
        <div><span><BadgeDollarSign /></span><p>Estado del panel<strong className={isDirty ? 'pending' : 'saved'}>{isDirty ? 'Sin publicar' : 'Actualizado'}</strong></p></div>
      </section>

      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <p>Configuración</p>
          <nav aria-label="Secciones del panel">
            <a href="#admin-business"><span>01</span> Negocio y agenda</a>
            <a href="#admin-techniques"><span>02</span> Técnicas</a>
            <a href="#admin-lengths"><span>03</span> Largos</a>
            <a href="#admin-shapes"><span>04</span> Formas</a>
            <a href="#admin-decorations"><span>05</span> Decoraciones</a>
            <a href="#admin-extras"><span>06</span> Extras</a>
          </nav>
          <div className="admin-sidebar-note"><Check /><p><strong>Cambios en vivo</strong>Al publicar, las clientas ven los nuevos precios sin recargar.</p></div>
        </aside>

        <div className="admin-content">

      <section id="admin-business" className="admin-card admin-business">
        <div className="admin-section-title"><div><span>01</span><div><h2>Negocio y agenda</h2><p>Datos generales que usan la reserva y WhatsApp.</p></div></div></div>
        <div className="admin-fields-grid">
          <label htmlFor="business-name"><span>Nombre del negocio</span><Input id="business-name" value={draft.businessName} onChange={(event) => setDraft((current) => ({ ...current, businessName: event.target.value }))} /></label>
          <label htmlFor="business-whatsapp"><span>WhatsApp con código de país</span><Input id="business-whatsapp" inputMode="numeric" value={draft.whatsapp} onChange={(event) => setDraft((current) => ({ ...current, whatsapp: event.target.value.replace(/\D/g, '') }))} /></label>
          <label htmlFor="weekday-hours"><span>Horarios lunes a viernes</span><Input id="weekday-hours" value={draft.schedule.weekdays.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, weekdays: event.target.value.split(',').map((time) => time.trim()).filter(Boolean) } }))} /></label>
          <label htmlFor="saturday-hours"><span>Horarios sábado</span><Input id="saturday-hours" value={draft.schedule.saturday.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, saturday: event.target.value.split(',').map((time) => time.trim()).filter(Boolean) } }))} /></label>
        </div>
      </section>

      <AdminListSection<TechniqueItem>
        id="admin-techniques"
        number="02" title="Técnicas" description="Servicios base. Activa “usa largos” cuando el precio dependa del largo."
        items={draft.techniques} onAdd={addTechnique} addLabel="Agregar técnica"
        render={(item) => <>
          <Input value={item.name} aria-label="Nombre" onChange={(event) => updateItem('techniques', item.id, { name: event.target.value })} />
          <Input value={item.note} aria-label="Descripción" onChange={(event) => updateItem('techniques', item.id, { note: event.target.value })} />
          <MoneyInput label="Precio base" value={item.price} onChange={(price) => updateItem('techniques', item.id, { price })} />
          <label className="admin-check"><input type="checkbox" checked={item.usesLengths} onChange={(event) => updateItem('techniques', item.id, { usesLengths: event.target.checked })} /> Usa largos</label>
        </>}
        onToggle={(item) => updateItem('techniques', item.id, { active: !item.active })}
        onDelete={(item) => removeItem('techniques', item.id)}
      />

      <AdminListSection<CatalogItem>
        id="admin-lengths"
        number="03" title="Largos" description="Precios para las técnicas que dependen del largo."
        items={draft.lengths} onAdd={addLength} addLabel="Agregar largo"
        render={(item) => <><Input value={item.name} aria-label="Nombre" onChange={(event) => updateItem('lengths', item.id, { name: event.target.value })} /><MoneyInput label="Precio" value={item.price} onChange={(price) => updateItem('lengths', item.id, { price })} /></>}
        onToggle={(item) => updateItem('lengths', item.id, { active: !item.active })}
        onDelete={(item) => removeItem('lengths', item.id)}
      />

      <AdminListSection<ShapeItem>
        id="admin-shapes"
        number="04" title="Formas" description="Opciones de forma visibles en el configurador."
        items={draft.shapes} onAdd={addShape} addLabel="Agregar forma"
        render={(item) => <><span className={`admin-nail nail-shape ${item.className}`} /><Input value={item.name} aria-label="Nombre" onChange={(event) => updateItem('shapes', item.id, { name: event.target.value })} /></>}
        onToggle={(item) => updateItem('shapes', item.id, { active: !item.active })}
        onDelete={(item) => removeItem('shapes', item.id)}
      />

      <AdminListSection<DecorationItem>
        id="admin-decorations"
        number="05" title="Decoraciones" description="Diseños cobrados por uña. Puedes agregar todos los que necesites."
        items={filteredDecorations} onAdd={addDecoration} addLabel="Agregar decoración"
        toolbar={<label className="admin-search"><Search /><input value={decorationSearch} onChange={(event) => setDecorationSearch(event.target.value)} placeholder="Buscar decoración…" aria-label="Buscar decoración" /></label>}
        render={(item) => <><Input className="admin-icon-input" value={item.icon} aria-label="Ícono" maxLength={3} onChange={(event) => updateItem('decorations', item.id, { icon: event.target.value })} /><Input value={item.name} aria-label="Nombre" onChange={(event) => updateItem('decorations', item.id, { name: event.target.value })} /><MoneyInput label="Por uña" value={item.price} onChange={(price) => updateItem('decorations', item.id, { price })} /></>}
        onToggle={(item) => updateItem('decorations', item.id, { active: !item.active })}
        onDelete={(item) => removeItem('decorations', item.id)}
      />

      <section id="admin-extras" className="admin-card">
        <div className="admin-section-title"><div><span>06</span><div><h2>Extras</h2><p>Ajusta todos los cargos adicionales.</p></div></div></div>
        <div className="admin-price-grid">
          {([
            ['extraTone', 'Tono extra'], ['changeShape', 'Cambio de forma'], ['removalAcrylic', 'Retiro acrílico'],
            ['removalGel', 'Retiro gel'], ['repairAcrylic', 'Reposición acrílico'], ['repairGel', 'Reposición gel'],
          ] as const).map(([key, label]) => <MoneyInput key={key} label={label} value={draft.extras[key]} onChange={(value) => setDraft((current) => ({ ...current, extras: { ...current.extras, [key]: value } }))} />)}
        </div>
      </section>
        </div>
      </div>

      <div className={`admin-sticky-save ${isDirty ? 'visible' : ''}`}><p><span /> Tienes cambios sin publicar</p><button type="button" onClick={() => { setDraft(structuredClone(savedCatalog)); setMessage(''); }}><RotateCcw /> Descartar</button><Button className="gold-button" onClick={save} disabled={saving}><Save /> {saving ? 'Publicando…' : 'Publicar cambios'}</Button></div>
    </main>
  );
}

function AdminListSection<T extends { id: string; active: boolean }>({
  id, number, title, description, items, onAdd, addLabel, render, onToggle, onDelete, toolbar,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  items: T[];
  onAdd: () => void;
  addLabel: string;
  render: (item: T) => React.ReactNode;
  onToggle: (item: T) => void;
  onDelete: (item: T) => void;
  toolbar?: React.ReactNode;
}) {
  return (
    <section id={id} className="admin-card">
      <div className="admin-section-title">
        <div><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>
        <Button variant="outline" onClick={onAdd}><Plus /> {addLabel}</Button>
      </div>
      {toolbar}
      <div className="admin-list">
        {items.map((item) => (
          <div className={`admin-row ${item.active ? '' : 'inactive'}`} key={item.id}>
            <div className="admin-row-fields">{render(item)}</div>
            <div className="admin-row-actions">
              <button type="button" title={item.active ? 'Ocultar' : 'Mostrar'} onClick={() => onToggle(item)}>{item.active ? <Eye /> : <EyeOff />}</button>
              <button type="button" title="Eliminar" className="danger" onClick={() => onDelete(item)}><Trash2 /></button>
            </div>
          </div>
        ))}
        {!items.length && <div className="admin-empty">No hay resultados para esta búsqueda.</div>}
      </div>
    </section>
  );
}
