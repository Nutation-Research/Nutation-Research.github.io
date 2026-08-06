/**
 * Pure overlay geometry: project a table row's joints from source-resolution
 * pixels into canvas pixels, gated on visibility. Kept free of canvas/DOM so the
 * coordinate mapping (the real correctness risk) is unit-testable. The React
 * overlay strokes whatever this returns.
 */
import { rowForFrame, type ArtifactTable } from './decode';
import { N_JOINTS, SKELETON_EDGES } from './joints';
import type { CoachFocus } from './coachStore';

export const VIS_MIN = 0.5; // ARTIFACT.md §2: joints below this are unreliable.

// Torso joint indices (canonical order, ARTIFACT.md §2).
const NOSE = 0;
const L_SHOULDER = 1;
const R_SHOULDER = 2;
const L_WRIST = 5;
const R_WRIST = 6;
const L_HIP = 7;
const R_HIP = 8;
const L_ANKLE = 11;
const R_ANKLE = 12;
const L_FOOT = 13;
const R_FOOT = 14;

export interface FrameGeometry {
  /** Skeleton segments in canvas px, with the effort at each endpoint (NaN if
   *  unknown) so limbs can be drawn as a per-segment effort gradient. */
  edges: { x1: number; y1: number; x2: number; y2: number; ea: number; eb: number }[];
  /** Joint dots in canvas px, paired with effort (NaN if unknown) for coloring. */
  points: { x: number; y: number; effort: number }[];
}

/** The CSS `object-contain` mapping the <video> uses: the largest aspect-
 *  preserving fit of an `fw×fh` source into a `cw×ch` box, centered. The overlay
 *  must apply the SAME transform so joints land on the video pixels regardless of
 *  the box's aspect ratio (otherwise the skeleton drifts off the letterboxed video). */
export function containTransform(fw: number, fh: number, cw: number, ch: number) {
  const scale = Math.min(cw / fw, ch / fh);
  return { scale, offsetX: (cw - fw * scale) / 2, offsetY: (ch - fh * scale) / 2 };
}

/** Project joints for `row` into a `cw×ch` canvas. `fw/fh` are the source frame
 *  dimensions the pixel coordinates are expressed in (from meta). */
export function frameGeometry(
  table: Pick<ArtifactTable, 'jointsXY' | 'vis' | 'effort'>,
  row: number,
  fw: number,
  fh: number,
  cw: number,
  ch: number,
): FrameGeometry {
  const base = row * N_JOINTS;
  const xy = table.jointsXY;
  const vis = table.vis;
  const effort = table.effort;

  const { scale, offsetX, offsetY } = containTransform(fw, fh, cw, ch);
  const px = (j: number) => offsetX + xy[(base + j) * 2] * scale;
  const py = (j: number) => offsetY + xy[(base + j) * 2 + 1] * scale;
  const ok = (j: number) => vis[base + j] >= VIS_MIN; // NaN fails the compare → excluded

  const edges: FrameGeometry['edges'] = [];
  for (const [a, b] of SKELETON_EDGES) {
    if (ok(a) && ok(b)) {
      edges.push({ x1: px(a), y1: py(a), x2: px(b), y2: py(b), ea: effort[base + a], eb: effort[base + b] });
    }
  }
  const points: FrameGeometry['points'] = [];
  for (let j = 0; j < N_JOINTS; j++) {
    if (ok(j)) points.push({ x: px(j), y: py(j), effort: effort[base + j] });
  }
  return { edges, points };
}

export interface AxisGeometry {
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angleDeg: number;
}

/** The body axis segment in canvas px, drawn **straight along the torso** (hip→shoulder
 *  joints) through its center, and labeled with `inclination_deg` (ARTIFACT.md §3: 0 =
 *  upright, signed lean from vertical). Drawing from the joints rather than the angle keeps
 *  the line exactly on the body regardless of the angle's parameterization. Returns null when
 *  the inclination is null or the torso joints that define the line are unreliable — never
 *  fabricate an axis. */
