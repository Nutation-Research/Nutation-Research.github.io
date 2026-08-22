/*
 * Heavy symmetric top with one point fixed — Goldstein, Classical Mechanics, §5.7.
 *
 * Euler angles: θ (polar angle of the figure axis from vertical), φ (precession),
 * ψ (spin about the figure axis). I1 = I2 transverse, I3 axial (about the pivot),
 * Mgl = weight × distance from pivot to center of mass.
 *
 *   L = ½I1(θ̇² + φ̇² sin²θ) + ½I3(ψ̇ + φ̇ cosθ)² − Mgl cosθ
 *
 * φ and ψ are cyclic, giving two exact first integrals (Goldstein 5.53–5.54):
 *
 *   p_ψ = I3(ψ̇ + φ̇ cosθ) = I3·ω3 ≡ I1·a        (spin ω3 is a constant of motion)
 *   p_φ = I1 φ̇ sin²θ + I1 a cosθ ≡ I1·b
 *
 * which reduce the problem to one ODE in θ plus quadratures:
 *
 *   φ̇ = (b − a cosθ) / sin²θ
 *   ψ̇ = I1 a / I3 − φ̇ cosθ
 *   θ̈ = sinθ (φ̇² cosθ − a φ̇ + β/2),   β ≡ 2Mgl/I1
 *
 * Energy less the constant spin term, E' = E − ½I3ω3², is conserved; with
 * α ≡ 2E'/I1 and u = cosθ (Goldstein 5.58–5.60):
 *
 *   u̇² = (1 − u²)(α − βu) − (b − au)² ≡ f(u)
 *
 * The axis nutates between the two roots u2 ≤ u ≤ u1 of the cubic f. The locus on
 * the unit sphere depends on where u' = b/a sits relative to [u2, u1]
 * (Goldstein fig. 5.9): outside → monotone waves; strictly inside → retrograde
 * loops (the Nutation Research mark); on the u1 boundary → cusps, which is
 * exactly release from rest (θ̇0 = φ̇0 = 0). There is no dissipation in this
 * model, so nutation never decays — the amplitude is fixed by the initial
 * conditions forever.
 */

export interface TopParams {
  I1: number;
  I3: number;
  Mgl: number;
}

/** The two first integrals (a, b) plus derived constants. Fixed for a given throw. */
export interface Motion {
  params: TopParams;
  a: number; // I3·ω3 / I1
  b: number; // p_φ / I1
  alpha: number; // 2E'/I1
  beta: number; // 2Mgl/I1
}

export interface State {
  theta: number;
  thetaDot: number;
  phi: number;
  psi: number;
}

export const DEG = Math.PI / 180;

/** Standard toy-top parameters used across the site (units are arbitrary). */
export const TOP_PARAMS: TopParams = { I1: 1, I3: 0.6, Mgl: 1 };

/** Figure axis direction for (θ, φ), y up, φ = 0 facing the camera (+z). */
export function axisDir(theta: number, phi: number): [number, number, number] {
  const s = Math.sin(theta);
  return [s * Math.sin(phi), Math.cos(theta), s * Math.cos(phi)];
}

/** Build the constants of motion from a release state (θ0, θ̇0, φ̇0) and spin ω3. */
export function release(
  params: TopParams,
  theta0: number,
  thetaDot0: number,
  phiDot0: number,
  omega3: number,
  phi0 = 0,
  psi0 = 0,
): { motion: Motion; state: State } {
  const { I1, I3, Mgl } = params;
  const s = Math.sin(theta0);
  const c = Math.cos(theta0);
  const a = (I3 * omega3) / I1;
  const b = phiDot0 * s * s + a * c;
  const beta = (2 * Mgl) / I1;
  const alpha = thetaDot0 * thetaDot0 + phiDot0 * phiDot0 * s * s + beta * c;
  return {
    motion: { params, a, b, alpha, beta },
    state: { theta: theta0, thetaDot: thetaDot0, phi: phi0, psi: psi0 },
  };
}

