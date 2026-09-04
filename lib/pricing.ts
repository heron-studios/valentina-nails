import type { CatalogItem, TechniqueItem, DecorationItem, SalonCatalog } from './catalog.ts';
import { formatMoneyPEN } from './format-utils.ts';

export interface CalculateSetPriceParams {
  technique: TechniqueItem;
  length?: CatalogItem;
  decorations?: Record<string, number>;
  decorationOptions?: DecorationItem[];
  extraTones?: number;
  changeShape?: boolean;
  removal?: { acrylic: number; gel: number };
  repairs?: { acrylic: number; gel: number };
  extras?: SalonCatalog['extras'];
}

export function calculateSetPrice(params: CalculateSetPriceParams): number {
  const {
    technique,
    length,
    decorations = {},
    decorationOptions = [],
    extraTones = 0,
    changeShape = false,
    removal = { acrylic: 0, gel: 0 },
    repairs = { acrylic: 0, gel: 0 },
    extras = {
      extraTone: 5,
      changeShape: 20,
      removalAcrylic: 10,
      removalGel: 5,
      repairAcrylic: 30,
      repairGel: 20,
    },
  } = params;

  const lengthPrice = technique.usesLengths && length ? length.price : 0;
  const basePrice = technique.price + lengthPrice;

  const decorationTotal = decorationOptions.reduce(
    (sum, item) => sum + (decorations[item.id] || 0) * item.price,
    0,
  );

  const extrasTotal =
    extraTones * extras.extraTone +
    (changeShape ? extras.changeShape : 0) +
    removal.acrylic * extras.removalAcrylic +
    removal.gel * extras.removalGel +
    repairs.acrylic * extras.repairAcrylic +
    repairs.gel * extras.repairGel;

  return basePrice + decorationTotal + extrasTotal;
}

export function getTechniqueStartingPrice(technique: TechniqueItem, lengths: CatalogItem[]): number {
  if (technique.usesLengths && lengths.length > 0) {
    const minLengthPrice = Math.min(...lengths.map((l) => l.price));
    return technique.price + minLengthPrice;
  }
  return technique.price;
}

export function getNailLengthClass(lengthId: string, lengths: CatalogItem[]): string {
  const index = lengths.findIndex((item) => item.id === lengthId);
  if (index >= 0) {
    const classNum = Math.min(8, Math.max(1, index + 1));
    return `len-${classNum}`;
  }
  const match = lengthId.match(/length-(\d+)/);
  if (match && match[1]) {
    const num = Number(match[1]);
    if (num >= 1 && num <= 8) return `len-${num}`;
  }
  return 'len-3';
}

export function formatLengthSupplement(price: number): string {
  if (price <= 0) return 'Incluido';
  return `+${formatMoneyPEN(price)}`;
}
