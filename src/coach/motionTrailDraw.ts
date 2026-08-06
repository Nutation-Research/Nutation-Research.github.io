/**
 * Shared motion-trail rendering: the frozen chronophotograph draw + its per-echo layout
 * stepping. Single source of truth for BOTH the coach motion trail (MotionTrail.tsx) and the
 * entrance splash trail (EntranceTrail.tsx) — extracted so the two can never visually drift:
 * same skeleton strokes, same illustration/annotation drawing, same easing.
 */
import {
  containTransform, cutoutDrawRect, poseEmphasis, stripAnchor,
  type StrobePose, type JumpPhase,
} from './overlay';
import { drawIllustration, drawAnnotations, type EchoScreen, type TrailAnnotation, type IllusOpts } from './coachIllustrations';
import { strokeSkeleton, strokeAxis, drawComMarker } from './poseRender';
import type { CutoutCard } from './cutouts';
import type { CoachFocus } from './coachStore';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface LoadedCutout {
  card: CutoutCard;
  img: HTMLImageElement;
}

/** An echo's animated state: its current anchor X (source px) and overall opacity. Each echo
 *  glides between its full-trail slot and its re-spread (selection) slot, and fades on reveal /
 *  drop — all eased per frame by the caller, so the trail animates smoothly. */
export interface EchoAnim {
  x: number;
  alpha: number;
}

export const TRAIL_BUILD_MS = 2800; // the frozen trail builds itself up over this long, then holds
export const TRAIL_GLIDE_TAU = 0.16 / 0.9; // easing time-constant (s) for the glide — 0.9x speed
export const TRAIL_ECHO_SCALE_FALLBACK = 0.85;
export const TRAIL_TORSO_FRAC = 0.13;
export const TRAIL_STROBE_K = 22;

export const ENTRANCE_ICE_MS = 1400;

/**
 * Per-echo animation step: eases every pose's anchor X + opacity toward its target for this
 * frame (frame-rate-independent exponential glide). With no selection, an echo reveals once the
 * build clock (`revealFrame`) passes its source frame; with a selection, selected echoes
 * re-spread evenly across the strip and everything else fades to 0. Mutates `animMap` in place
 * (the caller's persistent per-echo state) and returns the resulting layout for this frame.
 */
export function stepTrailLayout(
  poses: StrobePose[],
  selection: number[] | null,
  revealFrame: number,
  ease: number,
  fw: number,
  fh: number,
  animMap: Map<number, EchoAnim>,
): Map<number, EchoAnim> {
  const selSet = selection ? new Set(selection) : null;
  const order = selection ? [...selection].sort((a, b) => a - b) : null;
  const m = order?.length ?? 0;
  const layout = new Map<number, EchoAnim>();
  for (const p of poses) {
    let tx: number;
    let ta: number;
    if (!selSet) {
      tx = p.root.x;
      ta = p.frame <= revealFrame ? 1 : 0;
    } else if (selSet.has(p.frame)) {
      const j = order!.indexOf(p.frame);
      tx = m <= 1 ? fw * 0.5 : stripAnchor(j / (m - 1), fw, fh).x;
      ta = 1;
    } else {
      tx = p.root.x;
      ta = 0;
    }
    const cur = animMap.get(p.frame) ?? { x: p.root.x, alpha: 0 };
    cur.x += (tx - cur.x) * ease;
    cur.alpha += (ta - cur.alpha) * ease;
    animMap.set(p.frame, cur);
    layout.set(p.frame, cur);
  }
  return layout;
}

/** The frozen chronophotograph: clean plate backdrop (or transparent) + echoes drawn at their
 *  CURRENT animated anchor/opacity (`layout`, keyed by source frame), each carrying its skeleton
 *  / CoM / axis. Geometry is the stable full-trail layout; per-echo motion is a pure horizontal
 *  shift of the anchor (Y is the real jump arc), so the same pose can render in any slot.
 *  `transparentBg=true` skips the plate/black backdrop fill (entrance draws its own ice layer
 *  underneath on a separate canvas). */
