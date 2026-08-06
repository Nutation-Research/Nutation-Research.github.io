/**
 * The segmentation-cutout sibling asset (producer/producer/cutouts.py): a manifest of matted
 * skater PNGs, sampled K-per-element, for the **photoreal** motion-trail echoes. Heavy pixels
 * ride next to the artifact like the `.mp4` does (not in the parquet); this loads the small
 * JSON index. Absent → the trail falls back to the skeleton echoes (every element still works).
 */

export interface CutoutCard {
  frame: number; // source frame this matte was sampled from
  t: number; // strobe time 0…1 (matches strobePoses / stripAnchor)
  bbox: { x: number; y: number; w: number; h: number }; // matte crop in source px
  hip: { x: number; y: number }; // hip-midpoint anchor in source px
  file: string; // path relative to `<base>.cutouts/`
}

export interface CutoutManifest {
  version: string;
  k: number;
  frame_width: number;
  frame_height: number;
  elements: Record<string, CutoutCard[]>; // keyed by element entity_id (string)
  /** Clean (skater-removed) background plate per element, path relative to `<base>.cutouts/`. */
  plates?: Record<string, string>;
}

/** Fetch `<base>.cutouts.json` (optional, like the event artifacts). Null on any miss so the
 *  renderer cleanly falls back to skeleton echoes. */
export async function loadCutouts(base: string): Promise<CutoutManifest | null> {
  try {
    const res = await fetch(`${base}.cutouts.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const ctype = res.headers?.get('content-type') ?? '';
    if (ctype && !ctype.includes('json')) return null; // dev-server SPA fallback served HTML
    return (await res.json()) as CutoutManifest;
  } catch {
    return null;
  }
}

/** The URL of a card's PNG, given the artifact base (`/runs/<id>/<id>`). */
export function cutoutUrl(base: string, card: CutoutCard): string {
  return `${base}.cutouts/${card.file}`;
}

/** The URL of a relative cutout asset (e.g. a clean background plate `el-0/bg.png`). */
export function cutoutAssetUrl(base: string, file: string): string {
  return `${base}.cutouts/${file}`;
}
