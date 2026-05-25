// Pure helpers for the comparison picker (safe on client; type-only db import).
import type { ShotImage, ImageRole } from './db';

export type CompareImage = { id: string; url: string; label: string; role: ImageRole; selected: boolean };

function label(img: ShotImage, importedIdx?: number): string {
  switch (img.role) {
    case 'base':
      return 'Base';
    case 'mannequin':
      return 'Mannequin';
    case 'model_source':
      return `Source ${img.slot}`;
    case 'imported':
      return `Imported ${importedIdx ?? ''}`.trim();
    default:
      return `Gen ${img.slot ?? ''}#${img.variation_index ?? ''}`;
  }
}

// Order images for the comparison picker: base, mannequin, sources, generated, imported.
export function orderForCompare(images: ShotImage[]): CompareImage[] {
  const order: Record<string, number> = { base: 0, mannequin: 1, model_source: 2, generated: 3, imported: 4 };
  let imported = 0;
  return [...images]
    .sort((a, b) => order[a.role] - order[b.role] || (a.variation_index ?? 0) - (b.variation_index ?? 0))
    .map((img) => ({
      id: img.id,
      url: img.url,
      label: label(img, img.role === 'imported' ? ++imported : undefined),
      role: img.role,
      selected: img.selected,
    }));
}