export function drawFrozen(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  fw: number,
  fh: number,
  poses: StrobePose[],
  images: LoadedCutout[],
  plate: HTMLImageElement | null,
  layout: Map<number, EchoAnim>,
  focus: CoachFocus,
  photoreal: boolean,
  showPose: boolean,
  showCom: boolean,
  showAxis: boolean,
  echoScale: number,
  phase: JumpPhase | null,
  illus: Omit<IllusOpts, 'strokeW' | 'cw' | 'ch'>,
  cursorFrame: number | null,
  annotations: TrailAnnotation[],
  transparentBg = false,
  /** Entrance-only: per-echo axis rotation offset (radians) added on top of the true axis line,
   *  keyed by source frame. Absent/null for the coach trail — axis draws at its true angle. */
  axisRotOverride?: Map<number, number> | null,
  /** Entrance-only: per-echo axis/CoM reveal alpha (0..1), keyed by source frame — lets the axis
   *  and CoM sweep in on their OWN left-to-right timing, staged after the pose. Absent/null for
   *  the coach trail — axis/CoM reveal follows the pose's own alpha (`aMul`), as before. */
  axisAlphaOverride?: Map<number, number> | null,
  comAlphaOverride?: Map<number, number> | null,
  /** Landing theme experiments: override skeleton effort→color. Coach path leaves this unset. */
  poseColorFn?: ((e: number) => string) | null,
) {
  const { scale, offsetX, offsetY } = containTransform(fw, fh, cw, ch);
  const my = (y: number) => offsetY + y * scale;
  const strokeW = Math.max(1.5, (fw / 360) * scale);
  // The illustration (per-bullet focus) is drawn ON the bodies, so collect each visible echo's
  // joints projected to the SAME screen px as the echo itself.
  const echoScreens: EchoScreen[] = [];
  const effortFocus = focus === 'effort';
  // ONE scale for every echo (line-of-sight ⟂ motion → constant depth → constant size). The
  // caller derives it from the element's median torso; per-frame foreshortening is left as the
  // real projection, never re-scaled per echo.
  const sa = (v: number, anchor: number) => anchor + (v - anchor) * echoScale;

  // Backdrop: wine letterbox bars (--color-well) + clean plate in the video rect only.
  // Skipped entirely when `transparentBg` (the entrance splash draws its own ice layer beneath).
  ctx.clearRect(0, 0, cw, ch);
  if (!transparentBg) {
    const vidX = offsetX;
    const vidY = offsetY;
    const vidW = fw * scale;
    const vidH = fh * scale;

    // Follow --color-well (theme toggle) so letterbox matches the CSS viewport.
    const well =
      getComputedStyle(document.documentElement).getPropertyValue('--color-well').trim() ||
      '#452130';
    ctx.fillStyle = well;
    ctx.fillRect(0, 0, cw, ch);
    if (plate && plate.complete && plate.naturalWidth) {
      ctx.drawImage(plate, vidX, vidY, vidW, vidH);
    } else {
      ctx.fillStyle = '#101013';
      ctx.fillRect(vidX, vidY, vidW, vidH);
    }
  }

  // Match a cutout to an echo by its NEAREST source frame. With a trimmed coach window the strobe
  // is sampled at the cutout frames themselves (exact match), and it stays robust if a pose was
  // skipped or the window doesn't line up 1:1.
  const nearestCard = (frame: number): LoadedCutout | null => {
    let best: LoadedCutout | null = null;
    let bestD = Infinity;
    for (const lc of images) {
      const d = Math.abs(lc.card.frame - frame);
      if (d < bestD) {
        bestD = d;
        best = lc;
      }
    }
    return best;
  };

  for (const p of poses) {
    const la = layout.get(p.frame);
    if (!la || la.alpha <= 0.01) continue; // not yet revealed / dropped out
    const emph = focus === 'edge' ? 1 : poseEmphasis(focus, p.frame, phase, illus.second?.phase ?? null);
    const aMul = la.alpha;
    const shift = la.x - p.root.x; // horizontal glide from the full slot to the current slot
    // x maps include the animated horizontal shift (in source px → canvas px); y is untouched.
    const mx = (v: number) => offsetX + (sa(v, p.root.x) + shift) * scale;
    const syA = (v: number) => my(sa(v, p.root.y)); // y with the shared echo scale around the anchor
    const proj = (q: { x: number; y: number }) => ({ x: mx(q.x), y: syA(q.y) });

    // 1. The matted image (clean cutout), placed root-anchored at the shared echo scale.
    if (photoreal) {
      const lc = nearestCard(p.frame);
      if (lc && lc.img.complete && lc.img.naturalWidth) {
        const rect = cutoutDrawRect(p.root, lc.card.hip, lc.card.bbox);
        // Full brightness on the matted echo; only focus emphasis + reveal/selection (aMul) modulate opacity.
        ctx.globalAlpha = clamp01(emph * aMul);
        ctx.drawImage(lc.img, mx(rect.x), my(sa(rect.y, p.root.y)), rect.w * echoScale * scale, rect.h * echoScale * scale);
        ctx.globalAlpha = 1;
      }
    }

    // 2. Pose skeleton (jerk-colored) + axis + CoM drawn ON the echo — the SAME render path as
    //    the live video overlay (poseRender), faded by age via globalAlpha. Each is independently
    //    toggleable so the photoreal echo can show with any combination of overlays (or none).
    const ageEmph = clamp01((0.4 + 0.6 * p.t) * emph);
    ctx.globalAlpha = clamp01(ageEmph * aMul);
    if (showPose || effortFocus) {
      strokeSkeleton(
        ctx,
        p.edges.map((e) => ({
          x1: mx(e.x1), y1: my(sa(e.y1, p.root.y)),
          x2: mx(e.x2), y2: my(sa(e.y2, p.root.y)),
          ea: e.ea, eb: e.eb,
        })),
        strokeW,
        poseColorFn ?? undefined,
      );
    }
    if (showAxis && p.axis) {
      const axisA = axisAlphaOverride?.get(p.frame);
      ctx.globalAlpha = clamp01(ageEmph * (axisA ?? aMul));
      const ax1 = mx(p.axis.x1);
      const ay1 = my(sa(p.axis.y1, p.root.y));
      const ax2 = mx(p.axis.x2);
      const ay2 = my(sa(p.axis.y2, p.root.y));
      const rot = axisRotOverride?.get(p.frame);
      if (rot) {
        const cx = (ax1 + ax2) / 2;
        const cy = (ay1 + ay2) / 2;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const rotate = (x: number, y: number) => ({
          x: cx + (x - cx) * cos - (y - cy) * sin,
          y: cy + (x - cx) * sin + (y - cy) * cos,
        });
        const r1 = rotate(ax1, ay1);
        const r2 = rotate(ax2, ay2);
        strokeAxis(ctx, r1.x, r1.y, r2.x, r2.y, strokeW);
      } else {
        strokeAxis(ctx, ax1, ay1, ax2, ay2, strokeW);
      }
    }
    if (showCom && p.com) {
      const comA = comAlphaOverride?.get(p.frame);
      ctx.globalAlpha = clamp01(ageEmph * (comA ?? aMul));
      drawComMarker(ctx, mx(p.com.x), my(sa(p.com.y, p.root.y)), strokeW * 1.8, strokeW);
    }
    ctx.globalAlpha = 1;

    // Record this echo (screen px) for the illustration pass below.
    if (focus !== 'overview') {
      const j = p.joints;
      const feet = [j.lAnkle, j.rAnkle, j.lFoot, j.rFoot].filter((q): q is { x: number; y: number } => q != null).map(proj);
      let lowFoot: { x: number; y: number } | null = null;
      for (const ft of feet) if (!lowFoot || ft.y > lowFoot.y) lowFoot = ft;
      const rightSrc = j.rFoot ?? j.rAnkle;
      const leftSrc = j.lFoot ?? j.lAnkle;
      echoScreens.push({
        frame: p.frame,
        x: offsetX + la.x * scale,
        alpha: aMul,
        hip: { x: offsetX + la.x * scale, y: my(p.root.y) },
        com: p.com ? proj(p.com) : null,
        head: j.head ? proj(j.head) : null,
        feet,
        lowFoot,
        rightFoot: rightSrc ? proj(rightSrc) : null,
        leftFoot: leftSrc ? proj(leftSrc) : null,
        rightWrist: j.rWrist ? proj(j.rWrist) : null,
        leftWrist: j.lWrist ? proj(j.lWrist) : null,
        axis: p.axis ? { x1: mx(p.axis.x1), y1: syA(p.axis.y1), x2: mx(p.axis.x2), y2: syA(p.axis.y2) } : null,
        tiltDeg: p.tiltDeg,
        effort: p.effort,
      });
    }
  }

  // The per-bullet illustration, drawn over the echoes at the group's reveal opacity so it fades
  // in with them. Authored, frame-specific callouts (coachContent.illustrations) take precedence
  // over the generic procedural illustration; overview draws nothing.
  if (focus !== 'overview' && echoScreens.length >= 1) {
    const groupAlpha = echoScreens.reduce((a, s) => a + s.alpha, 0) / echoScreens.length;
    ctx.save();
    ctx.globalAlpha = clamp01(groupAlpha);
    if (echoScreens.length >= 2 && focus !== 'edge') {
      drawIllustration(ctx, focus, echoScreens, { ...illus, strokeW, cw, ch });
    }
    // Authored rings draw ON TOP of the procedural illustration (for edge they replace it —
    // the procedural drawing is skipped above and the rings carry the story).
    if (annotations.length) {
      drawAnnotations(ctx, annotations, echoScreens, strokeW, cw, ch);
    }
    ctx.restore();
  }

  // The telemetry's hover cursor, mirrored onto the trail: a dashed full-height line (top→bottom of
  // the plate) at the hovered source frame. Echoes are sparse, so the x is LINEARLY INTERPOLATED
  // between the two bracketing echoes' CURRENT anchors — which also makes it track the glide and the
  // re-spread when zoomed into a selection. Drawn last so it sits over everything.
  if (cursorFrame != null) {
    const vis = poses
      .map((p) => ({ frame: p.frame, a: layout.get(p.frame) }))
      .filter((e): e is { frame: number; a: EchoAnim } => !!e.a && e.a.alpha > 0.5)
      .map((e) => ({ frame: e.frame, cx: offsetX + e.a.x * scale }))
      .sort((a, b) => a.frame - b.frame);
    if (vis.length) {
      let cx: number;
      if (cursorFrame <= vis[0].frame) cx = vis[0].cx;
      else if (cursorFrame >= vis[vis.length - 1].frame) cx = vis[vis.length - 1].cx;
      else {
        let i = 0;
        while (i < vis.length - 1 && vis[i + 1].frame < cursorFrame) i++;
        const a = vis[i];
        const b = vis[i + 1];
        const u = b.frame === a.frame ? 0 : (cursorFrame - a.frame) / (b.frame - a.frame);
        cx = a.cx + (b.cx - a.cx) * u;
      }
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, scale);
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, offsetY);
      ctx.lineTo(cx, offsetY + fh * scale);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}
