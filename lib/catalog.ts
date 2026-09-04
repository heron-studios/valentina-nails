export type CatalogItem = {
  id: string;
  name: string;
  price: number;
  active: boolean;
};

export type TechniqueItem = CatalogItem & {
  note: string;
  usesLengths: boolean;
};

export type ShapeItem = Omit<CatalogItem, 'price'> & {
  className: string;
};

export type DecorationItem = CatalogItem & {
  icon: string;
};

export type SalonCatalog = {
  businessName: string;
  whatsapp: string;
  techniques: TechniqueItem[];
  lengths: CatalogItem[];
  shapes: ShapeItem[];
  decorations: DecorationItem[];
  extras: {
    extraTone: number;
    changeShape: number;
    removalAcrylic: number;
    removalGel: number;
    repairAcrylic: number;
    repairGel: number;
  };
  schedule: {
    weekdays: string[];
    saturday: string[];
  };
};

export const DEFAULT_CATALOG: SalonCatalog = {
  businessName: 'Valentina Nails by Priscila',
  whatsapp: '528446638497',
  techniques: [
    { id: 'acrylic', name: 'Acrílico', note: 'Estructura y largo a tu medida', price: 280, usesLengths: true, active: true },
    { id: 'gel', name: 'Gel semipermanente', note: 'Color impecable y duradero', price: 150, usesLengths: false, active: true },
    { id: 'rubber', name: 'Rubber gel', note: 'Refuerzo flexible y natural', price: 200, usesLengths: false, active: true },
  ],
  lengths: Array.from({ length: 8 }, (_, index) => ({
    id: `length-${index + 1}`,
    name: `Largo ${index + 1}`,
    price: 280 + index * 20,
    active: true,
  })),
  shapes: [
    { id: 'square', name: 'Cuadrada', className: 'nail-square', active: true },
    { id: 'almond', name: 'Almendra', className: 'nail-almond', active: true },
    { id: 'coffin', name: 'Coffin', className: 'nail-coffin', active: true },
    { id: 'stiletto', name: 'Stiletto', className: 'nail-stiletto', active: true },
  ],
  decorations: [
    { id: 'mirror', name: 'Espejo', icon: '✦', price: 3, active: true },
    { id: 'aurora', name: 'Aurora', icon: '◒', price: 3, active: true },
    { id: 'sugar', name: 'Azúcar', icon: '❈', price: 3, active: true },
    { id: 'sweater', name: 'Suéter', icon: '⌇', price: 3, active: true },
    { id: 'pearl', name: 'Perla', icon: '○', price: 3, active: true },
    { id: 'glitter', name: 'Glitter', icon: '✧', price: 3, active: true },
    { id: 'tortoise', name: 'Carey', icon: '◌', price: 3, active: true },
    { id: 'blooming', name: 'Blooming', icon: '✿', price: 3, active: true },
    { id: 'cat-eye', name: 'Ojo de gato', icon: '◉', price: 5, active: true },
    { id: 'relief', name: 'Relieve', icon: '≋', price: 5, active: true },
    { id: '3d', name: 'Diseño 3D', icon: '◇', price: 10, active: true },
    { id: 'french', name: 'Francés', icon: '⌒', price: 3, active: true },
    { id: 'simple-art', name: 'Nail art simple', icon: '◐', price: 3, active: true },
    { id: 'encapsulated', name: 'Encapsulado', icon: '◍', price: 5, active: true },
    { id: 'nature', name: 'Naturaleza muerta', icon: '❉', price: 5, active: true },
    { id: 'charms', name: 'Dijes', icon: '♢', price: 10, active: true },
    { id: 'sticker', name: 'Sticker', icon: '♥', price: 5, active: true },
    { id: 'gold-leaf', name: 'Hoja de oro', icon: '◈', price: 5, active: true },
    { id: 'boomer', name: 'Baby boomer', icon: '◫', price: 5, active: true },
    { id: 'crystal-s', name: 'Cristales CH', icon: '◆', price: 10, active: true },
    { id: 'crystal-m', name: 'Cristales M', icon: '◆', price: 15, active: true },
    { id: 'crystal-l', name: 'Cristales G', icon: '◆', price: 20, active: true },
    { id: 'full-s', name: 'Uña cristal CH', icon: '♛', price: 30, active: true },
    { id: 'full-m', name: 'Uña cristal M', icon: '♛', price: 45, active: true },
    { id: 'full-l', name: 'Uña cristal G', icon: '♛', price: 55, active: true },
  ],
  extras: {
    extraTone: 5,
    changeShape: 20,
    removalAcrylic: 10,
    removalGel: 5,
    repairAcrylic: 30,
    repairGel: 20,
  },
  schedule: {
    weekdays: ['09:00', '13:00', '16:00', '20:00'],
    saturday: ['09:00', '13:00'],
  },
};

export function normalizeCatalog(value: unknown): SalonCatalog {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_CATALOG);
  const data = value as Partial<SalonCatalog>;

  const rawTechniques = Array.isArray(data.techniques) ? data.techniques : structuredClone(DEFAULT_CATALOG.techniques);
  const rawLengths = Array.isArray(data.lengths) ? data.lengths : structuredClone(DEFAULT_CATALOG.lengths);

  // Auto-healing: si existen largos activos configurados pero ninguna técnica tiene usesLengths activo,
  // habilitar usesLengths en las técnicas de estructura/extensión para no romper la visualización a las clientas.
  const hasAnyUsesLengths = rawTechniques.some((t) => t.usesLengths);
  const hasActiveLengths = rawLengths.some((l) => l.active !== false);

  const techniques = rawTechniques.map((tech) => {
    if (!hasAnyUsesLengths && hasActiveLengths) {
      const lower = tech.name.toLowerCase();
      const isExtension = ['acrílico', 'acrylic', 'polygel', 'softgel', 'esculpida', 'dual system', 'builder gel'].some((key) =>
        lower.includes(key),
      );
      if (isExtension) {
        return { ...tech, usesLengths: true };
      }
    }
    return {
      ...tech,
      usesLengths: Boolean(tech.usesLengths),
    };
  });

  return {
    ...structuredClone(DEFAULT_CATALOG),
    ...data,
    techniques,
    lengths: rawLengths,
    shapes: Array.isArray(data.shapes) ? data.shapes : structuredClone(DEFAULT_CATALOG.shapes),
    decorations: Array.isArray(data.decorations) ? data.decorations : structuredClone(DEFAULT_CATALOG.decorations),
    extras: { ...DEFAULT_CATALOG.extras, ...data.extras },
    schedule: { ...DEFAULT_CATALOG.schedule, ...data.schedule },
  };
}

export const makeCatalogId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