export function axisGeometry(
  table: Pick<ArtifactTable, 'jointsXY' | 'vis' | 'inclinationDeg'>,
  row: number,
  fw: number,
  fh: number,
  cw: number,
  ch: number,
): AxisGeometry | null {
  const angleDeg = table.inclinationDeg[row];
  if (Number.isNaN(angleDeg)) return null;
  const base = row * N_JOINTS;
  const xy = table.jointsXY;
  const vis = table.vis;
  for (const j of [L_SHOULDER, R_SHOULDER, L_HIP, R_HIP]) {
    if (!(vis[base + j] >= VIS_MIN)) return null;
  }
  const { scale, offsetX, offsetY } = containTransform(fw, fh, cw, ch);
  const px = (j: number) => offsetX + xy[(base + j) * 2] * scale;
  const py = (j: number) => offsetY + xy[(base + j) * 2 + 1] * scale;

  const shoulderMid = { x: (px(L_SHOULDER) + px(R_SHOULDER)) / 2, y: (py(L_SHOULDER) + py(R_SHOULDER)) / 2 };
  const hipMid = { x: (px(L_HIP) + px(R_HIP)) / 2, y: (py(L_HIP) + py(R_HIP)) / 2 };
  const cx = (shoulderMid.x + hipMid.x) / 2;
  const cy = (shoulderMid.y + hipMid.y) / 2;

  // Direction = the actual torso (hip→shoulder); extend ±1.6 torso-lengths through the center.
  const tdx = shoulderMid.x - hipMid.x;
  const tdy = shoulderMid.y - hipMid.y;
  const torsoLen = Math.hypot(tdx, tdy) || 1;
  const half = Math.max(torsoLen * 1.6, 1);
  const ux = tdx / torsoLen;
  const uy = tdy / torsoLen;
  return {
    cx,
    cy,
    x1: cx + ux * half,
    y1: cy + uy * half,
    x2: cx - ux * half,
    y2: cy - uy * half,
    angleDeg,
  };
}

/** The whole-body center of mass projected into canvas px (same contain transform
 *  as the skeleton/axis), or null when the CoM is undefined for this frame. */
export function comPoint(
  table: Pick<ArtifactTable, 'comXY'>,
  row: number,
  fw: number,
  fh: number,
  cw: number,
  ch: number,
): { x: number; y: number } | null {
  const cx = table.comXY[row * 2];
  const cy = table.comXY[row * 2 + 1];
  if (Number.isNaN(cx) || Number.isNaN(cy)) return null;
  const { scale, offsetX, offsetY } = containTransform(fw, fh, cw, ch);
  return { x: offsetX + cx * scale, y: offsetY + cy * scale };
}

export interface ComTrailPoint {
  x: number;
  y: number;
  age: number; // frames before the current row: 0 = newest, up to `window-1`
}

/** The CoM path over the last `window` frames (oldest→newest), in canvas px, for a
 *  fading trail. Frames with an undefined CoM are skipped (a gap — no interpolation
 *  across missing data). `age` lets the renderer fade older points. */
export function comTrail(
  table: Pick<ArtifactTable, 'comXY'>,
  row: number,
  fw: number,
  fh: number,
  cw: number,
  ch: number,
  window: number,
): ComTrailPoint[] {
  const { scale, offsetX, offsetY } = containTransform(fw, fh, cw, ch);
  const out: ComTrailPoint[] = [];
  const start = Math.max(0, row - window + 1);
  for (let i = start; i <= row; i++) {
    const cx = table.comXY[i * 2];
    const cy = table.comXY[i * 2 + 1];
    if (Number.isNaN(cx) || Number.isNaN(cy)) continue;
    out.push({ x: offsetX + cx * scale, y: offsetY + cy * scale, age: row - i });
  }
  return out;
}

// Shared layout of the per-element strip (the chronophotography strobe AND the flight
// arc drawn over it): poses/arc occupy the central [X0,X1] of the width on the BASELINE
// row. Factored so the arc's frame→x mapping can't drift from the poses' (the apex must
// sit over the apex pose).
const STRIP_X0_FRAC = 0.04;
const STRIP_X1_FRAC = 0.96;
const STRIP_BASELINE_FRAC = 0.52;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface StrobeEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface StrobePose {
  frame: number; // source frame index this pose was sampled from
  t: number; // position in the strobe, 0 (first/oldest) … 1 (last/newest)
  /** Root-normalized + laid-out skeleton segments (viewBox px), with the effort (jerk) at each
   *  endpoint (NaN if unknown) so limbs can be drawn as a per-segment effort gradient, like the
   *  main overlay. */
  edges: (StrobeEdge & { ea: number; eb: number })[];
  root: { x: number; y: number }; // the laid-out hip anchor (baseline), for phase cues
  axis: StrobeEdge | null; // torso axis segment through the body (laid-out px); null if torso unreliable
  com: { x: number; y: number } | null; // whole-body CoM in the laid-out frame; null if undefined
  tiltDeg: number; // inclination_deg at this frame (NaN if null) — the camera-robust body lean
  torsoLen: number; // hip-mid→shoulder-mid distance in source px; NaN if torso unreliable. A stable
  // body-size metric (independent of limb extension) for normalizing echoes to a uniform size.
  /** Mean clip-normalized effort (jerk) over this frame's visible joints (NaN if none) — the
   *  per-echo "effort" the jerk-integral illustration plots. */
  effort: number;
  /** A few key joints in the laid-out frame (same root-normalization as `edges`), null when not
   *  reliably visible — for the per-bullet illustrations (blade-edge path, height markers). */
  joints: {
    head: { x: number; y: number } | null;
    lWrist: { x: number; y: number } | null;
    rWrist: { x: number; y: number } | null;
    lAnkle: { x: number; y: number } | null;
    rAnkle: { x: number; y: number } | null;
    lFoot: { x: number; y: number } | null;
    rFoot: { x: number; y: number } | null;
  };
}

