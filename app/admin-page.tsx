'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
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
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { auth, db, googleProvider } from '@/lib/firebase';
import { imageFileToDataUrl, type DesignExample } from '@/lib/designs';
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
  const [designs, setDesigns] = useState<DesignExample[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [newDesign, setNewDesign] = useState({ title: '', description: '', price: 0, imageData: '' });

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

  useEffect(() => onSnapshot(collection(db, 'designs'), (snapshot) => {
    setDesigns(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as DesignExample)));
  }, () => setMessage('No pudimos cargar la galería de diseños.')), []);

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

  const addDesign = async () => {
    if (!newDesign.title.trim() || !newDesign.imageData || newDesign.price <= 0) {
      setMessage('Agrega una foto, un nombre y un precio para publicar el diseño.');
      return;
    }
    setGalleryBusy(true);
    setMessage('');
    try {
      await addDoc(collection(db, 'designs'), {
        ...newDesign,
        title: newDesign.title.trim(),
        description: newDesign.description.trim(),
        active: true,
        createdAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      setNewDesign({ title: '', description: '', price: 0, imageData: '' });
      setMessage('Diseño agregado a la galería de clientas.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos agregar el diseño.');
    } finally {
      setGalleryBusy(false);
    }
  };

  const patchDesign = (id: string, patch: Partial<DesignExample>) => {
    setDesigns((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const saveDesign = async (design: DesignExample) => {
    setGalleryBusy(true);
    try {
      await updateDoc(doc(db, 'designs', design.id), {
        title: design.title.trim(), description: design.description.trim(), price: design.price,
        imageData: design.imageData, active: design.active, updatedAt: serverTimestamp(), updatedBy: userEmail,
      });
      setMessage('Diseño actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos actualizar el diseño.');
    } finally {
      setGalleryBusy(false);
    }
  };

  const removeDesign = async (design: DesignExample) => {
    if (!window.confirm(`¿Eliminar “${design.title}” de la galería?`)) return;
    setGalleryBusy(true);
    try {
      await deleteDoc(doc(db, 'designs', design.id));
      setMessage('Diseño eliminado de la galería.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos eliminar el diseño.');
    } finally {
      setGalleryBusy(false);
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

      <Tabs defaultValue="general" className="admin-tabs">
        <TabsList className="admin-tabs-list" aria-label="Áreas del panel">
          <TabsTrigger value="general"><Settings2 /> Información</TabsTrigger>
          <TabsTrigger value="services"><Boxes /> Servicios</TabsTrigger>
          <TabsTrigger value="prices"><BadgeDollarSign /> Precios y extras</TabsTrigger>
          <TabsTrigger value="gallery"><ImagePlus /> Galería</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
      <section id="admin-business" className="admin-card admin-business">
        <div className="admin-section-title"><div><span>01</span><div><h2>Información y agenda</h2><p>Configura el nombre, WhatsApp y los horarios disponibles.</p></div></div></div>
        <div className="admin-fields-grid">
          <label htmlFor="business-name"><span>Nombre del negocio</span><Input id="business-name" value={draft.businessName} onChange={(event) => setDraft((current) => ({ ...current, businessName: event.target.value }))} /></label>
          <label htmlFor="business-whatsapp"><span>WhatsApp con código de país</span><Input id="business-whatsapp" inputMode="numeric" value={draft.whatsapp} onChange={(event) => setDraft((current) => ({ ...current, whatsapp: event.target.value.replace(/\D/g, '') }))} /></label>
          <label htmlFor="weekday-hours"><span>Horarios lunes a viernes</span><Input id="weekday-hours" value={draft.schedule.weekdays.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, weekdays: event.target.value.split(',').map((time) => time.trim()).filter(Boolean) } }))} /></label>
          <label htmlFor="saturday-hours"><span>Horarios sábado</span><Input id="saturday-hours" value={draft.schedule.saturday.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, schedule: { ...current.schedule, saturday: event.target.value.split(',').map((time) => time.trim()).filter(Boolean) } }))} /></label>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="services">
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
        </TabsContent>

        <TabsContent value="prices">
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
        </TabsContent>

        <TabsContent value="gallery">
          <DesignGalleryAdmin
            designs={designs}
            draft={newDesign}
            busy={galleryBusy}
            onDraft={setNewDesign}
            onAdd={addDesign}
            onPatch={patchDesign}
            onSave={saveDesign}
            onDelete={removeDesign}
            onMessage={setMessage}
          />
        </TabsContent>
      </Tabs>

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

