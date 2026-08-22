/** Bake constants from scripts/bake_story.sh — complete stills only (18.png is truncated). */
export const WATERCOLOR_STILLS = 18;
export const WATERCOLOR_HOLD = 0.62;
export const WATERCOLOR_FADE = 0.28;
export const WATERCOLOR_STEP = WATERCOLOR_HOLD - WATERCOLOR_FADE;
export const WATERCOLOR_FPS = 24;

/** Baked picture box after side-cropping 01–03 to the 04–15 frame. */
export const WATERCOLOR_BAKE = { w: 1464, h: 1074 } as const;

/** Original PNG sizes, before the 01–03 side crop. */
export const WATERCOLOR_SOURCE: ReadonlyArray<{ w: number; h: number }> = [
  { w: 1540, h: 1021 },
  { w: 1540, h: 1021 },
  { w: 1539, h: 1022 },
  { w: 1464, h: 1074 },
  { w: 1465, h: 1073 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
  { w: 1464, h: 1074 },
];

export function clampStill(index: number): number {
  return Math.min(WATERCOLOR_STILLS, Math.max(1, Math.round(index)));
}

/** Dominant still (1-based) and optional crossfade partner. */
export function watercolorStillAt(t: number): { index: number; next: number | null; mix: number } {
  if (t <= 0) return { index: 1, next: null, mix: 0 };
  for (let k = 1; k < WATERCOLOR_STILLS; k++) {
    const start = k * WATERCOLOR_STEP;
    if (t < start) return { index: k, next: null, mix: 0 };
    if (t < start + WATERCOLOR_FADE) {
      return { index: k, next: k + 1, mix: (t - start) / WATERCOLOR_FADE };
    }
  }
  return { index: WATERCOLOR_STILLS, next: null, mix: 0 };
}

/** Park just after the incoming fade so the still is fully on. */
export function watercolorStillTime(index: number): number {
  const i = clampStill(index);
  if (i <= 1) return 0.08;
  return (i - 1) * WATERCOLOR_STEP + WATERCOLOR_FADE + 0.04;
}

export function bakeHeightForWidth(width: number): number {
  return Math.round((width * WATERCOLOR_BAKE.h) / WATERCOLOR_BAKE.w);
}

export function sourceLabel(index: number): string {
  const i = clampStill(index);
  const s = WATERCOLOR_SOURCE[i - 1];
  const baked = `${WATERCOLOR_BAKE.w}×${WATERCOLOR_BAKE.h}`;
  if (s.w === WATERCOLOR_BAKE.w && s.h === WATERCOLOR_BAKE.h) return baked;
  return `${s.w}×${s.h} → ${baked}`;
}

export function timecode(t: number, fps = WATERCOLOR_FPS): string {
  const f = Math.max(0, Math.floor(t * fps));
  const ff = f % fps;
  const sec = Math.floor(f / fps);
  const s = sec % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}:${p(ff)}`;
}