/** A pose's root (hip-midpoint if both hips are reliable, else the centroid of the
 *  visible joints) in source px, or null when nothing is visible. This is the point
 *  subtracted out to make the strobe camera-robust: it cancels the camera's pan/zoom
 *  of the whole body, leaving only the body's own configuration. */
function poseRoot(
  table: Pick<ArtifactTable, 'jointsXY' | 'vis'>,
  row: number,
): { x: number; y: number } | null {
  const base = row * N_JOINTS;
  const xy = table.jointsXY;
  const vis = table.vis;
  const ok = (j: number) => vis[base + j] >= VIS_MIN;
  if (ok(L_HIP) && ok(R_HIP)) {
    return {
      x: (xy[(base + L_HIP) * 2] + xy[(base + R_HIP) * 2]) / 2,
      y: (xy[(base + L_HIP) * 2 + 1] + xy[(base + R_HIP) * 2 + 1]) / 2,
    };
  }
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let j = 0; j < N_JOINTS; j++) {
    if (ok(j)) {
      sx += xy[(base + j) * 2];
      sy += xy[(base + j) * 2 + 1];
      n++;
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n } : null;
}

/**
 * K skeleton poses sampled even-in-time across `[startFrame, endFrame]`, each
 * **root-normalized** (its hip-midpoint removed) and laid out left→right at evenly
 * spaced anchors on a shared baseline — a chronophotography strip ("lingering frames
 * of motion"). It is **camera-robust by construction**: per-pose root subtraction
 * cancels the camera pan/zoom that contaminates raw `<joint>_x/_y` (ARTIFACT.md §2),
 * so the strip shows the body's configuration evolving, not the camera's motion. The
 * fabricated even horizontal stride encodes *time order*, not real travel (that is the
 * L3-derived flight arc's job — a separate view). `fw`/`fh` are the source frame dims
 * defining the viewBox the strip is drawn in. Poses with no honest root/edges are
 * skipped (never fabricated). Coordinates are pure (no canvas/DOM) so they are testable.
 */
