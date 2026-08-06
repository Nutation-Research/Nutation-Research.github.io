/**
 * Shared artifact palette — two deliberately separate sets:
 *
 *  1. TRAIL / CANVAS colors (`COACH_*`, `ANNO_TONE`) — drawn over dark imagery (the video,
 *     the motion-trail plate, the entrance demo). Tuned for dark backgrounds; used by the
 *     canvas renderers (coachIllustrations) and the pills that float over the trail.
 *     Do NOT use these for paper DOM.
 *
 *  2. PAPER / UI colors (`UI_*`, `SIGNAL_PALETTE`, `TYPE_BADGE`) — the light "protocol
 *     paper" chrome. Ink + one brand accent (deep rose = the model track), slate for the
 *     judge track, green/amber/red strictly for verdicts. Mirrors the tokens in
 *     styles/globals.css.
 */

/* ── 2. paper UI tokens ──────────────────────────────────────────────────── */

export const UI_INK = '#1c1917';
export const UI_MUTED = '#6d5558';
export const UI_FAINT = '#a07874';
export const UI_LINE = '#e8d4cf';
export const UI_SOFT = '#f5ebe8';

/** Deep rose — the model ("Physical Intelligence") track. */
export const UI_ACCENT = '#b04a75';
/** Slate — the judge / ground-truth track. */
export const UI_JUDGE = '#5b6472';
export const UI_POS = '#1a7f37';
export const UI_NEG = '#b3382e';
export const UI_WARN = '#c08a96';
/** Live capture / in-flight inference. */
export const UI_LIVE = '#c47890';
/** Second-half bonus chip — soft champagne rose. */
export const UI_BONUS = '#b8929a';

/** Element-type badge colors — dark enough to hold on paper, one hue per type. */
export const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  jump: { label: 'JUMP', color: '#b04a75' },
  spin: { label: 'SPIN', color: '#a87892' },
  step: { label: 'STEPS', color: '#3d6b8e' },
  sequence: { label: 'COMBO', color: '#7d4a9a' },
};

/** Resolve the protocol / timeline badge for an element type (+ combo detection). */
export function typeBadge(type: string, elementCode?: string): { label: string; color: string } {
  if (type === 'jump' && (elementCode?.includes('+') ?? false)) return TYPE_BADGE.sequence;
  return TYPE_BADGE[type] ?? { label: type.toUpperCase(), color: UI_JUDGE };
}

export function typeColor(type: string, elementCode?: string): string {
  return typeBadge(type, elementCode).color;
}

/** Subtle lane-band wash — same hue family as the type badge, low alpha. */
export function typeBandFill(type: string, elementCode?: string, alpha = 0.08): string {
  const hex = typeColor(type, elementCode).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Signal-line palette for telemetry lanes on white — editorial chart colors
 * (rose / slate / bronze family, no rainbow cycling). Cycled by selection index.
 */
export const SIGNAL_PALETTE = [
  UI_ACCENT,  // rose (brand)
  '#5b6472',  // slate
  '#a87892',  // plum-rose (spin family)
  '#3d6b8e',  // steel blue
  '#7d4a9a',  // plum
  '#1a7f37',  // green
  '#b3382e',  // red
  '#3e8a7d',  // teal
  '#b8929a',  // champagne rose
  '#6b7d3d',  // olive
  '#4a5a9a',  // indigo
  '#a05880',  // mauve
] as const;

/** Element highlight bands on signal lanes (subtle rose wash on white). */
export const SIGNAL_BAND_FILL = 'rgba(176,74,117,0.06)';
/** Drag-to-zoom / focus chrome on signal lanes. */
export const SIGNAL_FOCUS_FILL = 'rgba(176,74,117,0.10)';
export const SIGNAL_FOCUS_STROKE = 'rgba(176,74,117,0.45)';

/* ── 1. trail / canvas colors (dark-background tuned — unchanged) ────────── */

/** Dusty rose — accent over the dark trail plate. */
export const COACH_ACCENT = '#d4789a';
/** Silver-platinum — neutral chrome over the trail. */
export const COACH_NEUTRAL = '#9898b0';
/** Muted sage — positive over the trail. */
export const COACH_POSITIVE = '#5a9878';
/** Deep rose-red — negative over the trail. */
export const COACH_NEGATIVE = '#b05060';
/** Warm cream — insight text on the dark trail plate (blush register). */
export const COACH_TEXT = '#f0e6e2';
/** Warm gold — the ONE yellow on the trail: partially-bad callouts (unclear edge, etc.)
 *  and the rotation-axis line. Kept out of the rose/sage/crimson meaning-system on purpose,
 *  so "caution" always reads as this one hue. */
export const COACH_WARN = '#d9a94a';

/** Annotation + illustration tone map (canvas overlays on the dark plate). */
export const ANNO_TONE: Record<'info' | 'good' | 'warn' | 'bad', string> = {
  info: COACH_ACCENT,
  good: COACH_POSITIVE,
  warn: COACH_WARN,
  bad: COACH_NEGATIVE,
};
