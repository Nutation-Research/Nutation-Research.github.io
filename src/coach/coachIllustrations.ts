/**
 * Per-bullet illustrations drawn OVER the frozen motion trail (docs/MOTION_TRAIL.md §4). When a
 * CoachPanel bullet is clicked it sets a `focus`; the trail isolates the relevant frames (the
 * auto-"zoom", overlay.focusWindow) and this module draws the guidance for that bullet on top of
 * the echoes.
 *
 * Geometry doctrine: every line is anchored to points that exist on the drawn bodies —
 * the per-echo centre of mass for the flight path, the lowest foot point for blade/ice
 * contact — and the jump phases (take-off / apex / landing source frames) come from
 * coachContent (authored, pose-derived) via `IllusOpts.phase`. Nothing is fit to a
 * synthetic parabola or a horizontal "ground": the ice line is the segment through the
 * two real contact points, and the flight path passes through every airborne body.
 *
 * Style: protocol register on the dark trail plate — Inter for prose, mono for
 * metrics, hairline rose-tinted pills, tick-capped dimension lines, one accent
 * tone per meaning, no glow or rainbow gradients.
 *
 * Pure canvas drawing over CANVAS-px geometry: the caller (MotionTrail.drawFrozen) projects each
 * visible echo's joints to screen px (matching the echoes' own transform, so the overlays sit on
 * the bodies) and hands them here as `EchoScreen`s. No DOM/store access — just paint.
 */
import type { CoachFocus } from './coachStore';
import type { JumpPhase } from './overlay';
import {
  ANNO_TONE,
  COACH_ACCENT,
  COACH_POSITIVE,
  COACH_WARN,
  COACH_NEGATIVE,
  COACH_TEXT,
} from './palette';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** What an authored annotation rings on an echo. */
export type AnnoTarget = 'rightFoot' | 'leftFoot' | 'lowFoot' | 'com' | 'head' | 'rightWrist' | 'leftWrist';
/** Severity tint of an authored annotation. */
export type AnnoTone = 'info' | 'good' | 'warn' | 'bad';

const TONE: Record<AnnoTone, string> = ANNO_TONE;

/** One visible echo, already projected to canvas px (sorted left→right by the caller). */
export interface EchoScreen {
  frame: number;
  x: number; // anchor (hip) screen x — the echo's slot
  alpha: number; // current reveal/selection opacity [0,1]
  hip: { x: number; y: number };
  com: { x: number; y: number } | null;
  head: { x: number; y: number } | null;
  /** Every reliably-visible foot/ankle point (for the blade highlight). */
  feet: { x: number; y: number }[];
  /** The lowest foot point (max y ≈ nearest the ice) — the blade-path sample. */
  lowFoot: { x: number; y: number } | null;
  /** Per-side skating foot (toe, else ankle) — for ringing a specific blade. */
  rightFoot: { x: number; y: number } | null;
  leftFoot: { x: number; y: number } | null;
  /** Wrists — for ringing a free arm (e.g. the one-arm tano on a combo's second jump). */
  rightWrist: { x: number; y: number } | null;
  leftWrist: { x: number; y: number } | null;
  axis: { x1: number; y1: number; x2: number; y2: number } | null;
  tiltDeg: number; // inclination_deg (signed body lean), NaN if unknown
  effort: number; // mean clip-normalized jerk over the joints [0,1], NaN if unknown
}

/** An authored callout resolved to a concrete source frame (MotionTrail maps the echo index → the
 *  frame, robust to the build/glide animation). Drawn as a ring (leaving the joint visible) + a
 *  connected caption. */
export interface TrailAnnotation {
  frame: number;
  target: AnnoTarget;
  text: string;
  tone: AnnoTone;
  /** Radius multiplier for the ring (1 = normal). */
  scale?: number;
  /** Force the caption to appear below the ring instead of above. */
  below?: boolean;
  /** Small offset in canvas pixels to nudge the ring (positive x = right, positive y = down). */
  offsetX?: number;
  offsetY?: number;
}