export function strobePoses(
  table: Pick<ArtifactTable, 'n' | 'frame' | 'jointsXY' | 'vis' | 'inclinationDeg' | 'comXY' | 'effort'>,
  startFrame: number,
  endFrame: number,
  k: number,
  fw: number,
  fh: number,
  keepRealY = false,
  framesOverride?: number[],
): StrobePose[] {
  const lo = Math.min(startFrame, endFrame);
  const hi = Math.max(startFrame, endFrame);
  const span = hi - lo;
  // When `framesOverride` is given, sample at exactly those source frames (so photoreal cutout
  // echoes and their skeletons share a frame — no inter-frame drift). Otherwise sample K poses
  // even-in-time across the span. Either way the x layout is even across the strip (by index).
  const useFrames = framesOverride && framesOverride.length > 0 ? framesOverride : null;
  const count = useFrames ? useFrames.length : span <= 0 ? 1 : Math.max(1, Math.min(k, span + 1));
  const x0 = fw * STRIP_X0_FRAC; // central 76% of the width, leaving margins for the outermost poses
  const x1 = fw * STRIP_X1_FRAC;
  const baselineY = fh * STRIP_BASELINE_FRAC; // hip line a touch below center → headroom for the torso

  const out: StrobePose[] = [];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1); // 0..1 across the strip
    const frame = useFrames ? useFrames[i] : Math.round(lo + u * span);
    const row = rowForFrame(table, frame);
    const root = poseRoot(table, row);
    if (!root) continue; // no honest root → skip, don't place a fabricated pose
    const anchorX = count === 1 ? (x0 + x1) / 2 : x0 + u * (x1 - x0);
    // Always respace X to an even slot (undoing the camera's horizontal tracking). Y is either
    // flattened to the baseline (`keepRealY=false`) or kept REAL so the jump arc shows in the
    // bodies themselves (2D motion, no depth) — `keepRealY=true`.
    const dx = anchorX - root.x;
    const dy = keepRealY ? 0 : baselineY - root.y;
    const base = row * N_JOINTS;
    const xy = table.jointsXY;
    const vis = table.vis;
    const ok = (j: number) => vis[base + j] >= VIS_MIN;
    const eff = table.effort;
    const edges: StrobePose['edges'] = [];
    for (const [a, b] of SKELETON_EDGES) {
      if (ok(a) && ok(b)) {
        edges.push({
          x1: xy[(base + a) * 2] + dx,
          y1: xy[(base + a) * 2 + 1] + dy,
          x2: xy[(base + b) * 2] + dx,
          y2: xy[(base + b) * 2 + 1] + dy,
          ea: eff[base + a],
          eb: eff[base + b],
        });
      }
    }
    if (edges.length === 0) continue;

    // Torso axis (the body lean / spin axis): drawn along the actual hip→shoulder line so it
    // sits on the body, labeled with the camera-robust inclination_deg. Null when the torso
    // joints are unreliable — never a fabricated axis.
    let axis: StrobeEdge | null = null;
    let torsoLen = NaN;
    if (ok(L_SHOULDER) && ok(R_SHOULDER) && ok(L_HIP) && ok(R_HIP)) {
      const shMidX = (xy[(base + L_SHOULDER) * 2] + xy[(base + R_SHOULDER) * 2]) / 2 + dx;
      const shMidY = (xy[(base + L_SHOULDER) * 2 + 1] + xy[(base + R_SHOULDER) * 2 + 1]) / 2 + dy;
      const hipMidX = (xy[(base + L_HIP) * 2] + xy[(base + R_HIP) * 2]) / 2 + dx;
      const hipMidY = (xy[(base + L_HIP) * 2 + 1] + xy[(base + R_HIP) * 2 + 1]) / 2 + dy;
      const cx = (shMidX + hipMidX) / 2;
      const cy = (shMidY + hipMidY) / 2;
      const tdx = shMidX - hipMidX;
      const tdy = shMidY - hipMidY;
      const len = Math.hypot(tdx, tdy) || 1;
      torsoLen = Math.hypot(tdx, tdy);
      const half = Math.max(len * 1.35, 1);
      const ux = tdx / len;
      const uy = tdy / len;
      axis = { x1: cx + ux * half, y1: cy + uy * half, x2: cx - ux * half, y2: cy - uy * half };
    }
    const tiltDeg = table.inclinationDeg[row];
    const comX = table.comXY[row * 2];
    const comY = table.comXY[row * 2 + 1];
    const com = Number.isNaN(comX) || Number.isNaN(comY) ? null : { x: comX + dx, y: comY + dy };

    // Mean per-frame effort (jerk) over the visible joints → the echo's "effort" scalar.
    let effSum = 0;
    let effN = 0;
    for (let j = 0; j < N_JOINTS; j++) {
      const v = eff[base + j];
      if (Number.isFinite(v)) {
        effSum += v;
        effN++;
      }
    }
    const effort = effN > 0 ? effSum / effN : NaN;

    // Key joints in the laid-out frame (root-normalized like the skeleton) for the illustrations.
    const pt = (j: number) =>
      ok(j) ? { x: xy[(base + j) * 2] + dx, y: xy[(base + j) * 2 + 1] + dy } : null;
    const joints = {
      head: pt(NOSE),
      lWrist: pt(L_WRIST),
      rWrist: pt(R_WRIST),
      lAnkle: pt(L_ANKLE),
      rAnkle: pt(R_ANKLE),
      lFoot: pt(L_FOOT),
      rFoot: pt(R_FOOT),
    };
    out.push({ frame, t: u, edges, root: { x: anchorX, y: keepRealY ? root.y : baselineY }, com, axis, tiltDeg, torsoLen, effort, joints });
  }
  return out;
}

/** Which phase of a jump the playhead is in, in source frames (take-off→apex→landing). */
export interface JumpPhase {
  takeoff: number;
  apex: number;
  landing: number;
}

const EMPH_DIM = 0.28; // dimmed poses fall back to this opacity multiplier under a focus

