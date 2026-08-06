/**
 * MotionTrail — the coach "motion trail". Coaching has two stages (coachStore.stage), and the
 * canvas renders one of two ways to match:
 *
 *  - `video` (initial) — no trail: the element plays through ONCE as plain video with the normal
 *    per-frame overlay (skeleton / CoM / axis) drawn by FeatureOverlay, exactly like the main view.
 *    ArtifactStage flips the stage to `trail` when the playthrough reaches the window end.
 *
 *  - `trail` — the video is REMOVED and a chronophotograph is rendered over a static, clean
 *    background plate (the skater inpainted out, producer/producer/cutouts.py): K matted echoes
 *    spaced into even horizontal slots (undoing the camera's horizontal tracking, so they don't
 *    pile up) at their REAL vertical position (the jump arc shows in the bodies — 2D motion, no
 *    depth). Each echo also gets its pose skeleton, centre of mass, and axis of rotation drawn on
 *    it. Self-contained + causally gated: it builds up left→right on an internal clock then holds;
 *    no playback. Echo styles: `photoreal` (matted images) or `skeleton`.
 *
 * The coach view is scoped to an authored window (coachContent.trailStartFrame/EndFrame) so it can
 * focus on the jump itself, not the glide-in. On the trail, drag a marquee to ISOLATE a subset of
 * echoes — they re-spread across the strip (strobePoses lays out by index) and the rest are dropped;
 * click to snap back. `replay video` / `replay motion trail` re-run a stage; `esc · exit` (or the
 * Escape key) leaves coach for the normal video.
 *
 * Drawn imperatively on a Canvas + rAF (FeatureOverlay cadence) — no per-frame React.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { useArtifactStore } from './artifactStore';
import { useVideoStore } from './videoStore';
import { useCoachStore, type CoachFocus } from './coachStore';
import { useLandingTheme } from './landingTheme';
import { coachWindowFor, coachIllustrationFor, coachPhasesFor, coachMetricsFor, coachPhases2For, coachMetrics2For } from './coachContent';
import { strobePoses, focusWindow, containTransform, type JumpPhase } from './overlay';
import type { TrailAnnotation, IllusOpts } from './coachIllustrations';
import { COACH_ACCENT, COACH_POSITIVE, COACH_WARN, COACH_NEUTRAL } from './palette';
import { cutoutUrl, cutoutAssetUrl } from './cutouts';
import type { EventRow } from './decode';
import {
  drawFrozen, stepTrailLayout, type EchoAnim, type LoadedCutout,
  TRAIL_BUILD_MS, TRAIL_GLIDE_TAU, TRAIL_ECHO_SCALE_FALLBACK, TRAIL_TORSO_FRAC, TRAIL_STROBE_K,
} from './motionTrailDraw';

type EchoStyle = 'skeleton' | 'photoreal';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const FOCUS_LABEL: Record<CoachFocus, string> = {
  overview: 'overview',
  height: 'height & length',
  takeoff: 'take-off & landing',
  axis: 'air position · axis',
  edge: 'take-off edge',
  entry: 'entry',
  effort: 'effort integral',
  speed: 'rotation speed',
  position: 'layback position',
  centering: 'centering',
  catchfoot: 'catch-foot finale',
};

/** A labeled on/off pill (pose / com / axis overlays). Rose when on, silver when off. */
function Toggle({ label, on, onClick, cls }: { label: string; on: boolean; onClick: () => void; cls: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      style={on ? { color: COACH_POSITIVE, background: `${COACH_POSITIVE}22` } : { color: COACH_NEUTRAL }}
      title={`Toggle the ${label} overlay`}
    >
      {label} · {on ? 'on' : 'off'}
    </button>
  );
}