/** Linear interpolation into a baked trajectory at sim-time t (clamped). */
export function samplePose(b: Baked, tSim: number): { theta: number; phi: number; psi: number } {
  const x = Math.min(Math.max(tSim / b.dtSample, 0), b.n - 1 - 1e-6);
  const i = Math.floor(x);
  const f = x - i;
  const j = Math.min(i + 1, b.n - 1);
  return {
    theta: b.theta[i] + (b.theta[j] - b.theta[i]) * f,
    phi: b.phi[i] + (b.phi[j] - b.phi[i]) * f,
    psi: b.psi[i] + (b.psi[j] - b.psi[i]) * f,
  };
}

export function phiDot(m: Motion, theta: number): number {
  const s = Math.sin(theta);
  const s2 = Math.max(s * s, 1e-9); // guard: only reachable for near-pole throws
  return (m.b - m.a * Math.cos(theta)) / s2;
}

export function psiDot(m: Motion, theta: number): number {
  return (m.params.I1 * m.a) / m.params.I3 - phiDot(m, theta) * Math.cos(theta);
}

function thetaDdot(m: Motion, theta: number): number {
  const pd = phiDot(m, theta);
  return Math.sin(theta) * (pd * pd * Math.cos(theta) - m.a * pd + m.beta / 2);
}

/** f(u) = u̇² — the cubic whose roots bound the nutation band. */
export function fOfU(m: Motion, u: number): number {
  const bau = m.b - m.a * u;
  return (1 - u * u) * (m.alpha - m.beta * u) - bau * bau;
}

/** Recompute α from a state — conserved, so this is the integrator's error meter. */
export function energyAlpha(m: Motion, st: State): number {
  const s = Math.sin(st.theta);
  const pd = phiDot(m, st.theta);
  return st.thetaDot * st.thetaDot + pd * pd * s * s + m.beta * Math.cos(st.theta);
}

/** One classical RK4 step of (θ, θ̇, φ, ψ). φ̇ and ψ̇ depend only on θ. */
export function rk4Step(m: Motion, st: State, dt: number): State {
  const d = (theta: number, thetaDot: number) => ({
    dTheta: thetaDot,
    dThetaDot: thetaDdot(m, theta),
    dPhi: phiDot(m, theta),
    dPsi: psiDot(m, theta),
  });
  const k1 = d(st.theta, st.thetaDot);
  const k2 = d(st.theta + 0.5 * dt * k1.dTheta, st.thetaDot + 0.5 * dt * k1.dThetaDot);
  const k3 = d(st.theta + 0.5 * dt * k2.dTheta, st.thetaDot + 0.5 * dt * k2.dThetaDot);
  const k4 = d(st.theta + dt * k3.dTheta, st.thetaDot + dt * k3.dThetaDot);
  const w = dt / 6;
  return {
    theta: st.theta + w * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta),
    thetaDot: st.thetaDot + w * (k1.dThetaDot + 2 * k2.dThetaDot + 2 * k3.dThetaDot + k4.dThetaDot),
    phi: st.phi + w * (k1.dPhi + 2 * k2.dPhi + 2 * k3.dPhi + k4.dPhi),
    psi: st.psi + w * (k1.dPsi + 2 * k2.dPsi + 2 * k3.dPsi + k4.dPsi),
  };
}

/**
 * Integrate one full nutation period starting from a turning point (θ̇ = 0).
 * Returns the period, the net precession Δφ over it, and the other turning angle.
 */
export function nutationPeriod(
  m: Motion,
  st0: State,
  dt = 2e-3,
): { T: number; deltaPhi: number; thetaOther: number } {
  let st = st0;
  let t = 0;
  let prev = st0;
  let crossings = 0;
  let thetaOther = st0.theta;
  const maxT = 200;
  // nudge off the turning point so the first sign of θ̇ establishes itself
  st = rk4Step(m, st, dt);
  t += dt;
  prev = st;
  while (t < maxT) {
    const next = rk4Step(m, st, dt);
    t += dt;
    if (prev.thetaDot !== 0 && next.thetaDot * st.thetaDot < 0) {
      // refine crossing: linear estimate of the fraction, then a partial RK4 step
      const f = st.thetaDot / (st.thetaDot - next.thetaDot);
      const atCross = rk4Step(m, st, dt * f);
      crossings += 1;
      if (crossings === 1) {
        thetaOther = atCross.theta;
      } else {
        return { T: t - dt + dt * f, deltaPhi: atCross.phi - st0.phi, thetaOther };
      }
    }
    prev = st;
    st = next;
  }
  throw new Error('nutationPeriod: no period found within time budget');
}