/**
 * How strongly a pose at `frame` should read under a coach `focus`, in [EMPH_DIM, 1] — the
 * mechanism that lets a CoachPanel bullet illustrate itself on the trail (docs/MOTION_TRAIL.md
 * §4). `overview`/`axis` keep every pose (axis adds the torso overlay rather than dimming);
 * the phase focuses need the jump phase and otherwise (spins, no phase) keep every pose.
 */
export function poseEmphasis(
  focus: CoachFocus,
  frame: number,
  phase: JumpPhase | null,
  phase2: JumpPhase | null = null,
): number {
  if (focus === 'overview' || focus === 'axis' || focus === 'effort') return 1;
  if (!phase) return 1;
  // On a combo (`phase2` = the second jump), "in flight" means in EITHER jump's air.
  const inFlight = (p: JumpPhase) => frame >= p.takeoff && frame <= p.landing;
  const airborne =
    (frame > phase.takeoff && frame < phase.landing) ||
    (phase2 != null && frame > phase2.takeoff && frame < phase2.landing);
  switch (focus) {
    case 'height':
      // The flights (contacts + air) carry the drawing; approach/between/run-out recede.
      return inFlight(phase) || (phase2 != null && inFlight(phase2)) ? 1 : EMPH_DIM;
    case 'entry':
      return frame <= phase.takeoff ? 1 : EMPH_DIM;
    case 'edge':
      return frame <= phase.takeoff ? 1 : EMPH_DIM; // the edge lives in the entry → take-off
    case 'takeoff':
      // "Good take-off and landing": every contact bright, the air recedes.
      return airborne ? EMPH_DIM : 1;
    default:
      return 1;
  }
}

/**
 * Which source-frame sub-window a coach `focus` isolates on the trail — the auto-"zoom" that
 * a CoachPanel bullet triggers (the marquee selection done programmatically). `overview`/`effort`
 * keep the FULL trail (null); the jump-phase focuses crop to the part of the arc they illustrate
 * (height/axis/take-off → the air; entry/edge → the entry up to take-off). Null when there is no
 * jump phase (spins/steps) — nothing to crop to.
 */
export function focusWindow(
  focus: CoachFocus,
  phase: JumpPhase | null,
  win: { startFrame: number; endFrame: number },
  phase2: JumpPhase | null = null,
): { startFrame: number; endFrame: number } | null {
  if (focus === 'overview' || focus === 'effort') return null;
  if (!phase) return null;
  // On a combo the "landing" that closes the illustrated span is the SECOND jump's landing.
  const lastLanding = phase2 ? phase2.landing : phase.landing;
  const flight = Math.max(1, phase.landing - phase.takeoff);
  switch (focus) {
    case 'height':
    case 'axis':
      return { startFrame: phase.takeoff, endFrame: lastLanding };
    case 'takeoff':
      // Take-off & landing: include the approach into the take-off and the run-out after
      // the last landing (± half the first flight), so the contacts read in context.
      return {
        startFrame: Math.max(win.startFrame, phase.takeoff - Math.ceil(flight / 2)),
        endFrame: Math.min(win.endFrame, lastLanding + Math.ceil(flight / 2)),
      };
    case 'entry':
    case 'edge':
      return { startFrame: win.startFrame, endFrame: phase.takeoff };
    default:
      return null;
  }
}

/** The strip anchor for a pose/cutout at normalized strobe time `t` — the same layout
 *  `strobePoses` uses, exposed so the photoreal cutout echoes land exactly where the
 *  skeleton echoes would (root pinned to the baseline). */
export function stripAnchor(t: number, fw: number, fh: number): { x: number; y: number } {
  const x0 = fw * STRIP_X0_FRAC;
  const x1 = fw * STRIP_X1_FRAC;
  return { x: x0 + clamp01(t) * (x1 - x0), y: fh * STRIP_BASELINE_FRAC };
}

/** Where to draw a matted cutout image (viewBox px): its `bbox` translated so the skater's
 *  `hip` lands on `anchor` — the same root-normalization as the skeleton strobe, so a
 *  photoreal echo and a skeleton echo coincide. `bbox`/`hip` are in source px. */
export function cutoutDrawRect(
  anchor: { x: number; y: number },
  hip: { x: number; y: number },
  bbox: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  return { x: bbox.x + (anchor.x - hip.x), y: bbox.y + (anchor.y - hip.y), w: bbox.w, h: bbox.h };
}