/** The +2nd jump of a combination (e.g. the +2T): its phases + resolved metric labels. */
export interface SecondJump {
  phase: JumpPhase;
  /** Labels its take-off on the drawings (e.g. '2T'). */
  code: string | null;
  heightCm: number | null;
  airTimeS: number | null;
  rotations: number | null;
}

export interface IllusOpts {
  /** Jump phases in SOURCE frames (authored per element, pose-derived). Null → no jump.
   *  On a combination this is the FIRST jump. */
  phase: JumpPhase | null;
  /** Resolved metric labels (curated ?? kinematic ?? L3). Null cells simply don't label. */
  heightCm: number | null;
  airTimeS: number | null;
  lengthM: number | null;
  rotations: number | null;
  revPerS: number | null;
  /** The second jump of a combination (draws a second flight arc); null for a solo jump. */
  second: SecondJump | null;
  strokeW: number;
  cw: number;
  ch: number;
  /** Landing-page only: px below the ice for the length dimension (default 30). Smaller = higher. */
  lengthDimOff?: number;
}

// ── phase-anchored echo picking (pure, exported for tests) ────────────────────

/** The take-off contact echo: the LAST echo still on the ice (frame ≤ takeoff). */
export function takeoffEcho(echoes: EchoScreen[], phase: JumpPhase | null): EchoScreen {
  if (phase) {
    for (let i = echoes.length - 1; i >= 0; i--) if (echoes[i].frame <= phase.takeoff) return echoes[i];
  }
  return echoes[0];
}

/** The landing contact echo: the FIRST echo back on the ice (frame ≥ landing). */
export function landingEcho(echoes: EchoScreen[], phase: JumpPhase | null): EchoScreen {
  if (phase) {
    for (const e of echoes) if (e.frame >= phase.landing) return e;
  }
  return echoes[echoes.length - 1];
}

/** Echoes in flight (contacts inclusive), for the CoM flight path. */
export function flightEchoes(echoes: EchoScreen[], phase: JumpPhase | null): EchoScreen[] {
  if (!phase) return echoes;
  const sel = echoes.filter((e) => e.frame >= phase.takeoff && e.frame <= phase.landing);
  return sel.length >= 2 ? sel : echoes;
}

/** Draw the illustration for `focus` over the visible echoes. No-op for overview. */
export function drawIllustration(
  ctx: CanvasRenderingContext2D,
  focus: CoachFocus,
  echoes: EchoScreen[],
  opts: IllusOpts,
): void {
  if (echoes.length < 2) return;
  const e = [...echoes].sort((a, b) => a.frame - b.frame);
  switch (focus) {
    case 'height':
      drawHeightLength(ctx, e, opts);
      break;
    case 'takeoff':
      drawTakeoffLanding(ctx, e, opts);
      break;
    case 'entry':
      drawEntry(ctx, e, opts);
      break;
    case 'axis':
      drawAxisEvolution(ctx, e, opts);
      break;
    case 'effort':
      drawEffort(ctx, e, opts);
      break;
    case 'edge':
      drawEdge(ctx, e, opts);
      break;
    default:
      break; // overview: the trail itself carries it
  }
}

// ── typography + plate chrome (mirrors paper UI on the dark viewport) ───────

const FONT_BODY = '500 11px Inter, ui-sans-serif, -apple-system, sans-serif';
const FONT_LABEL = '600 10px ui-monospace, SF Mono, Menlo, monospace';
const FONT_STAT = '500 10px ui-monospace, SF Mono, Menlo, monospace';
const FONT_FORMULA = '500 11px ui-monospace, SF Mono, Menlo, monospace';

const PLATE_BG = 'rgba(16, 14, 18, 0.86)';
const PLATE_TEXT = COACH_TEXT;
const PLATE_MUTED = 'rgba(240, 230, 226, 0.68)';

/** Rose-toned effort curve (replaces the magma rainbow on the chart). */
function effortChartColor(v: number): string {
  const t = clamp01(v);
  const r = Math.round(120 + t * 92);
  const g = Math.round(72 + t * 48);
  const b = Math.round(96 + t * 58);
  return `rgba(${r},${g},${b},${0.55 + t * 0.45})`;
}

