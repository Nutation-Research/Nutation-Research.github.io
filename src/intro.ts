/*
 * The boot sequence — GameCube register, Goldstein content:
 *   P0 spin-up   : the top fades in spinning nearly upright
 *   P1 flick     : it tips and snaps backward into the exact release velocity
 *   P2 trace     : real integrated motion draws the brand rosette; Lagrangian fades in
 *   P3 ghost     : the top fades, path rises to center; Lagrangian fades out
 *   P4 stamp     : the generated mark (+ wordmark) fades in over the path
 *   P5 dock      : mark + wordmark fly to the header; mark bolds only at landing
 *
 * No kinematic→bake hard cut: after P1 the pose is exactly the release state of
 * the bake, so the fall is continuous Goldstein dynamics.
 */
import type { NutationScene } from './scene';
import { samplePose, type Baked } from './physics';

export interface Rosette {
  baked: Baked;
  T: number; // duration of one closed revolution, sim-seconds
  theta0: number;
  phi0: number;
  phiDot0: number;
  psiDot0: number;
}

// Upright spin hold before the tip/fall (halved from 0.475).
const P0_END = 0.2375;
const P1_END = P0_END + 0.5; // flick duration unchanged
const TRACE_DUR = 5.85;
const P2_END = P1_END + TRACE_DUR;
// Tail pacing (rise, stamp, hold, dock). Kept brisk: this is what a first-time
// visitor actually sits through, so it has to read as a title card, not a film.
const SLOW = 0.85;
const P3_END = P2_END + 0.9 * SLOW; // path hold after the rosette finishes
const P4_END = P3_END + 0.8 * SLOW; // stamp in
const HOLD_END = P4_END + 0.65 * SLOW * 0.9; // stamped logo persists before dock
const P5_END = HOLD_END + 0.9 * SLOW; // dock to header
/** Skip lands here: logo is on screen, then it flies to the header. */
export const DOCK_START = HOLD_END;
/** Intro is done when the mark has finished landing in the header. */
export const INTRO_END = P5_END;
/**
 * Where a first visit starts. Far enough in that the rosette is nearly closed,
 * so the reader still watches the top ink the last of its own path and stamp,
 * without sitting through the spin-up, the fall and five seconds of tracing.
 * "Replay the trace" runs the whole thing from zero.
 */
export const QUICK_START = P2_END - 0.7;

export const HERO_SHIFT = 0.2; // camera view offset fraction in hero layout

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const easeOutQuad = (x: number) => 1 - (1 - x) * (1 - x);
const easeInOutQuad = (x: number) => (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x));
const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
/** Smoothstep with flat ends — value and derivative zero at 0 and 1. */
const smootherstep = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Fraction of the brand rosette already inked at wall-clock time `t`. */
export function rosetteDrawnAt(t: number): number {
  return clamp01((t - P1_END) / TRACE_DUR);
}

interface FxEls {
  fxMark: HTMLImageElement;
  fxMarkBold: HTMLImageElement;
  fxWord: HTMLElement;
  fxEq: HTMLElement;
  headerMark: HTMLImageElement;
  headerWord: HTMLElement;
}

interface DockFrom {
  markX: number;
  markY: number;
  markW: number;
  wordX: number;
  wordY: number;
  wordSize: number;
}

export class Intro {
  done = false;
  private t0 = performance.now();
  private frozen: number | null = null;
  private dockFrom: DockFrom | null = null;
  private readonly traceRate: number;
  private readonly spinRate: number;
  private readonly psiOff: number;

  constructor(
    private readonly scene: NutationScene,
    private readonly rosette: Rosette,
    private readonly els: FxEls,
    private readonly onDocked: (simT: number, psiOff: number) => void,
  ) {
    this.traceRate = rosette.T / TRACE_DUR;
    this.spinRate = rosette.psiDot0 * this.traceRate;
    this.psiOff = this.spinRate * P1_END;
    this.els.headerMark.style.opacity = '0';
  }