export interface FlightArc {
  takeoff: { x: number; y: number };
  apex: { x: number; y: number };
  landing: { x: number; y: number };
  heightCm: number;
  airTimeS: number | null;
  /** The parabola sampled take-off→apex→landing in viewBox px (for a polyline). */
  path: { x: number; y: number }[];
}

/**
 * The flight arc for one jump (HIERARCHY.md L3): a parabola from take-off→apex→landing
 * laid over the strobe strip on the SAME time x-axis (so the peak sits over the apex pose),
 * with its **vertical scale set kinematically** by `jump_height_cm` (= ½·g·t_up², ARTIFACT.md
 * §3) — camera-robust, unlike a raw camera-frame `y`. Frames map to x by the shared strip
 * layout; `heightCm` maps to a rise in px via `pxPerCm`, clamped to `maxRisePx` so a freak
 * value can't overflow the panel. Returns null when the apex/height are undefined (spins,
 * or a jump with no measured apex) — never a flat or fabricated arc.
 *
 * The two halves (take-off→apex, apex→landing) are separate quadratics that share the apex
 * value with zero slope there, so the curve is smooth across a possibly-asymmetric apex
 * (the apex frame is the vertical-velocity zero-crossing, not necessarily the time midpoint).
 */
export function flightArc(
  elementStart: number,
  elementEnd: number,
  takeoffFrame: number,
  apexFrame: number,
  landingFrame: number,
  heightCm: number,
  airTimeS: number | null,
  fw: number,
  fh: number,
  pxPerCm: number,
  maxRisePx: number,
): FlightArc | null {
  if (!Number.isFinite(apexFrame) || !Number.isFinite(heightCm)) return null;
  const lo = Math.min(elementStart, elementEnd);
  const hi = Math.max(elementStart, elementEnd);
  const span = Math.max(1, hi - lo);
  const x0 = fw * STRIP_X0_FRAC;
  const x1 = fw * STRIP_X1_FRAC;
  const baselineY = fh * STRIP_BASELINE_FRAC;
  const xOf = (f: number) => x0 + clamp01((f - lo) / span) * (x1 - x0);
  const rise = Math.min(Math.max(heightCm, 0) * pxPerCm, maxRisePx);

  const toX = xOf(takeoffFrame);
  const apX = xOf(apexFrame);
  const laX = xOf(landingFrame);
  const takeoff = { x: toX, y: baselineY };
  const apex = { x: apX, y: baselineY - rise };
  const landing = { x: laX, y: baselineY };

  const path: { x: number; y: number }[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // take-off→apex: 0 at base, 1 at apex; flat (zero slope) at apex
    path.push({ x: toX + (apX - toX) * t, y: baselineY - rise * (2 * t - t * t) });
  }
  for (let i = 1; i <= N; i++) {
    const s = i / N; // apex→landing: 0 at apex, 1 at base; flat at apex
    path.push({ x: apX + (laX - apX) * s, y: baselineY - rise * (1 - s * s) });
  }
  return { takeoff, apex, landing, heightCm, airTimeS, path };
}

// "Dusk bloom" — ink → violet → hot magenta-rose → pale blush. Perceptually-uniform 8-anchor
// LUT for the live pose's jerk/effort gradient (docs/EFFORT_VISUALIZATION.md §5: dark = low effort,
// bright = high; avoids jet/rainbow). Matches the paper palette's rose/plum family.
const DUSK_BLOOM: readonly [number, number, number][] = [
  [10, 10, 16],
  [28, 24, 40],
  [55, 30, 62],
  [100, 40, 90],
  [150, 50, 110],
  [196, 68, 128],
  [224, 110, 150],
  [250, 215, 225],
];

/** Color a joint by its clip-normalized effort via the dusk-bloom LUT (dark = low, bright =
 *  high). NaN (warm-up / missing) → a dim neutral gray, not a hot color — unknown kinematics must
 *  not read as effort. Effort is within-clip. */
export function effortColor(e: number): string {
  if (Number.isNaN(e)) return 'rgba(130, 130, 140, 0.5)';
  const lut = DUSK_BLOOM;
  const t = e < 0 ? 0 : e > 1 ? 1 : e;
  const segs = lut.length - 1;
  const i = Math.min(Math.floor(t * segs), segs - 1);
  const f = t * segs - i;
  const [r0, g0, b0] = lut[i];
  const [r1, g1, b1] = lut[i + 1];
  const r = Math.round(r0 + (r1 - r0) * f);
  const g = Math.round(g0 + (g1 - g0) * f);
  const b = Math.round(b0 + (b1 - b0) * f);
  return `rgb(${r}, ${g}, ${b})`;
}
