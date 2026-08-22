/*
 * The three Goldstein fig. 5.9 regimes, each integrated with the real equations
 * and drawn in the same orthographic view as the mark (camera elevation 25°).
 */
import { DEG, TOP_PARAMS, bake, nutationPeriod, release, type Baked } from './physics';

const EPS = 25 * DEG;
const INK = '#1c1917';

function draw(canvas: HTMLCanvasElement, baked: Baked): void {
  const size = 600;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(size / 2.5, size / 2.5);
  ctx.translate(1.25, 1.18);
  ctx.scale(1, -1); // y up
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // sphere silhouette
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, 2 * Math.PI);
  ctx.lineWidth = 0.016;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // bounding circles at the observed band edges
  let thMin = Infinity;
  let thMax = -Infinity;
  for (let i = 0; i < baked.n; i++) {
    thMin = Math.min(thMin, baked.theta[i]);
    thMax = Math.max(thMax, baked.theta[i]);
  }
  ctx.setLineDash([0.045, 0.04]);
  ctx.lineWidth = 0.008;
  ctx.strokeStyle = 'rgba(28,25,23,0.38)';
  for (const th of [thMin, thMax]) {
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const ph = (k / 120) * 2 * Math.PI;
      const x = Math.sin(th) * Math.sin(ph);
      const y = Math.cos(th) * Math.cos(EPS) - Math.sin(th) * Math.sin(EPS) * Math.cos(ph);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // the path: back arcs faint, front arcs bold
  const pt = (i: number) => {
    const th = baked.theta[i];
    const ph = baked.phi[i];
    const X = Math.sin(th) * Math.sin(ph);
    const Y = Math.cos(th);
    const Z = Math.sin(th) * Math.cos(ph);
    return { x: X, y: Y * Math.cos(EPS) - Z * Math.sin(EPS), front: Y * Math.sin(EPS) + Z * Math.cos(EPS) > 0 };
  };
  for (const pass of ['back', 'front'] as const) {
    ctx.lineWidth = pass === 'front' ? 0.017 : 0.007;
    ctx.strokeStyle = pass === 'front' ? INK : 'rgba(28,25,23,0.16)';
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < baked.n; i++) {
      const p = pt(i);
      const want = pass === 'front' ? p.front : !p.front;
      if (want) {
        if (!pen) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        pen = true;
      } else {
        pen = false;
      }
    }
    ctx.stroke();
  }
}

/** Render the three regime canvases. `loops` reuses the exact logo motion. */
export function renderRegimeFigures(
  omega3: number,
  logo: { motion: Parameters<typeof bake>[0]; state: Parameters<typeof bake>[1] },
): void {
  const specs: Array<{ id: string; mk: () => { motion: Parameters<typeof bake>[0]; state: Parameters<typeof bake>[1] } }> = [
    { id: 'fig-waves', mk: () => release(TOP_PARAMS, 45 * DEG, 0, 0.18, omega3) },
    { id: 'fig-loops', mk: () => logo },
    { id: 'fig-cusps', mk: () => release(TOP_PARAMS, 45 * DEG, 0, 0, omega3) },
  ];
  for (const spec of specs) {
    const canvas = document.getElementById(spec.id) as HTMLCanvasElement | null;
    if (!canvas) continue;
    const { motion, state } = spec.mk();
    const period = nutationPeriod(motion, state);
    draw(canvas, bake(motion, state, period.T * 10, 2e-3, 6));
  }
}