export type Regime = 'waves' | 'loops' | 'cusps';

/** Classify the locus per Goldstein fig. 5.9 from where b/a sits in the u-band. */
export function classify(m: Motion, thetaMin: number, thetaMax: number): Regime {
  const u1 = Math.cos(thetaMin); // upper bounding circle (larger u)
  const u2 = Math.cos(thetaMax);
  const uPrime = m.b / m.a;
  const eps = 1e-4 * Math.max(1, Math.abs(u1));
  if (Math.abs(uPrime - u1) < eps || Math.abs(uPrime - u2) < eps) return 'cusps';
  if (uPrime < u1 && uPrime > u2) return 'loops';
  return 'waves';
}

export interface Baked {
  n: number;
  dtSample: number; // sim-time between samples
  theta: Float32Array;
  phi: Float32Array;
  psi: Float32Array;
  speed: Float32Array; // |axis tip velocity| on the unit sphere
  endState: State;
}

/** Integrate and record every `stride` steps. Pure — the renderer consumes this. */
export function bake(
  m: Motion,
  st0: State,
  simDuration: number,
  dt = 2e-3,
  stride = 4,
): Baked {
  const steps = Math.ceil(simDuration / dt);
  const n = Math.floor(steps / stride) + 1;
  const theta = new Float32Array(n);
  const phi = new Float32Array(n);
  const psi = new Float32Array(n);
  const speed = new Float32Array(n);
  let st = st0;
  let k = 0;
  for (let i = 0; i <= steps; i++) {
    if (i % stride === 0 && k < n) {
      theta[k] = st.theta;
      phi[k] = st.phi;
      psi[k] = st.psi;
      const s = Math.sin(st.theta);
      const pd = phiDot(m, st.theta);
      speed[k] = Math.hypot(st.thetaDot, s * pd);
      k += 1;
    }
    st = rk4Step(m, st, dt);
  }
  return { n: k, dtSample: dt * stride, theta, phi, psi, speed, endState: st };
}

/**
 * Integrate until the axis returns to the start after one full precession
 * (Δφ ≥ 2π and nearest the release pose), then append an exact seam sample.
 */
export function bakeClosedRosette(
  m: Motion,
  st0: State,
  dt = 2e-3,
  stride = 8,
): Baked {
  const maxSteps = Math.ceil(80 / dt); // safety: far more than one revolution
  const cap = Math.floor(maxSteps / stride) + 3;
  const theta = new Float32Array(cap);
  const phi = new Float32Array(cap);
  const psi = new Float32Array(cap);
  const speed = new Float32Array(cap);
  let st = st0;
  let k = 0;
  const record = () => {
    theta[k] = st.theta;
    phi[k] = st.phi;
    psi[k] = st.psi;
    const s = Math.sin(st.theta);
    speed[k] = Math.hypot(st.thetaDot, s * phiDot(m, st.theta));
    k += 1;
  };
  record();
  let bestI = -1;
  let bestErr = Infinity;
  for (let i = 1; i <= maxSteps && k < cap - 1; i++) {
    st = rk4Step(m, st, dt);
    if (i % stride !== 0) continue;
    record();
    const idx = k - 1;
    // one full precession of the rosette — wait until we're at least almost around
    if (st.phi - st0.phi < 2 * Math.PI * 0.96) continue;
    const dTh = st.theta - st0.theta;
    const dPh = st.phi - st0.phi - 2 * Math.PI;
    const dTd = st.thetaDot; // release is a turning point (θ̇₀ = 0)
    // heavily weight being back at the upper cusp, not just any point on the Δφ=2π cut
    const err = 4 * dTh * dTh + dPh * dPh + 0.5 * dTd * dTd;
    if (err < bestErr) {
      bestErr = err;
      bestI = idx;
    }
    // stop once we're past 2π and have a tight cusp match, or we've clearly overshot
    if (st.phi - st0.phi > 2 * Math.PI * 1.2 && bestErr < 0.002) break;
    if (st.phi - st0.phi > 2 * Math.PI * 1.6) break;
  }
  if (bestI < 8 || bestErr > 0.05) {
    throw new Error(`bakeClosedRosette: no seam found (bestErr=${bestErr})`);
  }
  const n = bestI + 2;
  const outTh = theta.subarray(0, n);
  const outPh = phi.subarray(0, n);
  const outPs = psi.subarray(0, n);
  const outSp = speed.subarray(0, n);
  // exact seam
  outTh[n - 1] = st0.theta;
  outPh[n - 1] = st0.phi + 2 * Math.PI;
  outPs[n - 1] = st0.psi;
  outSp[n - 1] = outSp[0];
  // copy into fresh buffers (subarray views share the big alloc)
  return {
    n,
    dtSample: dt * stride,
    theta: Float32Array.from(outTh),
    phi: Float32Array.from(outPh),
    psi: Float32Array.from(outPs),
    speed: Float32Array.from(outSp),
    endState: st,
  };
}