// ── drawing primitives ──────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A compact mono pill — hairline rose border, dark blush backing. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.save();
  ctx.font = FONT_LABEL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const bw = w + 12;
  const bh = 18;
  roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, 4);
  ctx.fillStyle = PLATE_BG;
  ctx.fill();
  ctx.strokeStyle = `${color}44`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/** Formula pill — primary equation, optional muted gloss below. */
function formulaBlock(
  ctx: CanvasRenderingContext2D,
  primary: string,
  gloss: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONT_FORMULA;
  const w1 = ctx.measureText(primary).width;
  const w2 = gloss ? (ctx.font = FONT_STAT, ctx.measureText(gloss).width) : 0;
  const bw = Math.max(w1, w2) + 16;
  const bh = gloss ? 34 : 22;
  const top = y - bh / 2;
  roundRect(ctx, x - bw / 2, top, bw, bh, 5);
  ctx.fillStyle = PLATE_BG;
  ctx.fill();
  ctx.strokeStyle = `${color}44`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = FONT_FORMULA;
  ctx.fillStyle = color;
  ctx.fillText(primary, x, gloss ? top + 12 : top + bh / 2);
  if (gloss) {
    ctx.font = FONT_STAT;
    ctx.fillStyle = PLATE_MUTED;
    ctx.fillText(gloss, x, top + 24);
  }
  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // hairline dark rim so the dot reads on any plate brightness
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** A dimension line a→b with perpendicular tick caps (draftsman style, no arrowheads). */
function dimLine(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  color: string,
  w: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // unit normal for the tick caps
  const ny = dx / len;
  const tick = Math.max(5, w * 3.5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.moveTo(ax + nx * tick, ay + ny * tick);
  ctx.lineTo(ax - nx * tick, ay - ny * tick);
  ctx.moveTo(bx + nx * tick, by + ny * tick);
  ctx.lineTo(bx - nx * tick, by - ny * tick);
  ctx.stroke();
  ctx.restore();
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.45), y - size * Math.sin(angle - 0.45));
  ctx.lineTo(x - size * Math.cos(angle + 0.45), y - size * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** A smooth curve through the points (quadratic midpoint smoothing). */
function curve(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

/** A row of stat pills along the bottom of the canvas. */
function statRow(ctx: CanvasRenderingContext2D, parts: string[], cw: number, ch: number, color: string) {
  if (!parts.length) return;
  label(ctx, parts.join('  ·  '), cw / 2, ch - 20, color);
}

const ICE_COLOR = 'rgba(255,255,255,0.38)';

// ── per-focus illustrations ──────────────────────────────────────────────────

const ROSE = COACH_ACCENT;
const SAGE = COACH_POSITIVE;
const CRIMSON = COACH_NEGATIVE;

/** One jump's flight drawing: CoM spline through the airborne bodies, apex marker, and (when
 *  there's room) a tick-capped height dimension from the apex CoM to the contacts' CoM
 *  baseline. Returns the contact points so the caller can draw the shared ice line. */
function drawFlight(
  ctx: CanvasRenderingContext2D,
  e: EchoScreen[],
  ph: JumpPhase,
  o: IllusOpts,
  heightCm: number | null,
  rotLabel: string | null,
): { toPt: { x: number; y: number }; laPt: { x: number; y: number } } {
  const to = takeoffEcho(e, ph);
  const la = landingEcho(e, ph);
  const toPt = to.lowFoot ?? to.hip;
  const laPt = la.lowFoot ?? la.hip;

  // ── the flight path: through every flight echo's CoM (touches the bodies) ──
  const comPts = flightEchoes(e, ph).map((s) => s.com ?? s.hip);
  ctx.save();
  ctx.strokeStyle = ROSE;
  ctx.lineWidth = o.strokeW * 1.5;
  ctx.lineCap = 'round';
  curve(ctx, comPts);
  ctx.restore();
  for (const p of comPts) dot(ctx, p.x, p.y, o.strokeW * 1.4, ROSE);

  // ── apex (highest CoM among the flight echoes) ──
  let apex = comPts[0];
  for (const p of comPts) if (p.y < apex.y) apex = p;
  dot(ctx, apex.x, apex.y, o.strokeW * 2.2, ROSE);

  // ── contacts ──
  dot(ctx, toPt.x, toPt.y, o.strokeW * 2.2, SAGE);
  dot(ctx, laPt.x, laPt.y, o.strokeW * 2.2, SAGE);

  // ── height dimension: apex CoM → the CoM baseline (take-off CoM → landing CoM) ──
  // The baseline is the "standing CoM" reference the jump rises from; measuring to it (not to
  // the ice) is the physical definition of jump height.
  const toCom = to.com ?? to.hip;
  const laCom = la.com ?? la.hip;
  const baseYAt = (x: number) => {
    const t = laCom.x === toCom.x ? 0 : (x - toCom.x) / (laCom.x - toCom.x);
    return toCom.y + clamp01(t) * (laCom.y - toCom.y);
  };
  const baseY = baseYAt(apex.x);
  if (baseY - apex.y > 14) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = o.strokeW * 0.8;
    ctx.setLineDash([o.strokeW * 2, o.strokeW * 2.4]);
    ctx.beginPath();
    ctx.moveTo(toCom.x, toCom.y);
    ctx.lineTo(laCom.x, laCom.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const hx = apex.x + 20; // beside the apex body, not on it
    dimLine(ctx, hx, apex.y, hx, baseY, ROSE, o.strokeW);
    if (heightCm != null) label(ctx, `≈${Math.round(heightCm)} cm`, hx + 52, (apex.y + baseY) / 2, ROSE);
  }

  if (rotLabel) label(ctx, rotLabel, apex.x, apex.y - 28, PLATE_TEXT);
  return { toPt, laPt };
}

/** "Very good height & length": the ice line through the real contact points, one CoM flight
 *  spline PER JUMP (a combination draws both — the amplitude drop between them is the point),
 *  per-jump height dimensions, a length dimension along the ice, and a stat row. */
function drawHeightLength(ctx: CanvasRenderingContext2D, e: EchoScreen[], o: IllusOpts) {
  const ph = o.phase;
  if (!ph) return;

  // First jump (labelled with rotation when known).
  const rot1 = o.rotations != null
    ? `${o.rotations} rev${o.revPerS != null ? `  ${o.revPerS.toFixed(2)} rev/s` : ''}`
    : null;
  const j1 = drawFlight(ctx, e, ph, o, o.heightCm, rot1);
  // Second jump of a combination.
  const j2 = o.second ? drawFlight(ctx, e, o.second.phase, o, o.second.heightCm, o.second.rotations != null ? `${o.second.rotations} rev` : null) : null;

  // ── the ice: a line through the FIRST take-off and the LAST landing contact ──
  const toPt = j1.toPt;
  const laPt = j2 ? j2.laPt : j1.laPt;
  const idx = laPt.x - toPt.x;
  const idy = laPt.y - toPt.y;
  const ilen = Math.hypot(idx, idy) || 1;
  const iux = idx / ilen;
  const iuy = idy / ilen;
  // down-normal (points below the ice on screen)
  const ndown = iux >= 0 ? { x: -iuy, y: iux } : { x: iuy, y: -iux };
  const EXT = 46;
  ctx.save();
  ctx.strokeStyle = ICE_COLOR;
  ctx.lineWidth = o.strokeW * 0.9;
  ctx.beginPath();
  ctx.moveTo(toPt.x - iux * EXT, toPt.y - iuy * EXT);
  ctx.lineTo(laPt.x + iux * EXT, laPt.y + iuy * EXT);
  ctx.stroke();
  ctx.restore();

  // ── contact labels ──
  label(ctx, 'take-off', toPt.x + ndown.x * 26, toPt.y + ndown.y * 26, SAGE);
  if (j2) {
    label(ctx, `${o.second!.code ?? '+1'} take-off`, j2.toPt.x + ndown.x * 26, j2.toPt.y + ndown.y * 26, SAGE);
    label(ctx, 'landing', j2.laPt.x + ndown.x * 26, j2.laPt.y + ndown.y * 26, SAGE);
  } else {
    label(ctx, 'landing', j1.laPt.x + ndown.x * 26, j1.laPt.y + ndown.y * 26, SAGE);
  }

  // ── length dimension: along the ice, offset below it (the FIRST jump's span) ──
  const OFF = o.lengthDimOff ?? 30;
  dimLine(
    ctx,
    toPt.x + ndown.x * OFF, toPt.y + ndown.y * OFF,
    j1.laPt.x + ndown.x * OFF, j1.laPt.y + ndown.y * OFF,
    'rgba(240, 230, 226, 0.72)', o.strokeW,
  );
  const lenTxt = o.lengthM != null ? `~${o.lengthM.toFixed(1)} m` : null;
  if (lenTxt) {
    label(
      ctx,       lenTxt,
      (toPt.x + j1.laPt.x) / 2 + ndown.x * (OFF + 16),
      (toPt.y + j1.laPt.y) / 2 + ndown.y * (OFF + 16),
      PLATE_TEXT,
    );
  }

  // ── stat row ──
  const stats: string[] = [];
  if (o.airTimeS != null) stats.push(`air ${o.airTimeS.toFixed(2)} s`);
  if (o.heightCm != null) stats.push(`height ≈${Math.round(o.heightCm)} cm`);
  if (o.lengthM != null) stats.push(`length ~${o.lengthM.toFixed(1)} m`);
  if (o.second?.airTimeS != null && o.second?.heightCm != null) {
    stats.push(`${o.second.code ?? '+1'}: air ${o.second.airTimeS.toFixed(2)} s  ≈${Math.round(o.second.heightCm)} cm`);
  }
  statRow(ctx, stats, o.cw, o.ch, COACH_TEXT);
}

/** "Steps before / creative entry": the skating blade's path up to the take-off — ON-ICE points
 *  only (frame ≤ takeoff), with a direction arrow into the take-off. */
function drawEntry(ctx: CanvasRenderingContext2D, e: EchoScreen[], o: IllusOpts) {
  const ph = o.phase;
  const onIce = ph ? e.filter((s) => s.frame <= ph.takeoff) : e;
  const pts = onIce.map((s) => s.lowFoot ?? s.hip);
  if (pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = SAGE;
  ctx.lineWidth = o.strokeW * 1.4;
  ctx.lineCap = 'round';
  curve(ctx, pts);
  ctx.restore();
  for (const p of pts) dot(ctx, p.x, p.y, o.strokeW * 1.3, SAGE);

  // direction arrow into the take-off
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.save();
  ctx.fillStyle = SAGE;
  arrowHead(ctx, b.x + Math.cos(ang) * 14, b.y + Math.sin(ang) * 14, ang, o.strokeW * 4 + 6);
  ctx.restore();

  dot(ctx, b.x, b.y, o.strokeW * 2.2, SAGE);
  label(ctx, 'entry glide → take-off', pts[Math.floor(pts.length / 2)].x, Math.max(...pts.map((p) => p.y)) + 28, SAGE);
}

/** "Good take-off and landing": the two blade tracks that touch the ice — the approach into the
 *  take-off and the landing run-out — with the flight linked by a faint dotted CoM path (never a
 *  blade line through the air). */
function drawTakeoffLanding(ctx: CanvasRenderingContext2D, e: EchoScreen[], o: IllusOpts) {
  const ph = o.phase;
  if (!ph) {
    // No jump phase (spins/steps): a single honest blade path.
    const pts = e.map((s) => s.lowFoot ?? s.hip);
    ctx.save();
    ctx.strokeStyle = SAGE;
    ctx.lineWidth = o.strokeW * 1.3;
    ctx.lineCap = 'round';
    curve(ctx, pts);
    ctx.restore();
    return;
  }
  // The on-ice blade tracks: approach → (air) → between-jumps (combo) → (air) → run-out. "On
  // ice" is everything outside the flight windows; each air span gets a faint dotted CoM link.
  const ph2 = o.second?.phase ?? null;
  const onIce = (f: number) =>
    !(f > ph.takeoff && f < ph.landing) && !(ph2 != null && f > ph2.takeoff && f < ph2.landing);
  const airSpans: JumpPhase[] = ph2 ? [ph, ph2] : [ph];

  for (const span of airSpans) {
    const air = e.filter((s) => s.frame >= span.takeoff && s.frame <= span.landing).map((s) => s.com ?? s.hip);
    if (air.length >= 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = o.strokeW * 0.9;
      ctx.setLineDash([o.strokeW * 1.2, o.strokeW * 2.6]);
      curve(ctx, air);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // Contiguous on-ice segments (split at the flights).
  const segs: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const s of e) {
    if (onIce(s.frame)) {
      cur.push(s.lowFoot ?? s.hip);
    } else if (cur.length) {
      segs.push(cur);
      cur = [];
    }
  }
  if (cur.length) segs.push(cur);

  ctx.save();
  ctx.strokeStyle = SAGE;
  ctx.lineWidth = o.strokeW * 1.5;
  ctx.lineCap = 'round';
  for (const seg of segs) if (seg.length >= 2) curve(ctx, seg);
  ctx.restore();
  for (const seg of segs) for (const p of seg) dot(ctx, p.x, p.y, o.strokeW * 1.3, SAGE);

  // Contact markers: each take-off + each landing, labelled.
  const marks: { pt: { x: number; y: number }; text: string }[] = [];
  const to1 = takeoffEcho(e, ph);
  const la1 = landingEcho(e, ph);
  marks.push({ pt: to1.lowFoot ?? to1.hip, text: 'take-off' });
  if (ph2) {
    const to2 = takeoffEcho(e, ph2);
    const la2 = landingEcho(e, ph2);
    marks.push({ pt: la1.lowFoot ?? la1.hip, text: `landing → ${o.second!.code ?? '+1'}` });
    marks.push({ pt: to2.lowFoot ?? to2.hip, text: `${o.second!.code ?? '+1'} take-off` });
    marks.push({ pt: la2.lowFoot ?? la2.hip, text: 'landing — back outside edge' });
  } else {
    marks.push({ pt: la1.lowFoot ?? la1.hip, text: 'landing — back outside edge' });
  }
  for (const m of marks) {
    dot(ctx, m.pt.x, m.pt.y, o.strokeW * 2.2, SAGE);
    label(ctx, m.text, m.pt.x, m.pt.y + 26, SAGE);
  }
}

/** "Very good body position": each echo's rotational axis drawn bold, plus a faint envelope
 *  connecting the axis ends so the lean's evolution over the arc reads as a sweep.
 *  Same gold as the axis line, stepped up so the highlight reads hotter than the default axis. */
function drawAxisEvolution(ctx: CanvasRenderingContext2D, e: EchoScreen[], o: IllusOpts) {
  const axes = e.filter((s) => s.axis).map((s) => s.axis!);
  if (axes.length < 2) return;
  const tops = axes.map((a) => ({ x: a.x1, y: a.y1 }));
  const bots = axes.map((a) => ({ x: a.x2, y: a.y2 }));
  // Brighter than COACH_WARN (#d9a94a) — same hue family, more highlight.
  const GOLD = '#f0c45c';

  ctx.save();
  // Envelope (how the axis sweeps over the arc).
  ctx.strokeStyle = `${GOLD}55`;
  ctx.lineWidth = o.strokeW;
  ctx.setLineDash([o.strokeW * 2.5, o.strokeW * 2.5]);
  curve(ctx, tops);
  curve(ctx, bots);
  ctx.setLineDash([]);
  // Bold per-echo axis.
  ctx.strokeStyle = `${GOLD}f0`;
  ctx.lineWidth = o.strokeW * 1.3;
  ctx.lineCap = 'round';
  for (const a of axes) {
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
  }
  ctx.restore();

  const tilts = e.map((s) => s.tiltDeg).filter((v) => Number.isFinite(v));
  const topY = Math.min(...tops.map((t) => t.y));
  const mid = e[Math.floor(e.length / 2)].x;
  if (tilts.length) {
    const lo = Math.round(Math.min(...tilts));
    const hi = Math.round(Math.max(...tilts));
    label(ctx, `axis  lean ${lo}° → ${hi}°`, mid, topY - 14, GOLD);
  } else {
    label(ctx, 'axis of rotation', mid, topY - 14, GOLD);
  }
}

/** "Effortless throughout": the per-echo jerk (effort) plotted as a filled curve under the strip.
 *  The shaded area is the effort integral — a small area means the motion was effortless. */
function drawEffort(ctx: CanvasRenderingContext2D, e: EchoScreen[], o: IllusOpts) {
  const vals = e.map((s) => (Number.isFinite(s.effort) ? clamp01(s.effort) : 0));
  const x0 = e[0].x;
  const x1 = e[e.length - 1].x;
  const H = Math.min(80, o.ch * 0.16);
  const baseY = Math.min(Math.max(...e.map((s) => s.hip.y)) + 54, o.ch - 34);
  const pts = e.map((s, i) => ({ x: s.x, y: baseY - vals[i] * H }));

  ctx.save();
  // Integral area — rose wash (low area = effortless).
  const grad = ctx.createLinearGradient(0, baseY - H, 0, baseY);
  grad.addColorStop(0, 'rgba(212, 120, 154, 0.38)');
  grad.addColorStop(1, 'rgba(16, 14, 18, 0.28)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x0, baseY);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.lineTo(x1, baseY);
  ctx.closePath();
  ctx.fill();
  // The curve itself — rose-toned by jerk level.
  ctx.lineWidth = o.strokeW * 1.3;
  ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = effortChartColor(vals[i]);
    ctx.beginPath();
    ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
    ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  // Baseline.
  ctx.strokeStyle = 'rgba(240, 230, 226, 0.22)';
  ctx.lineWidth = o.strokeW * 0.8;
  ctx.beginPath();
  ctx.moveTo(x0, baseY);
  ctx.lineTo(x1, baseY);
  ctx.stroke();
  ctx.restore();

  formulaBlock(
    ctx,
    'effort = ∫jerk(t)dt',
    '',
    (x0 + x1) / 2,
    baseY + 24,
    PLATE_TEXT,
  );
}

/** "Unclear take-off edge ( ! )": highlight the skating blade at the LAST on-ice echo (the real
 *  take-off contact) with a roll arc toward flat/outside — a flip needs a back-INSIDE edge. */
function drawEdge(ctx: CanvasRenderingContext2D, e: EchoScreen[], o: IllusOpts) {
  const contact = takeoffEcho(e, o.phase);
  const f = contact.lowFoot ?? contact.hip;
  const R = o.strokeW * 7;

  ctx.save();
  // The blade segment (ankle→toe), highlighted amber, if we have two foot points.
  if (contact.feet.length >= 2) {
    const sorted = [...contact.feet].sort((a, b) => b.y - a.y);
    const a = sorted[0];
    const b = sorted[1];
    ctx.strokeStyle = COACH_WARN;
    ctx.lineWidth = o.strokeW * 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Attention ring on the blade.
  ctx.strokeStyle = CRIMSON;
  ctx.lineWidth = o.strokeW * 1.5;
  ctx.beginPath();
  ctx.arc(f.x, f.y, R, 0, Math.PI * 2);
  ctx.stroke();
  // A curved arrow showing the blade rolling toward the outside edge.
  ctx.beginPath();
  ctx.arc(f.x, f.y, R + o.strokeW * 3, Math.PI * 0.15, Math.PI * 0.95);
  ctx.stroke();
  const ang = Math.PI * 0.95;
  ctx.fillStyle = CRIMSON;
  arrowHead(ctx, f.x + (R + o.strokeW * 3) * Math.cos(ang), f.y + (R + o.strokeW * 3) * Math.sin(ang), ang + Math.PI / 2, o.strokeW * 4 + 4);
  ctx.restore();

  label(ctx, 'edge unclear — rolled flat/outside', f.x, f.y - R - 28, CRIMSON);
  label(ctx, 'flip needs back-inside edge', f.x, f.y - R - 10, COACH_WARN);
}

// ── authored annotations (per-element, frame-specific callouts) ───────────────

function targetPoint(e: EchoScreen, t: AnnoTarget): { x: number; y: number } | null {
  switch (t) {
    case 'rightFoot':
      return e.rightFoot ?? e.lowFoot;
    case 'leftFoot':
      return e.leftFoot ?? e.lowFoot;
    case 'lowFoot':
      return e.lowFoot;
    case 'com':
      return e.com ?? e.hip;
    case 'head':
      return e.head ?? e.hip;
    case 'rightWrist':
      return e.rightWrist;
    case 'leftWrist':
      return e.leftWrist;
    default:
      return null;
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** A ring that LEAVES THE JOINT VISIBLE (stroked, not filled) plus a connected caption panel.
 *  By default the caption sits above the ring and flips below only if there isn't room at the top.
 *  Pass `below=true` to force the caption below the ring. */
function drawCallout(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  text: string,
  color: string,
  strokeW: number,
  cw: number,
  ch: number,
  below = false,
) {
  // The ring on the joint.
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeW * 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // The caption panel — protocol register (Inter body, rose hairline).
  ctx.font = FONT_BODY;
  const pad = 8;
  const lineH = 15;
  const maxW = Math.min(240, cw * 0.34);
  const lines = wrapText(ctx, text, maxW - pad * 2);
  const panelW = maxW;
  const panelH = lines.length * lineH + pad * 2;
  const gap = R + 14;

  let panelTop: number;
  let isBelow: boolean;
  if (below) {
    isBelow = true;
    panelTop = cy + gap;
  } else {
    panelTop = cy - gap - panelH; // prefer above
    isBelow = false;
    if (panelTop < 10) {
      panelTop = cy + gap; // not enough headroom → place below
      isBelow = true;
    }
  }
  panelTop = Math.max(10, Math.min(panelTop, ch - panelH - 10)); // keep on-canvas
  const panelX = Math.max(10, Math.min(cx - panelW / 2, cw - panelW - 10));

  // Leader from the ring edge to the panel.
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeW;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  if (isBelow) {
    ctx.moveTo(cx, cy + R);
    ctx.lineTo(cx, panelTop);
  } else {
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, panelTop + panelH);
  }
  ctx.stroke();
  ctx.restore();

  // Panel background + tone accent bar.
  ctx.save();
  roundRect(ctx, panelX, panelTop, panelW, panelH, 6);
  ctx.fillStyle = PLATE_BG;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `${color}44`;
  ctx.stroke();
  ctx.fillStyle = color;
  roundRect(ctx, panelX, panelTop, 3, panelH, 2);
  ctx.fill();
  // Text.
  ctx.fillStyle = PLATE_TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((ln, i) => ctx.fillText(ln, panelX + pad + 5, panelTop + pad + i * lineH));
  ctx.restore();
}

/** Draw the authored, frame-specific callouts (e.g. the unclear-edge rings) over the echoes. Each
 *  annotation is matched to its echo by source frame, so it tracks the build/glide; echoes not yet
 *  revealed are skipped until present. */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: TrailAnnotation[],
  echoes: EchoScreen[],
  strokeW: number,
  cw: number,
  ch: number,
): void {
  const byFrame = new Map(echoes.map((e) => [e.frame, e]));
  const baseR = Math.max(15, strokeW * 6);
  for (const an of annotations) {
    const e = byFrame.get(an.frame);
    if (!e) continue;
    const pt = targetPoint(e, an.target);
    if (!pt) continue;
    const x = pt.x + (an.offsetX ?? 0);
    const y = pt.y + (an.offsetY ?? 0);
    const r = baseR * (an.scale ?? 1);
    drawCallout(ctx, x, y, r, an.text, TONE[an.tone] ?? TONE.warn, strokeW, cw, ch, !!an.below);
  }
}