function DesignGalleryAdmin({
  designs, draft, busy, onDraft, onAdd, onPatch, onSave, onDelete, onMessage,
}: {
  designs: DesignExample[];
  draft: Omit<DesignExample, 'id' | 'active'>;
  busy: boolean;
  onDraft: React.Dispatch<React.SetStateAction<Omit<DesignExample, 'id' | 'active'>>>;
  onAdd: () => void;
  onPatch: (id: string, patch: Partial<DesignExample>) => void;
  onSave: (design: DesignExample) => void;
  onDelete: (design: DesignExample) => void;
  onMessage: (message: string) => void;
}) {
  const readImage = async (file: File | undefined, apply: (imageData: string) => void) => {
    if (!file) return;
    try {
      apply(await imageFileToDataUrl(file));
      onMessage('Foto preparada. Completa los datos y guarda el diseño.');
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'No pudimos procesar la imagen.');
    }
  };

  return (
    <section className="admin-card gallery-manager">
      <div className="admin-section-title">
        <div><span>04</span><div><h2>Galería “elige y replica”</h2><p>Sube trabajos terminados para que las clientas puedan reservar ese diseño directamente.</p></div></div>
      </div>

      <div className="gallery-create">
        <label className={`gallery-dropzone ${draft.imageData ? 'has-image' : ''}`}>
          {draft.imageData ? <img src={draft.imageData} alt="Vista previa del nuevo diseño" /> : <><ImagePlus /><strong>Seleccionar foto</strong><span>JPG, PNG o WEBP · máximo 12 MB</span></>}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => readImage(event.target.files?.[0], (imageData) => onDraft((current) => ({ ...current, imageData })))} />
        </label>
        <div className="gallery-create-fields">
          <label htmlFor="new-design-title"><span>Nombre del diseño</span><Input id="new-design-title" value={draft.title} onChange={(event) => onDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. French rosa con cristales" /></label>
          <label htmlFor="new-design-description"><span>Descripción breve</span><Textarea id="new-design-description" value={draft.description} onChange={(event) => onDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Técnica, largo y detalles incluidos…" /></label>
          <MoneyInput label="Precio completo" value={draft.price} onChange={(price) => onDraft((current) => ({ ...current, price }))} />
          <Button className="gold-button" onClick={onAdd} disabled={busy}><Plus /> {busy ? 'Guardando…' : 'Publicar en galería'}</Button>
        </div>
      </div>

      <div className="gallery-admin-list">
        <div className="gallery-list-heading"><h3>Diseños publicados</h3><span>{designs.length} en total</span></div>
        {!designs.length && <div className="admin-empty">Todavía no hay fotografías. Agrega la primera arriba.</div>}
        {designs.map((design) => (
          <article className={`gallery-admin-card ${design.active ? '' : 'inactive'}`} key={design.id}>
            <label className="gallery-admin-photo">
              <img src={design.imageData} alt={design.title} />
              <span><ImagePlus /> Cambiar</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => readImage(event.target.files?.[0], (imageData) => onPatch(design.id, { imageData }))} />
            </label>
            <div className="gallery-admin-fields">
              <Input value={design.title} aria-label="Nombre del diseño" onChange={(event) => onPatch(design.id, { title: event.target.value })} />
              <Textarea value={design.description} aria-label="Descripción del diseño" onChange={(event) => onPatch(design.id, { description: event.target.value })} />
              <MoneyInput label="Precio completo" value={design.price} onChange={(price) => onPatch(design.id, { price })} />
            </div>
            <div className="gallery-admin-actions">
              <button type="button" onClick={() => onPatch(design.id, { active: !design.active })}>{design.active ? <><Eye /> Visible</> : <><EyeOff /> Oculto</>}</button>
              <Button variant="outline" onClick={() => onSave(design)} disabled={busy}><Save /> Guardar</Button>
              <button type="button" className="danger" onClick={() => onDelete(design)} disabled={busy}><Trash2 /> Eliminar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
