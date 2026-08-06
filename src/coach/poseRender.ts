/**
 * Shared canvas drawing for the pose — used by BOTH the live video overlay (FeatureOverlay)
 * and the motion-trail echoes (MotionTrail), so a pose looks identical in both. Pure drawing
 * primitives over canvas-px geometry; the callers own how that geometry is produced (real
 * projection for the live frame, respaced/scaled for a trail echo). Geometry math stays in
 * overlay.ts; this is the one place that decides how a skeleton / axis / CoM is painted.
 */
import { effortColor } from './overlay';
import { COACH_WARN, COACH_NEUTRAL, COACH_TEXT } from './palette';
import { effortColorFromLut, getThemeState, POSE_THEMES } from './landingTheme';

export interface RenderEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ea: number; // effort (jerk) at endpoint A — NaN if unknown
  eb: number; // effort at endpoint B
}

export function activeEffortColor(e: number): string {
  const { poseId } = getThemeState();
  if (poseId === 'dusk') return effortColor(e);
  return effortColorFromLut(e, POSE_THEMES[poseId].lut);
}

/** The skeleton: each limb a gradient between its endpoints' effort (jerk) colors,
 *  so a calm shoulder feeding a whipping wrist reads as a gradient down the arm. Canvas px.
 *  Optional `colorFn` overrides the active theme LUT. */
export function strokeSkeleton(
  ctx: CanvasRenderingContext2D,
  edges: RenderEdge[],
  lineWidth: number,
  colorFn: (e: number) => string = activeEffortColor,
) {
  ctx.lineCap = 'round';
  ctx.lineWidth = lineWidth;
  for (const e of edges) {
    const grad = ctx.createLinearGradient(e.x1, e.y1, e.x2, e.y2);
    grad.addColorStop(0, colorFn(e.ea));
    grad.addColorStop(1, colorFn(e.eb));
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(e.x1, e.y1);
    ctx.lineTo(e.x2, e.y2);
    ctx.stroke();
  }
}

/** The body axis of rotation: a warm gold dashed segment (the trail's one caution hue). Canvas px. */
export function strokeAxis(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineWidth: number) {
  ctx.strokeStyle = `${COACH_WARN}e6`;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash([lineWidth * 4, lineWidth * 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The whole-body centre of mass: a soft lavender-silver halo + ring around a warm cream core
 *  (in the palette's neutral-chrome family, not a stray tech-demo cyan). `ring` is the ring
 *  radius (px); halo/core scale off it to match the live overlay's 7 / 5 / 2.2 proportions. */
export function drawComMarker(ctx: CanvasRenderingContext2D, x: number, y: number, ring: number, lineWidth: number) {
  ctx.beginPath();
  ctx.arc(x, y, ring * 1.4, 0, Math.PI * 2);
  ctx.fillStyle = `${COACH_NEUTRAL}30`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, ring, 0, Math.PI * 2);
  ctx.strokeStyle = `${COACH_NEUTRAL}e6`;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, ring * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = COACH_TEXT;
  ctx.fill();
}