  seek(t: number): void {
    this.prepareForTime(t);
    this.frozen = null;
    this.t0 = performance.now() - t * 1000;
  }

  freeze(t: number): void {
    this.prepareForTime(t);
    this.frozen = t;
  }

  /** Wall-clock intro time in seconds (honors freeze). */
  time(now = performance.now()): number {
    return this.frozen ?? Math.max((now - this.t0) / 1000, 0);
  }

  reset(): void {
    this.done = false;
    this.frozen = null;
    this.dockFrom = null;
    this.t0 = performance.now();
    document.body.classList.remove('docked');
    document.body.classList.add('intro-running');
    this.els.fxMark.style.display = '';
    this.els.fxMark.style.opacity = '0';
    this.els.fxMarkBold.style.display = 'none';
    this.els.fxMarkBold.style.opacity = '0';
    this.els.fxWord.style.opacity = '0';
    this.els.fxEq.style.opacity = '0';
    this.els.headerMark.style.opacity = '0';
    this.els.headerWord.style.opacity = '0';
    this.els.headerWord.style.transition = 'none';
    this.scene.setHeroShift(0);
    this.scene.setFocus(0);
    window.scrollTo(0, 0);
  }

  /** Allow seeking backward out of the docked/hero handoff. */
  private prepareForTime(t: number): void {
    if (t < INTRO_END) this.done = false;
    if (t < HOLD_END) {
      this.dockFrom = null;
      document.body.classList.remove('docked');
      document.body.classList.add('intro-running');
      this.els.fxMark.style.display = '';
      this.els.fxMarkBold.style.display = 'none';
      this.els.headerMark.style.opacity = '0';
      this.els.headerWord.style.opacity = '0';
      this.els.headerWord.style.transition = 'none';
    }
  }

  /** sim-time as a closed-form function of wall time. */
  private simTAt(t: number): number {
    if (t <= P1_END) return 0;
    return (Math.min(t, P5_END) - P1_END) * this.traceRate;
  }

