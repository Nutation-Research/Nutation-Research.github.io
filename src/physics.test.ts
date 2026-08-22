import { describe, expect, it } from 'vitest';
import {
  DEG,
  LOGO_TARGETS,
  TOP_PARAMS,
  axisDir,
  bake,
  classify,
  bakeClosedRosette,
  energyAlpha,
  fOfU,
  nutationPeriod,
  phiDot,
  release,
  rk4Step,
  solveLogoMotion,
  type State,
} from './physics';

const OMEGA3 = 5.3; // a = I3ω3/I1 ≈ 3.18, comfortably a "fast top" for β = 2

describe('conservation', () => {
  it('holds E\u2032 (α) to 1e-8 over 40 sim-seconds', () => {
    const { motion, state } = release(TOP_PARAMS, 40 * DEG, 0, -0.5, OMEGA3);
    let st: State = state;
    const a0 = energyAlpha(motion, st);
    let worst = 0;
    const dt = 2e-3;
    for (let i = 0; i < 40 / dt; i++) {
      st = rk4Step(motion, st, dt);
      worst = Math.max(worst, Math.abs(energyAlpha(motion, st) - a0));
    }
    expect(worst / Math.abs(a0)).toBeLessThan(1e-8);
  });
});

describe('release from rest — cuspidal motion (Goldstein fig. 5.9c)', () => {
  const theta0 = 40 * DEG;
  const { motion, state } = release(TOP_PARAMS, theta0, 0, 0, OMEGA3);

  it('turning angle matches the analytic root of f(u)', () => {
    // with θ̇0 = φ̇0 = 0: b = a·u0, α = β·u0 → other root solves βu² − a²u + (a²u0 − β) = 0
    const u0 = Math.cos(theta0);
    const { a, beta } = motion;
    const disc = Math.sqrt(a * a * a * a - 4 * beta * (a * a * u0 - beta));
    const u2 = (a * a - disc) / (2 * beta);
    const p = nutationPeriod(motion, state);
    expect(Math.abs(Math.cos(p.thetaOther) - u2)).toBeLessThan(1e-8);
    expect(fOfU(motion, u2)).toBeCloseTo(0, 8);
  });

  it('returns exactly to the release angle with φ̇ = 0 there (cusp), never above', () => {
    let st = state;
    const dt = 2e-3;
    let minTheta = Infinity;
    let maxTheta = -Infinity;
    for (let i = 0; i < 10 / dt; i++) {
      st = rk4Step(motion, st, dt);
      minTheta = Math.min(minTheta, st.theta);
      maxTheta = Math.max(maxTheta, st.theta);
    }
    expect(minTheta).toBeGreaterThan(theta0 - 1e-6); // never rises above release
    expect(Math.abs(phiDot(motion, minTheta))).toBeLessThan(1e-3); // φ̇ → 0 at the cusp
    expect(classify(motion, minTheta, maxTheta)).toBe('cusps');
  });
});

describe('logo motion — retrograde loops (Goldstein fig. 5.9b, the mark)', () => {
  const solved = solveLogoMotion();

  it('tuner hits the band and the loop count exactly', () => {
    const p = nutationPeriod(solved.motion, solved.state);
    expect(Math.abs(p.thetaOther - LOGO_TARGETS.theta2)).toBeLessThan(1e-6);
    expect(Math.abs(p.deltaPhi - (2 * Math.PI) / LOGO_TARGETS.loopsPerRev)).toBeLessThan(1e-9);
  });

  it('is a genuine looping regime: φ̇ reverses inside the band, drifts forward', () => {
    const { motion } = solved;
    const uPrime = motion.b / motion.a;
    expect(uPrime).toBeLessThan(Math.cos(LOGO_TARGETS.theta1) - 1e-4);
    expect(uPrime).toBeGreaterThan(Math.cos(LOGO_TARGETS.theta2) + 1e-4);
    expect(classify(motion, LOGO_TARGETS.theta1, LOGO_TARGETS.theta2)).toBe('loops');
    expect(phiDot(motion, LOGO_TARGETS.theta1)).toBeLessThan(0); // retrograde at the top
    expect(phiDot(motion, LOGO_TARGETS.theta2)).toBeGreaterThan(0); // prograde at the bottom
    const p = nutationPeriod(solved.motion, solved.state);
    expect(p.deltaPhi).toBeGreaterThan(0); // net precession forward
  });

  it('closes after one revolution (10 loops): the rosette is periodic', () => {
    const p = nutationPeriod(solved.motion, solved.state);
    const T = p.T * LOGO_TARGETS.loopsPerRev;
    let st = solved.state;
    const dt = p.T / Math.round(p.T / 2e-3); // integer steps per period
    const steps = Math.round(T / dt);
    for (let i = 0; i < steps; i++) st = rk4Step(solved.motion, st, dt);
    expect(Math.abs(st.theta - solved.state.theta)).toBeLessThan(1e-5);
    expect(Math.abs(st.phi - solved.state.phi - 2 * Math.PI)).toBeLessThan(1e-5);
    const d0 = axisDir(solved.state.theta, solved.state.phi);
    const d1 = axisDir(st.theta, st.phi);
    expect(Math.hypot(d1[0] - d0[0], d1[1] - d0[1], d1[2] - d0[2])).toBeLessThan(1e-5);
  });
});

describe('regimes and robustness', () => {
  it('a gentle forward flick (below steady precession) gives monotone waves', () => {
    // φ̇0 must stay below the slow steady-precession rate β/2a ≈ 0.31, else the
    // axis rises gyroscopically and φ̇ reverses — loops, not waves.
    const { motion, state } = release(TOP_PARAMS, 40 * DEG, 0, 0.15, OMEGA3);
    let st = state;
    const dt = 2e-3;
    let minTheta = Infinity;
    let maxTheta = -Infinity;
    let minPhiDot = Infinity;
    for (let i = 0; i < 15 / dt; i++) {
      st = rk4Step(motion, st, dt);
      minTheta = Math.min(minTheta, st.theta);
      maxTheta = Math.max(maxTheta, st.theta);
      minPhiDot = Math.min(minPhiDot, phiDot(motion, st.theta));
    }
    expect(classify(motion, minTheta, maxTheta)).toBe('waves');
    expect(minPhiDot).toBeGreaterThan(0);
  });

  it('survives the wildest drag-release the UI allows (no NaN, energy holds)', () => {
    const { motion, state } = release(TOP_PARAMS, 75 * DEG, 1.4, 2.2, OMEGA3);
    const baked = bake(motion, state, 30);
    for (let i = 0; i < baked.n; i++) {
      expect(Number.isFinite(baked.theta[i])).toBe(true);
      expect(Number.isFinite(baked.phi[i])).toBe(true);
    }
    const a0 = energyAlpha(motion, state);
    expect(Math.abs(energyAlpha(motion, baked.endState) - a0) / Math.abs(a0)).toBeLessThan(1e-6);
  });
});

describe('closed logo rosette seam', () => {
  it('bakeClosedRosette seals the axis direction with no long chord', () => {
    const logo = solveLogoMotion();
    const closed = bakeClosedRosette(logo.motion, logo.state, 2e-3, 8);
    const a = axisDir(closed.theta[0], closed.phi[0]);
    const b = axisDir(closed.theta[closed.n - 1], closed.phi[closed.n - 1]);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(1e-6);
    const c = axisDir(closed.theta[closed.n - 2], closed.phi[closed.n - 2]);
    expect(Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2])).toBeLessThan(0.03);
    expect(closed.phi[closed.n - 1] - closed.phi[0]).toBeCloseTo(2 * Math.PI, 5);
  });
});