export function MotionTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef(0); // performance.now() when the frozen build-up started
  const animRef = useRef<Map<number, EchoAnim>>(new Map()); // per-echo eased anchor X + opacity
  const lastTsRef = useRef(0); // performance.now() of the previous rAF tick (for frame-rate-independent easing)
  // Marquee selection: a drag picks a subset of echoes (by source frame) that are then re-spread
  // across the strip with the others dropped; a click snaps back to the full trail. `selectionRef`
  // mirrors the state so the rAF loop knows whether to reveal everything at once.
  const selectionRef = useRef<number[] | null>(null);
  const [selection, setSelectionState] = useState<number[] | null>(null);
  const setSelection = (s: number[] | null) => {
    selectionRef.current = s;
    setSelectionState(s);
  };
  const dragRef = useRef<{ x0: number; y0: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  /** True while the selection→viewRange glide is running (ignore intermediate viewRange ticks). */
  const glidingViewRangeRef = useRef(false);
  /** True when selection was just synced from viewRange (skip one selection→viewRange pass). */
  const syncingFromViewRangeRef = useRef(false);
  const elementId = useCoachStore((s) => s.elementId);
  const focus = useCoachStore((s) => s.focus);
  const stage = useCoachStore((s) => s.stage);
  const trailNonce = useCoachStore((s) => s.trailNonce);
  const { poseId } = useLandingTheme();
  const elements = useArtifactStore((s) => s.elements);
  const events = useArtifactStore((s) => s.events);
  const table = useArtifactStore((s) => s.table);
  const meta = useArtifactStore((s) => s.meta);
  const viewRange = useArtifactStore((s) => s.viewRange);
  const cutouts = useArtifactStore((s) => s.cutouts);
  const base = useArtifactStore((s) => s.base);
  const [echoStyle, setEchoStyle] = useState<EchoStyle>('photoreal');
  // Independent overlay toggles (drawn ON each echo). Read by the rAF loop via a ref so flipping
  // one doesn't restart the build/glide animation.
  const [showPose, setShowPose] = useState(true);
  const [showCom, setShowCom] = useState(true);
  const [showAxis, setShowAxis] = useState(true);

  // The authored rings/captions only appear after the "AI" analysis finishes AND the user clicks the
  // yellow insight text — `revealRings` gates them.
  const revealRings = useCoachStore((s) => s.revealRings);

  const element = useMemo(
    () =>
      elementId == null || !elements
        ? undefined
        : (elements.rows.find((r) => (r.entity_id as number) === elementId) as EventRow | undefined),
    [elementId, elements],
  );

  // The coach-view window (source frames): the authored trim (e.g. start the trail at the
  // take-off, not the glide-in) or the full element span. Drives the trail AND the playthrough.
  const coachWin = useMemo(() => {
    if (!element) return null;
    return coachWindowFor(meta?.element_id, elementId ?? undefined, element.start_frame as number, element.end_frame as number);
  }, [element, meta, elementId]);

  // Photoreal echoes: ALL the element's matted cutouts inside the coach window. Loaded once
  // (independent of the selection) so re-spreading on select/clear doesn't re-fetch the images;
  // drawFrozen matches each visible echo to its cutout by nearest frame.
  const images = useMemo<LoadedCutout[]>(() => {
    if (!cutouts || !base || elementId == null || !coachWin) return [];
    const cards = cutouts.elements[String(elementId)];
    if (!cards) return [];
    return cards
      .filter((c) => c.frame >= coachWin.startFrame && c.frame <= coachWin.endFrame)
      .map((card) => {
        const img = new Image();
        img.src = cutoutUrl(base, card);
        return { card, img };
      });
  }, [cutouts, base, elementId, coachWin]);
  const hasCutouts = images.length > 0;
  const photoreal = echoStyle === 'photoreal' && hasCutouts;

  // Draw-only options the rAF loop reads each frame (ref, not deps) so toggling never restarts the
  // build/glide animation.
  const drawOptsRef = useRef({ photoreal, showPose, showCom, showAxis });
  drawOptsRef.current = { photoreal, showPose, showCom, showAxis };

  // The full set of strobe sample frames: the cutout frames when present (so each skeleton sits on
  // its matted image 1:1), else K even-in-time samples across the window.
  const fullFrames = useMemo(
    () => (images.length ? images.map((lc) => lc.card.frame).sort((a, b) => a - b) : undefined),
    [images],
  );

  // The stable FULL-trail layout: every echo at its own even slot, real vertical (the jump arc).
  // The marquee re-spread and the reveal are applied as a per-echo animation in the rAF loop
  // (anchor X + opacity), not by recomputing this — so frames glide rather than snap.
  const poses = useMemo(() => {
    if (!element || !table || !meta || !coachWin) return [];
    return strobePoses(table, coachWin.startFrame, coachWin.endFrame, TRAIL_STROBE_K, meta.frame_width, meta.frame_height, true, fullFrames);
  }, [element, table, meta, coachWin, fullFrames]);

  // ONE echo scale for the whole element (constant-depth perspective): normalize the element's
  // MEDIAN torso to a fixed fraction of the frame, then render every echo at that single scale.
  const echoScale = useMemo(() => {
    if (!meta) return TRAIL_ECHO_SCALE_FALLBACK;
    const tls = poses.map((p) => p.torsoLen).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    if (!tls.length) return TRAIL_ECHO_SCALE_FALLBACK;
    const med = tls[tls.length >> 1];
    return Math.min(1.6, Math.max(0.25, (meta.frame_height * TRAIL_TORSO_FRAC) / med));
  }, [poses, meta]);

  // The primary jump's phase, for per-bullet focus emphasis + the illustration geometry.
  // Authored phases (coachContent, pose-derived take-off/apex/landing) are the ground truth;
  // fall back to the L2 event span (loose — its span includes the approach) when unauthored.
  const phase = useMemo<JumpPhase | null>(() => {
    if (!element || String(element.entity_type) !== 'jump') return null;
    const authored = coachPhasesFor(meta?.element_id, elementId ?? undefined);
    if (authored) return authored;
    if (!events) return null;
    const lo = element.start_frame as number;
    const hi = element.end_frame as number;
    for (const ev of events.rows) {
      if (String(ev.entity_type) !== 'jump') continue;
      const s = ev.start_frame as number;
      const e = ev.end_frame as number;
      if (!(s < hi && e > lo)) continue;
      const apex = num(ev.apex_frame);
      if (Number.isFinite(apex)) return { takeoff: s, apex, landing: e };
    }
    return null;
  }, [element, events, meta, elementId]);

  // Illustration metrics, resolved in honesty order: air time from the authored phase frames
  // (frame-count ÷ fps — the most trustworthy number here); height kinematically from that air
  // time (h = ½·g·(T/2)², the L3 formula); curated overrides win; the baked L3 values are the
  // last resort (they are unreliable on this clip — el-0 bakes 3.5 cm).
  const jumpMetrics = useMemo<Omit<IllusOpts, 'strokeW' | 'cw' | 'ch'>>(() => {
    const curated = coachMetricsFor(meta?.element_id, elementId ?? undefined);
    const authored = coachPhasesFor(meta?.element_id, elementId ?? undefined);
    let airTimeS: number | null = null;
    let heightCm: number | null = null;
    if (authored && meta) {
      airTimeS = (authored.landing - authored.takeoff) / meta.fps;
      heightCm = 100 * 0.5 * 9.81 * (airTimeS / 2) ** 2;
    } else if (element && events && String(element.entity_type) === 'jump') {
      const lo = element.start_frame as number;
      const hi = element.end_frame as number;
      for (const ev of events.rows) {
        if (String(ev.entity_type) !== 'jump') continue;
        const s = ev.start_frame as number;
        const e = ev.end_frame as number;
        if (!(s < hi && e > lo)) continue;
        const h = num(ev.jump_height_cm);
        const a = num(ev.jump_air_time_s);
        heightCm = Number.isFinite(h) ? h : null;
        airTimeS = Number.isFinite(a) ? a : null;
        break;
      }
    }
    // The second jump of a combination (authored only): same kinematic derivation, its code
    // taken from the element code's '+' suffix (e.g. '3F!+2T' → '2T').
    const authored2 = coachPhases2For(meta?.element_id, elementId ?? undefined);
    let second: IllusOpts['second'] = null;
    if (authored2 && meta) {
      const curated2 = coachMetrics2For(meta?.element_id, elementId ?? undefined);
      const air2 = curated2.airTimeS ?? (authored2.landing - authored2.takeoff) / meta.fps;
      const codeParts = String(element?.element_code ?? '').split('+');
      second = {
        phase: authored2,
        code: codeParts.length > 1 ? codeParts[1] : null,
        airTimeS: air2,
        heightCm: curated2.heightCm ?? 100 * 0.5 * 9.81 * (air2 / 2) ** 2,
        rotations: curated2.rotations ?? null,
      };
    }
    return {
      phase,
      airTimeS: curated.airTimeS ?? airTimeS,
      heightCm: curated.heightCm ?? heightCm,
      lengthM: curated.lengthM ?? null,
      rotations: curated.rotations ?? null,
      revPerS: curated.revPerS ?? null,
      second,
    };
  }, [element, events, meta, elementId, phase]);

  // Authored illustration for the active focus (zoom range + ringed callouts), if any — overrides
  // the procedural illustration. Annotations are resolved from 1-based echo index → source frame so
  // they stick to their echo through the build/glide.
  const illustration = useMemo(
    () => coachIllustrationFor(meta?.element_id, elementId ?? undefined, focus),
    [meta, elementId, focus],
  );
  const annotations = useMemo<TrailAnnotation[]>(() => {
    if (!illustration?.annotations || !poses.length) return [];
    return illustration.annotations
      .map((a): TrailAnnotation | null => {
        const p = poses[a.echo - 1];
        if (!p) return null;
        return {
          frame: p.frame,
          target: a.target,
          text: a.text,
          tone: a.tone ?? 'warn',
          scale: a.scale,
          below: a.below,
          offsetX: a.offsetX,
          offsetY: a.offsetY,
        };
      })
      .filter((a): a is TrailAnnotation => a != null);
  }, [illustration, poses]);
  // The edge-callout rings only show once the user has revealed them (after the "AI" generates
  // the yellow insight text and they click it) — that reveal beat is specific to the callout flow.
  // Every other focus's authored annotations draw as soon as the bullet is illustrated.
  const annosRef = useRef<TrailAnnotation[]>([]);
  annosRef.current = focus === 'edge' && !revealRings ? [] : annotations;

  // Clean background plate (skater removed) for this element.
  const plate = useMemo<HTMLImageElement | null>(() => {
    const file = cutouts?.plates && elementId != null ? cutouts.plates[String(elementId)] : undefined;
    if (!file || !base) return null;
    const img = new Image();
    img.src = cutoutAssetUrl(base, file);
    return img;
  }, [cutouts, base, elementId]);

  // Rotation readout for a spin element (L3 n_rotations / rev·s⁻¹).
  const spinInfo = useMemo(() => {
    if (!element || !events || String(element.entity_type) !== 'spin') return null;
    const lo = element.start_frame as number;
    const hi = element.end_frame as number;
    let best: { n: number; rev: number } | null = null;
    for (const ev of events.rows) {
      if (String(ev.entity_type) !== 'spin') continue;
      const s = ev.start_frame as number;
      const e = ev.end_frame as number;
      if (!(s < hi && e > lo)) continue;
      const n = num(ev.n_rotations);
      if (!Number.isFinite(n)) continue;
      if (!best || n > best.n) best = { n, rev: num(ev.rotation_speed_rev_s) };
    }
    return best;
  }, [element, events]);

  // The trail stage removes the video (pause it); the video stage plays it through.
  useEffect(() => {
    if (elementId == null) return;
    useVideoStore.getState().setPlaying(stage === 'video');
  }, [stage, elementId]);

  // Imperative rAF redraw. The frozen build replays whenever the trail stage (re)starts —
  // `trailNonce` forces it even when already on the trail.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !element || !table || !meta || !coachWin || poses.length === 0) return;
    const fw = meta.frame_width;
    const fh = meta.frame_height;
    const winStart = coachWin.startFrame;
    const winEnd = coachWin.endFrame;
    clockRef.current = performance.now();
    lastTsRef.current = performance.now();
    animRef.current = new Map(); // fresh build: every echo eases in from scratch
    let raf = 0;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const cw = canvas.clientWidth;
        const cher = canvas.clientHeight;
        if (cw > 0 && cher > 0) {
          const dpr = window.devicePixelRatio || 1;
          const pw = Math.round(cw * dpr);
          const ph = Math.round(cher * dpr);
          if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px; backing store stays native-res
        }
        if (stage === 'video') {
          ctx.clearRect(0, 0, cw, cher); // transparent → video + FeatureOverlay show
        } else {
          const now = performance.now();
          const dt = Math.min(0.05, (now - lastTsRef.current) / 1000); // clamp big gaps (tab blur)
          lastTsRef.current = now;
          const ease = 1 - Math.exp(-dt / TRAIL_GLIDE_TAU); // frame-rate-independent exponential glide
          const prog = clamp01((now - clockRef.current) / TRAIL_BUILD_MS);
          const f = winStart + prog * (winEnd - winStart);
          const focusNow = useCoachStore.getState().focus;

          // Per-echo targets: a selection re-spreads the chosen frames across the strip and fades
          // the rest out; otherwise every echo sits in its full slot and reveals as the build clock
          // passes it. Each echo eases toward its target (anchor X + opacity) → it GLIDES.
          const layout = stepTrailLayout(poses, selectionRef.current, f, ease, fw, fh, animRef.current);

          const o = drawOptsRef.current;
          const cursorFrame = useArtifactStore.getState().cursorFrame;
          drawFrozen(ctx, cw, cher, fw, fh, poses, images, plate, layout, focusNow, o.photoreal, o.showPose, o.showCom, o.showAxis, echoScale, phase, jumpMetrics, cursorFrame, annosRef.current);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [element, poses, images, plate, table, meta, coachWin, stage, trailNonce, phase, echoScale, jumpMetrics, poseId]);

  // Glide the signals panel's viewRange (which the telemetry scopes to) toward the selected frames'
  // range, or back to the full coach window when cleared. Driven by its OWN smooth tween — decoupled
  // from the per-frame echo loop so it reads smoothly rather than tracking the echoes exactly.
  useEffect(() => {
    if (stage !== 'trail' || !coachWin) return;
    if (syncingFromViewRangeRef.current) {
      syncingFromViewRangeRef.current = false;
      return;
    }
    const target = selection && selection.length
      ? { s: Math.min(...selection), e: Math.max(...selection) }
      : { s: coachWin.startFrame, e: coachWin.endFrame };
    const cur = useArtifactStore.getState().viewRange ?? { startFrame: coachWin.startFrame, endFrame: coachWin.endFrame };
    const from = { s: cur.startFrame, e: cur.endFrame };
    if (from.s === target.s && from.e === target.e) return;
    const setVR = useArtifactStore.getState().setViewRange;
    glidingViewRangeRef.current = true;
    const controls = animate(0, 1, {
      duration: TRAIL_GLIDE_TAU * 3, // ~matches the echo glide; eased independently so it stays smooth
      ease: 'easeOut',
      onUpdate: (p) => {
        const s = Math.round(from.s + (target.s - from.s) * p);
        const e = Math.round(from.e + (target.e - from.e) * p);
        const vr = useArtifactStore.getState().viewRange;
        if (!vr || vr.startFrame !== s || vr.endFrame !== e) setVR({ startFrame: s, endFrame: e });
      },
      onComplete: () => { glidingViewRangeRef.current = false; },
    });
    return () => {
      controls.stop();
      glidingViewRangeRef.current = false;
    };
  }, [selection, coachWin, stage]);

  // Telemetry drag-zoom → the same frame window on the motion trail (marquee selection).
  useEffect(() => {
    if (stage !== 'trail' || !coachWin || poses.length === 0) return;
    if (glidingViewRangeRef.current) return;
    const vr = viewRange ?? { startFrame: coachWin.startFrame, endFrame: coachWin.endFrame };
    const isFull = vr.startFrame <= coachWin.startFrame && vr.endFrame >= coachWin.endFrame;
    if (isFull) {
      if (selectionRef.current !== null) {
        syncingFromViewRangeRef.current = true;
        setSelection(null);
      }
      return;
    }
    const picked = poses
      .filter((p) => p.frame >= vr.startFrame && p.frame <= vr.endFrame)
      .map((p) => p.frame);
    if (picked.length === 0) return;
    const selMin = Math.min(...picked);
    const selMax = Math.max(...picked);
    const cur = selectionRef.current;
    if (cur?.length && Math.min(...cur) === selMin && Math.max(...cur) === selMax) return;
    syncingFromViewRangeRef.current = true;
    setSelection(picked);
  }, [viewRange, stage, coachWin, poses]);

  // A new stage / element / trail-replay drops any marquee selection (back to the full trail).
  useEffect(() => {
    selectionRef.current = null;
    setSelectionState(null);
    setMarquee(null);
    dragRef.current = null;
    useArtifactStore.getState().setCursorFrame(null); // drop any stale hover cursor on stage/element change
  }, [stage, elementId, trailNonce]);

  // Per-bullet auto-"zoom": a focus (set by clicking a CoachPanel bullet) isolates its frame window
  // on the trail — exactly the marquee selection, done programmatically (which also glides the
  // signal panel via the selection effect above). `overview`/`effort` (and spins) keep the full
  // trail. Runs on focus change; a manual marquee leaves `focus` untouched so it doesn't fight this.
  useEffect(() => {
    if (stage !== 'trail' || !coachWin) return;
    // During the edge "thinking" phase (before the user clicks the generated yellow text to reveal
    // the conclusion), keep the full coach window visible with all echoes at full brightness.
    // The authored sub-range zoom + rings only apply once revealRings is true.
    if (focus === 'edge' && !revealRings) {
      setSelection(null);
      return;
    }
    // For edge: authored echoRange zoom only kicks in after the user clicks to reveal rings.
    // For any other focus with an authored echoRange, apply the zoom immediately.
    if (illustration?.echoRange && (focus !== 'edge' || revealRings)) {
      const [lo, hi] = illustration.echoRange;
      const picked = poses.slice(lo - 1, hi).map((p) => p.frame);
      setSelection(picked.length ? picked : null);
      return;
    }
    const fw = focusWindow(focus, phase, coachWin, jumpMetrics.second?.phase ?? null);
    if (!fw) {
      setSelection(null);
      return;
    }
    const picked = poses.filter((p) => p.frame >= fw.startFrame && p.frame <= fw.endFrame).map((p) => p.frame);
    setSelection(picked.length ? picked : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, phase, jumpMetrics, coachWin, poses, stage, trailNonce, elementId, illustration, revealRings]);

  if (elementId == null || !meta || !coachWin || poses.length === 0) return null;

  const isTrail = stage === 'trail';

  // Marquee selection. A real drag selects the echoes whose anchor falls in the box's horizontal
  // span (one echo per slot, so the time-range is the meaningful axis); strobePoses then re-spreads
  // just those across the strip and drops the rest. While a selection is active, any click snaps
  // back to the full trail.
  // Selecting echoes also zooms the signals panel below: the rAF loop glides the artifact viewRange
  // (which the telemetry scopes to) toward the selected frames' range, in lock-step with the echoes.
  // So here we only need to set the selection; the loop drives the signal glide.
  const localPt = (e: React.MouseEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.MouseEvent) => {
    if (selectionRef.current) {
      // Snap back to the full, neutral trail: drop the selection AND clear any bullet focus so the
      // illustration goes away too (the auto-select effect then keeps the selection cleared).
      useCoachStore.getState().setFocus('overview');
      setSelection(null);
      return;
    }
    const p = localPt(e);
    dragRef.current = { x0: p.x, y0: p.y };
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  // Inverse of the trail's dashed cursor: map a canvas x back to a source frame by interpolating
  // between the two bracketing echoes' CURRENT anchors (the same `vis` set drawFrozen draws the line
  // from), so hovering the trail reports the exact frame even between sparse echoes / when zoomed.
  const frameAtX = (mx: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || !meta) return null;
    const { scale, offsetX } = containTransform(meta.frame_width, meta.frame_height, canvas.clientWidth, canvas.clientHeight);
    const vis = poses
      .map((p) => ({ frame: p.frame, a: animRef.current.get(p.frame) }))
      .filter((e): e is { frame: number; a: EchoAnim } => !!e.a && e.a.alpha > 0.5)
      .map((e) => ({ frame: e.frame, cx: offsetX + e.a.x * scale }))
      .sort((a, b) => a.cx - b.cx);
    if (!vis.length) return null;
    if (mx <= vis[0].cx) return vis[0].frame;
    if (mx >= vis[vis.length - 1].cx) return vis[vis.length - 1].frame;
    let i = 0;
    while (i < vis.length - 1 && vis[i + 1].cx < mx) i++;
    const a = vis[i];
    const b = vis[i + 1];
    const u = b.cx === a.cx ? 0 : (mx - a.cx) / (b.cx - a.cx);
    return Math.round(a.frame + (b.frame - a.frame) * u);
  };
  const hoverCursor = (mx: number) => {
    const fr = frameAtX(mx);
    if (fr != null && useArtifactStore.getState().cursorFrame !== fr) useArtifactStore.getState().setCursorFrame(fr);
  };
  const onMove = (e: React.MouseEvent) => {
    const p = localPt(e);
    hoverCursor(p.x); // publish the hovered frame → dashed line in both the trail and the plots
    const d = dragRef.current;
    if (!d) return;
    setMarquee({ x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) });
  };
  const cancelDrag = () => {
    dragRef.current = null;
    setMarquee(null);
    useArtifactStore.getState().setCursorFrame(null); // leaving the trail clears both cursors
  };
  const onUp = (e: React.MouseEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    setMarquee(null);
    if (!d) return;
    const canvas = canvasRef.current;
    if (!canvas || !meta) return;
    const p = localPt(e);
    const wpx = Math.abs(p.x - d.x0);
    const hpx = Math.abs(p.y - d.y0);
    if (wpx < 12 && hpx < 12) return; // a click, not a drag → ignore (selection-mode click handled above)
    const cw = canvas.clientWidth;
    const { scale, offsetX } = containTransform(meta.frame_width, meta.frame_height, cw, canvas.clientHeight);
    const sxMin = (Math.min(d.x0, p.x) - offsetX) / scale;
    const sxMax = (Math.max(d.x0, p.x) - offsetX) / scale;
    const picked = poses.filter((pp) => pp.root.x >= sxMin && pp.root.x <= sxMax).map((pp) => pp.frame);
    if (picked.length === 0) return; // empty box → keep the full trail
    setSelection(picked);
  };

  const replayVideo = () => {
    setSelection(null);
    useArtifactStore.getState().setViewRange({ startFrame: coachWin.startFrame, endFrame: coachWin.endFrame });
    useCoachStore.getState().setStage('video');
    const v = useVideoStore.getState();
    v.seekToFrame(coachWin.startFrame);
    v.setPlaying(true);
  };
  const replayTrail = () => {
    setSelection(null);
    useCoachStore.getState().replayTrail();
  };
  const exitCoach = () => {
    useArtifactStore.getState().resetViewRange();
    useVideoStore.getState().setPlaying(false);
    useCoachStore.getState().close();
  };

  const badge = 'text-[10px] font-mono bg-[rgba(16,14,18,0.82)] border border-[rgba(212,120,154,0.22)] px-2 py-1 rounded-md backdrop-blur-sm';
  const pill = `${badge} lowercase transition-colors`;
  const pillActive = { color: '#f0e6e2', background: 'rgba(176,74,117,0.22)', borderColor: 'rgba(212,120,154,0.42)' };
  const pillIdle = { color: COACH_ACCENT };
  return (
    <div className={`absolute inset-0 ${isTrail ? 'bg-well' : 'pointer-events-none'}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      {isTrail && (
        <div
          ref={overlayRef}
          className={`absolute inset-0 ${selection ? 'cursor-pointer' : 'cursor-crosshair'}`}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={cancelDrag}
        />
      )}

      {marquee && (
        <div
          className="absolute border-2 pointer-events-none rounded-sm"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderColor: `${COACH_ACCENT}99`, background: `${COACH_ACCENT}1f` }}
        />
      )}
      {/* Controls — top right, one quiet cluster. */}
      <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end gap-1.5 max-w-[calc(100%-1.5rem)] pointer-events-auto">
        <button
          type="button"
          onClick={replayVideo}
          className={pill}
          style={!isTrail ? pillActive : pillIdle}
          title="Replay the element as video"
        >
          replay video
        </button>
        <button
          type="button"
          onClick={replayTrail}
          className={pill}
          style={isTrail ? pillActive : pillIdle}
          title="Replay the frozen motion trail"
        >
          motion trail
        </button>
        {isTrail && hasCutouts && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEchoStyle('photoreal')}
              className={pill}
              style={photoreal ? pillActive : pillIdle}
              title="Show the matted skater cutouts"
            >
              photoreal
            </button>
            <button
              type="button"
              onClick={() => setEchoStyle('skeleton')}
              className={pill}
              style={!photoreal ? pillActive : pillIdle}
              title="Show only the pose skeleton"
            >
              skeleton
            </button>
          </div>
        )}
        {isTrail && (
          <div className="flex items-center gap-1">
            <Toggle label="pose" on={showPose} onClick={() => setShowPose((v) => !v)} cls={pill} />
            <Toggle label="com" on={showCom} onClick={() => setShowCom((v) => !v)} cls={pill} />
            <Toggle label="axis" on={showAxis} onClick={() => setShowAxis((v) => !v)} cls={pill} />
          </div>
        )}
        <button
          type="button"
          onClick={exitCoach}
          className={`${badge} lowercase transition-colors`}
          style={{ color: COACH_WARN }}
          title="Exit coach — back to the normal video (Esc)"
        >
          esc · exit
        </button>
      </div>

      {/* Status — bottom left, passive caption (mode · focus · measured spin · echoes · hint). */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-1.5rem)] pointer-events-none">
        <span className={`${badge} font-semibold uppercase tracking-[0.08em]`} style={{ color: COACH_ACCENT }}>
          {isTrail ? 'Motion trail' : 'Playback'}
        </span>
        {isTrail && focus !== 'overview' && <span className={`${badge} lowercase`} style={{ color: COACH_WARN }}>{FOCUS_LABEL[focus]}</span>}
        {isTrail && spinInfo && (
          <span className={badge} style={{ color: COACH_WARN }}>
            {spinInfo.n.toFixed(spinInfo.n % 1 ? 1 : 0)} revs{Number.isFinite(spinInfo.rev) ? ` · ${spinInfo.rev.toFixed(1)} rev/s` : ''}
          </span>
        )}
        {isTrail && <span className={badge} style={{ color: COACH_NEUTRAL }}>{poses.length} echoes</span>}
        {isTrail && (
          selection ? (
            <button
              type="button"
              onClick={() => setSelection(null)}
              className={`${badge} lowercase transition-colors pointer-events-auto`}
              style={{ color: COACH_WARN }}
              title="Snap back to the full motion trail"
            >
              selection · reset
            </button>
          ) : (
            <span className={badge} style={{ color: COACH_NEUTRAL }}>drag to isolate frames</span>
          )
        )}
      </div>
    </div>
  );
}