  tick(now: number): void {
    const t = this.frozen ?? Math.max((now - this.t0) / 1000, 0);
    const { scene, rosette, els } = this;
    const simT = this.simTAt(t);

    // ---- pose
    if (t < P1_END) {
      // Hold nearly vertical, then tip and flick into the solved release.
      // The cubic azimuth has zero velocity at the start and exactly φ̇₀ at
      // the join; smootherstep gives θ̇=0 there, so the bake continues C¹.
      const theta0 = rosette.theta0;
      const upright = 2.5 * (Math.PI / 180);
      let theta: number;
      let phi: number;
      if (t < P0_END) {
        theta = upright;
        phi = rosette.phi0;
      } else {
        const duration = P1_END - P0_END;
        const p = clamp01((t - P0_END) / duration);
        theta = upright + (theta0 - upright) * smootherstep(p);
        const endSlope = rosette.phiDot0 * this.traceRate * duration;
        phi = rosette.phi0 + endSlope * p * p * (p - 1);
      }
      scene.setPose(theta, phi, this.spinRate * t);
    } else {
      const pose = samplePose(rosette.baked, simT % rosette.T);
      scene.setPose(pose.theta, pose.phi, pose.psi + this.psiOff);
    }

    // ---- fades
    scene.setCanvasOpacity(clamp01(t / (P0_END * 0.7)));
    let topO: number;
    if (t < P0_END * 0.7) topO = easeOutQuad(clamp01(t / (P0_END * 0.7)));
    else if (t < P2_END) topO = 1;
    else if (t < P3_END) topO = 1 - easeInOutQuad(clamp01((t - P2_END) / (P3_END - P2_END)));
    else topO = 0;
    scene.setTopOpacity(topO);

    const rib = scene.ribbon.uniforms;
    // ink starts with the physical release — the fall draws the first loop.
    // overshoot uHead past 1 when done so the seam sample is never discarded
    const traced = rosetteDrawnAt(t);
    rib.uHead.value = traced >= 1 ? 1.05 : traced;
    if (t < P3_END) rib.uOpacity.value = 1;
    else if (t < P4_END) rib.uOpacity.value = 1 - easeInOutQuad(clamp01((t - P3_END) / (P4_END - P3_END)));
    else rib.uOpacity.value = 0;

    // ---- camera: glide the sphere to center for the stamp, back out for the hero
    let focus: number;
    if (t < P2_END) focus = 0;
    else if (t < P3_END) focus = easeInOutQuad(clamp01((t - P2_END) / (P3_END - P2_END)));
    else if (t < HOLD_END) focus = 1;
    else focus = 1 - easeInOutCubic(clamp01((t - HOLD_END) / (P5_END - HOLD_END)));
    scene.setFocus(focus);

    const shift =
      t < HOLD_END ? 0 : HERO_SHIFT * easeInOutCubic(clamp01((t - HOLD_END) / (P5_END - HOLD_END)));
    scene.setHeroShift(shift);

    // ---- the stamp, persist, and dock (bold only in the final header-size landing)
    const c = scene.sphereCenterPx();
    const r = scene.sphereRadiusPx();
    const stampW = 2 * r;
    const markTransform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%)`;
    const wordStart = P3_END + 0.1 * SLOW;
    const wordEnd = P4_END;
    const wordP = clamp01((t - wordStart) / Math.max(wordEnd - wordStart, 1e-6));
    // Keep the real header wordmark hidden until the flying copy lands on it.
    els.headerWord.style.transition = 'none';

    // Lagrangian under the top while the path is drawn; out as the path rises.
    // Hero-layout sphere radius can exceed the viewport, so clamp into view.
    const eqInStart = P1_END + 0.28;
    const eqInDur = 1.1;
    let eqO = 0;
    if (t < eqInStart) eqO = 0;
    else if (t < P2_END) eqO = easeOutQuad(clamp01((t - eqInStart) / eqInDur));
    else if (t < P3_END) eqO = 1 - easeInOutQuad(clamp01((t - P2_END) / (P3_END - P2_END)));
    else eqO = 0;
    const eqH = els.fxEq.offsetHeight || 56;
    const eqY = Math.min(
      c.y + Math.min(r * 0.28, window.innerHeight * 0.1) + 10,
      window.innerHeight - eqH - 28,
    );
    els.fxEq.style.opacity = String(eqO);
    els.fxEq.style.transform = `translate(${c.x}px, ${eqY}px) translate(-50%, 0)`;

    const placeStamp = (markOpacity: number, wordOpacity: number) => {
      els.fxMark.style.opacity = String(markOpacity);
      els.fxMark.style.width = `${stampW}px`;
      els.fxMark.style.transform = markTransform;
      els.fxMarkBold.style.display = 'none';
      els.fxMarkBold.style.opacity = '0';
      els.fxWord.style.opacity = String(wordOpacity);
      els.fxWord.style.fontSize = `${r * 0.13}px`;
      els.fxWord.style.transform = `translate(${c.x}px, ${c.y + r * 0.46}px) translate(-50%, 0)`;
      els.headerMark.style.opacity = '0';
      els.headerWord.style.opacity = '0';
    };

    if (t < P3_END) {
      els.fxMark.style.opacity = '0';
      els.fxMarkBold.style.display = 'none';
      els.fxMarkBold.style.opacity = '0';
      els.fxWord.style.opacity = '0';
      els.headerMark.style.opacity = '0';
      els.headerWord.style.opacity = '0';
    } else if (t < P4_END) {
      this.dockFrom = null;
      const p = clamp01((t - P3_END) / (P4_END - P3_END));
      const w = stampW * (1.045 - 0.045 * easeOutCubic(p));
      els.fxMark.style.opacity = String(easeOutQuad(p));
      els.fxMark.style.width = `${w}px`;
      els.fxMark.style.transform = markTransform;
      els.fxMarkBold.style.display = 'none';
      els.fxMarkBold.style.opacity = '0';
      els.fxWord.style.opacity = String(easeOutQuad(wordP));
      els.fxWord.style.fontSize = `${r * 0.13}px`;
      els.fxWord.style.transform = `translate(${c.x}px, ${c.y + r * 0.46}px) translate(-50%, 0)`;
      els.headerMark.style.opacity = '0';
      els.headerWord.style.opacity = '0';
    } else if (t < HOLD_END) {
      this.dockFrom = null;
      placeStamp(1, 1);
    } else if (t < P5_END) {
      document.body.classList.add('docked');
      document.body.classList.remove('intro-running');
      els.fxMark.style.display = '';
      els.fxMarkBold.style.display = '';
      els.fxWord.style.display = '';
      if (!this.dockFrom) {
        // Stamp layout is shift=0; hero-shift would otherwise drag the word right.
        scene.setHeroShift(0);
        const stampC = scene.sphereCenterPx();
        const stampR = scene.sphereRadiusPx();
        this.dockFrom = {
          markX: stampC.x,
          markY: stampC.y,
          markW: 2 * stampR,
          wordX: stampC.x,
          wordY: stampC.y + stampR * 0.46,
          wordSize: stampR * 0.13,
        };
        scene.setHeroShift(shift);
      }
      const p = easeInOutCubic(clamp01((t - HOLD_END) / (P5_END - HOLD_END)));
      const from = this.dockFrom;
      const hr = els.headerMark.getBoundingClientRect();
      const wr = els.headerWord.getBoundingClientRect();
      const hx = hr.left + hr.width / 2;
      const hy = hr.top + hr.height / 2;
      // Match stamp anchor: top-center of the wordmark (translate(-50%, 0)).
      const wx = wr.left + wr.width / 2;
      const wy = wr.top;
      const headerWordSize = parseFloat(getComputedStyle(els.headerWord).fontSize) || 19;
      const markW = from.markW + (hr.width - from.markW) * p;
      const markX = from.markX + (hx - from.markX) * p;
      const markY = from.markY + (hy - from.markY) * p;
      const markTransformDock = `translate(${markX}px, ${markY}px) translate(-50%, -50%)`;
      // Bold only in the last stretch, once the mark is near header size.
      const boldP = easeInOutQuad(clamp01((p - 0.72) / 0.28));
      els.fxMark.style.width = `${markW}px`;
      els.fxMark.style.transform = markTransformDock;
      els.fxMark.style.opacity = String(1 - boldP);
      els.fxMarkBold.style.width = `${markW}px`;
      els.fxMarkBold.style.transform = markTransformDock;
      els.fxMarkBold.style.opacity = String(boldP);
      els.fxWord.style.opacity = '1';
      els.fxWord.style.fontSize = `${from.wordSize + (headerWordSize - from.wordSize) * p}px`;
      els.fxWord.style.transform = `translate(${from.wordX + (wx - from.wordX) * p}px, ${from.wordY + (wy - from.wordY) * p}px) translate(-50%, 0)`;
      els.headerMark.style.opacity = '0';
      els.headerWord.style.opacity = '0';
    } else {
      document.body.classList.add('docked');
      document.body.classList.remove('intro-running');
      els.fxMark.style.display = 'none';
      els.fxMarkBold.style.display = 'none';
      els.fxMarkBold.style.opacity = '0';
      els.fxWord.style.opacity = '0';
      els.headerMark.style.opacity = '';
      els.headerWord.style.opacity = '';
      els.headerWord.style.transition = '';
    }

    if (t >= INTRO_END && !this.done) {
      this.done = true;
      this.onDocked(simT, this.psiOff);
    }
  }
}