export interface LogoTargets {
  theta1: number; // upper bounding circle (release angle, θ̇0 = 0)
  theta2: number; // lower bounding circle
  loopsPerRev: number; // net precession per nutation period = 2π / loopsPerRev
}

/** Band and loop count used by the generated Nutation Research mark. */
export const LOGO_TARGETS: LogoTargets = {
  theta1: 32 * DEG,
  theta2: 65 * DEG,
  loopsPerRev: 10,
};

/**
 * Solve for (ω3, φ̇0) so that a top released on the upper circle θ1 with a
 * retrograde flick φ̇0 < 0 nutates exactly to θ2 and precesses exactly
 * 2π/loopsPerRev per nutation period — i.e. the path closes after one
 * revolution into the looping rosette of the mark. Damped 2-D Newton with a
 * finite-difference Jacobian.
 */
export function solveLogoMotion(
  targets: LogoTargets = LOGO_TARGETS,
  params: TopParams = TOP_PARAMS,
): { motion: Motion; state: State; omega3: number; phiDot0: number } {
  const dPhiTarget = (2 * Math.PI) / targets.loopsPerRev;
  const residual = (omega3: number, phiDot0: number): [number, number] => {
    const { motion, state } = release(params, targets.theta1, 0, phiDot0, omega3);
    const p = nutationPeriod(motion, state);
    return [p.thetaOther - targets.theta2, p.deltaPhi - dPhiTarget];
  };
  // fast-top seeds: Δφ/period ≈ πβ/a² → a ≈ √(loopsPerRev·β/2)
  const beta = (2 * params.Mgl) / params.I1;
  let omega3 = (Math.sqrt((targets.loopsPerRev * beta) / 2) * params.I1) / params.I3;
  let phiDot0 = -0.4;
  let [r1, r2] = residual(omega3, phiDot0);
  for (let iter = 0; iter < 60; iter++) {
    const norm = Math.hypot(r1, r2);
    if (norm < 1e-12) break;
    const h1 = Math.max(1e-6, 1e-7 * Math.abs(omega3));
    const h2 = 1e-6;
    const [r1a, r2a] = residual(omega3 + h1, phiDot0);
    const [r1b, r2b] = residual(omega3, phiDot0 + h2);
    const j11 = (r1a - r1) / h1;
    const j21 = (r2a - r2) / h1;
    const j12 = (r1b - r1) / h2;
    const j22 = (r2b - r2) / h2;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-18) throw new Error('solveLogoMotion: singular Jacobian');
    let dx1 = (-r1 * j22 + r2 * j12) / det;
    let dx2 = (-r2 * j11 + r1 * j21) / det;
    // damped update: halve until the residual actually shrinks
    for (let cut = 0; cut < 12; cut++) {
      const [n1, n2] = residual(omega3 + dx1, phiDot0 + dx2);
      if (Math.hypot(n1, n2) < norm) {
        omega3 += dx1;
        phiDot0 += dx2;
        r1 = n1;
        r2 = n2;
        break;
      }
      dx1 /= 2;
      dx2 /= 2;
      if (cut === 11) throw new Error('solveLogoMotion: line search failed');
    }
  }
  if (Math.hypot(r1, r2) > 1e-9) throw new Error('solveLogoMotion: did not converge');
  const { motion, state } = release(params, targets.theta1, 0, phiDot0, omega3);
  return { motion, state, omega3, phiDot0 };
}
