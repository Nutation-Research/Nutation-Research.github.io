/*
 * Ink-wash rendering of the heavy symmetric top and the path its axis traces
 * on the unit sphere. Brand register: black ink on blush paper, sumi-e style
 * (matches nutation-mark.png / spinning_loop.gif). The ribbon deposits more
 * ink where the nib moves slowly, like a real pen.
 */
import * as THREE from 'three';
import { fitHalfHeight } from './viewFit';

export const TRAIL_RADIUS = 1.0; // the Goldstein unit sphere
const TOP_HEIGHT = 0.75; // pivot (tip) at origin, stem tip at 0.75, nib at 1.0
const INK = new THREE.Color('#1c1917');
const PAPER_WASH = new THREE.Color('#f7efec');

const CAMERA_ELEV = 25 * (Math.PI / 180);
const CAMERA_DIST = 5.0;
const CAMERA_HALF_HEIGHT = 1.16;
const TARGET = new THREE.Vector3(0, 0.42, 0);

const NOISE_GLSL = /* glsl */ `
  float nr_hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float nr_noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(nr_hash(i), nr_hash(i + vec3(1, 0, 0)), f.x),
          mix(nr_hash(i + vec3(0, 1, 0)), nr_hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(nr_hash(i + vec3(0, 0, 1)), nr_hash(i + vec3(1, 0, 1)), f.x),
          mix(nr_hash(i + vec3(0, 1, 1)), nr_hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float nr_fbm(vec3 p) { return 0.65 * nr_noise(p) + 0.35 * nr_noise(p * 2.7); }
`;

/* ---------------------------------------------------------------- top mesh */

function topProfile(): THREE.Vector2[] {
  const pts: [number, number][] = [
    [0.0, 0.0], [0.02, 0.018], [0.05, 0.06], [0.11, 0.132], [0.20, 0.228],
    [0.262, 0.318], [0.268, 0.362], [0.232, 0.418], [0.155, 0.452],
    [0.075, 0.478], [0.048, 0.505], [0.042, 0.60], [0.038, 0.672],
    [0.052, 0.706], [0.03, 0.736], [0.0, TOP_HEIGHT],
  ];
  // resample through a spline so the lathe reads as smooth turned wood
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  const smooth = curve.getPoints(72).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));
  smooth[0].set(0, 0);
  smooth[smooth.length - 1].set(0, TOP_HEIGHT);
  return smooth;
}

function makeInkTopMaterial(uOpacity: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity,
      uInk: { value: INK },
      uPaper: { value: PAPER_WASH },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vWorld;
      varying vec3 vObj;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vObj = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uInk;
      uniform vec3 uPaper;
      varying vec3 vN;
      varying vec3 vWorld;
      varying vec3 vObj;
      ${NOISE_GLSL}
      void main() {
        vec3 N = normalize(vN);
        vec3 L = normalize(vec3(-0.4, 0.85, 0.55));
        vec3 V = normalize(cameraPosition - vWorld);
        float lam = dot(N, L) * 0.5 + 0.5;
        // two flat wash tones, soft steps — brush shading
        float light = 0.50 * smoothstep(0.32, 0.52, lam) + 0.20 * smoothstep(0.6, 0.78, lam);
        // pigment pooling at silhouette edges
        float rim = pow(1.0 - abs(dot(N, V)), 2.4) * 0.34;
        // thin painted stripes that spin with the body + crisp belly ring
        float az = atan(vObj.x, vObj.z);
        float sector = smoothstep(0.72, 0.95, sin(az * 3.0)) * 0.15
                     * smoothstep(0.03, 0.12, length(vObj.xz));
        float ring = (smoothstep(0.315, 0.33, vObj.y) - smoothstep(0.352, 0.368, vObj.y)) * 0.34
                   + (smoothstep(0.466, 0.476, vObj.y) - smoothstep(0.49, 0.5, vObj.y)) * 0.22;
        // ink settles toward the tip
        float dip = (1.0 - smoothstep(0.0, 0.34, vObj.y)) * 0.10;
        float grain = nr_fbm(vObj * 14.0 + vec3(3.7)) * 0.10;
        float inkAmt = clamp(0.70 - light + rim * 0.8 + sector + ring + dip - grain, 0.05, 1.0);
        vec3 col = mix(uPaper, uInk, inkAmt);
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
    transparent: true,
    side: THREE.FrontSide,
  });
}

function makeOutlineMaterial(uOpacity: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uOpacity, uInk: { value: INK } },
    vertexShader: /* glsl */ `
      void main() {
        vec3 p = position + normal * 0.008;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uInk;
      void main() { gl_FragColor = vec4(uInk, uOpacity * 0.9); }
    `,
    transparent: true,
    side: THREE.BackSide,
  });
}

/* -------------------------------------------------------------- ink ribbon */

export class InkRibbon {
  readonly mesh: THREE.Mesh;
  readonly uniforms: {
    uHead: { value: number };
    uTail: { value: number };
    uOpacity: { value: number };
    uAspect: { value: number };
    uWidthScale: { value: number };
  };
  private readonly capacity: number;
  private readonly geometry: THREE.BufferGeometry;
  private n = 0;

  constructor(capacity = 4096) {
    this.capacity = capacity;
    const g = new THREE.BufferGeometry();
    const mk = (items: number) => {
      const a = new THREE.BufferAttribute(new Float32Array(capacity * 2 * items), items);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    g.setAttribute('position', mk(3));
    g.setAttribute('aPrev', mk(3));
    g.setAttribute('aNext', mk(3));
    g.setAttribute('aSide', mk(1));
    g.setAttribute('aProgress', mk(1));
    g.setAttribute('aWidth', mk(1));
    const idx = new Uint32Array((capacity - 1) * 6);
    for (let i = 0; i < capacity - 1; i++) {
      const v = 2 * i;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], 6 * i);
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.geometry = g;

    this.uniforms = {
      uHead: { value: 0 },
      uTail: { value: -1 },
      uOpacity: { value: 1 },
      uAspect: { value: 1 },
      uWidthScale: { value: 0.0068 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: /* glsl */ `
        attribute vec3 aPrev;
        attribute vec3 aNext;
        attribute float aSide;
        attribute float aProgress;
        attribute float aWidth;
        uniform float uAspect;
        uniform float uWidthScale;
        varying float vProg;
        varying float vSide;
        varying float vZrel;
        void main() {
          vec4 cp = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 pp = projectionMatrix * modelViewMatrix * vec4(aPrev, 1.0);
          vec4 np = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);
          vec2 dir = np.xy / np.w - pp.xy / pp.w;
          dir.x *= uAspect;
          float len = max(length(dir), 1e-6);
          dir /= len;
          vec2 nrm = vec2(-dir.y, dir.x);
          nrm.x /= uAspect;
          vec2 off = nrm * aWidth * uWidthScale * aSide;
          gl_Position = cp + vec4(off * cp.w, 0.0, 0.0);
          vProg = aProgress;
          vSide = aSide;
          vZrel = (modelViewMatrix * vec4(position, 1.0)).z - modelViewMatrix[3].z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uHead;
        uniform float uTail;
        uniform float uOpacity;
        varying float vProg;
        varying float vSide;
        varying float vZrel;
        float nr_h(float p) { return fract(sin(p * 127.1) * 43758.5453); }
        float nr_n(float x) {
          float i = floor(x), f = fract(x);
          return mix(nr_h(i), nr_h(i + 1.0), f * f * (3.0 - 2.0 * f));
        }
        void main() {
          // epsilon so a completed stroke (uHead ≥ 1) never discards the seam sample
          if (vProg > uHead + 1e-4 || vProg < uTail) discard;
          float t = abs(vSide);
          float edge = smoothstep(1.0, 0.84, t);
          float rim = smoothstep(0.55, 0.9, t) * (1.0 - smoothstep(0.9, 1.0, t));
          float grain = 0.88 + 0.12 * nr_n(vProg * 260.0);
          // while drawing: slightly wetter tip; when complete: full opacity so the
          // rosette seam doesn't show a gap from a faded head
          float headWet = uHead >= 0.999
            ? 1.0
            : mix(0.7, 1.0, 1.0 - smoothstep(uHead - 0.01, uHead, vProg));
          float tailDry = uTail < 0.0 ? 1.0 : smoothstep(uTail, uTail + 0.03, vProg);
          // hidden side of the sphere recedes, like the faint back arcs in fig 5.9;
          // keep the back more present once the stroke is complete so the seam reads
          float depthLo = uHead >= 0.999 ? 0.42 : 0.16;
          float depth = mix(depthLo, 1.0, smoothstep(-0.85, 0.45, vZrel));
          float a = (0.86 + 0.14 * rim) * edge * grain * headWet * tailDry * depth * uOpacity;
          gl_FragColor = vec4(vec3(0.10, 0.09, 0.085), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      // the top's depth buffer was eating the seam of the stroke behind it
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  /**
   * Load a path of unit-sphere directions with per-sample nib speeds.
   * Pass `closed` for a rosette so the last segment joins the first (no seam gap).
   */
  setPath(dirs: Float32Array, speeds: Float32Array, n: number, closed = false): void {
    const m = Math.min(n, this.capacity);
    this.n = m;
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const prev = this.geometry.getAttribute('aPrev') as THREE.BufferAttribute;
    const next = this.geometry.getAttribute('aNext') as THREE.BufferAttribute;
    const side = this.geometry.getAttribute('aSide') as THREE.BufferAttribute;
    const prog = this.geometry.getAttribute('aProgress') as THREE.BufferAttribute;
    const width = this.geometry.getAttribute('aWidth') as THREE.BufferAttribute;

    let vSum = 0;
    for (let i = 0; i < m; i++) vSum += speeds[i];
    const vRef = Math.max(vSum / Math.max(m, 1), 1e-3);

    const at = (i: number, k: 0 | 1 | 2) => {
      let j = i;
      // A closed bake ends with an exact duplicate of sample 0. Skip that
      // duplicate while finding neighbors or the seam gets a pointed wedge.
      if (closed) {
        const period = Math.max(m - 1, 1);
        j = ((i % period) + period) % period;
      }
      else j = Math.min(Math.max(i, 0), m - 1);
      return dirs[3 * j + k];
    };
    for (let i = 0; i < m; i++) {
      const p = i / Math.max(m - 1, 1);
      const w = Math.min(Math.max(Math.pow(vRef / (speeds[i] + 0.03), 0.35), 0.72), 1.28);
      for (const s of [0, 1] as const) {
        const v = 2 * i + s;
        pos.setXYZ(v, at(i, 0) * TRAIL_RADIUS, at(i, 1) * TRAIL_RADIUS, at(i, 2) * TRAIL_RADIUS);
        prev.setXYZ(v, at(i - 1, 0) * TRAIL_RADIUS, at(i - 1, 1) * TRAIL_RADIUS, at(i - 1, 2) * TRAIL_RADIUS);
        next.setXYZ(v, at(i + 1, 0) * TRAIL_RADIUS, at(i + 1, 1) * TRAIL_RADIUS, at(i + 1, 2) * TRAIL_RADIUS);
        side.setX(v, s === 0 ? 1 : -1);
        prog.setX(v, p);
        width.setX(v, w);
      }
    }
    for (const a of [pos, prev, next, side, prog, width]) a.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(m - 1, 0) * 6);
  }

  get sampleCount(): number {
    return this.n;
  }
}

/* ------------------------------------------------------------------ scene */

export interface NutationScene {
  renderer: THREE.WebGLRenderer;
  ribbon: InkRibbon;
  setPose(theta: number, phi: number, psi: number): void;
  setTopOpacity(v: number): void;
  setCanvasOpacity(v: number): void;
  setHeroShift(frac: number): void;
  /** 0 = trace framing (pivot low, cap high); 1 = stamp framing (sphere centered). */
  setFocus(f: number): void;
  sphereCenterPx(): { x: number; y: number };
  sphereRadiusPx(): number;
  topAnchorPx(): { x: number; y: number };
  /** Rasterize this scene's projected path plus sphere/arrows into the brand mark. */
  makeMarkDataUrl(dirs: Float32Array, speeds: Float32Array, n: number, bold?: boolean): string;
  pointerToSphere(clientX: number, clientY: number): { theta: number; phi: number; onSphere: boolean };
  resize(): void;
  render(): void;
}

export function createScene(canvas: HTMLCanvasElement): NutationScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -CAMERA_HALF_HEIGHT,
    CAMERA_HALF_HEIGHT,
    CAMERA_HALF_HEIGHT,
    -CAMERA_HALF_HEIGHT,
    0.1,
    50,
  );
  function setFocus(f: number): void {
    const ty = TARGET.y - 0.3 * f;
    camera.position.set(0, ty + CAMERA_DIST * Math.sin(CAMERA_ELEV), CAMERA_DIST * Math.cos(CAMERA_ELEV));
    camera.lookAt(0, ty, 0);
    camera.updateMatrixWorld(true);
  }
  setFocus(0);

  const uTopOpacity = { value: 0 };

  // top body + outline
  const yaw = new THREE.Group();
  const tilt = new THREE.Group();
  const spinner = new THREE.Group();
  yaw.add(tilt);
  tilt.add(spinner);
  scene.add(yaw);

  const lathe = new THREE.LatheGeometry(topProfile(), 96);
  const topMat = makeInkTopMaterial(uTopOpacity);
  const topMesh = new THREE.Mesh(lathe, topMat);
  topMesh.renderOrder = 3;
  const outline = new THREE.Mesh(lathe, makeOutlineMaterial(uTopOpacity));
  outline.renderOrder = 2;
  spinner.add(outline, topMesh);

  // figure axis extended to the unit sphere + nib
  const axisGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, TOP_HEIGHT, 0),
    new THREE.Vector3(0, TRAIL_RADIUS, 0),
  ]);
  const axisMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 });
  const axisLine = new THREE.Line(axisGeom, axisMat);
  axisLine.renderOrder = 4;
  tilt.add(axisLine);

  const nibCanvas = document.createElement('canvas');
  nibCanvas.width = nibCanvas.height = 64;
  const nctx = nibCanvas.getContext('2d')!;
  const grad = nctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(28,25,23,0.95)');
  grad.addColorStop(0.45, 'rgba(28,25,23,0.5)');
  grad.addColorStop(1, 'rgba(28,25,23,0)');
  nctx.fillStyle = grad;
  nctx.fillRect(0, 0, 64, 64);
  const nibMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(nibCanvas),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const nib = new THREE.Sprite(nibMat);
  nib.scale.setScalar(0.05);
  nib.position.set(0, TRAIL_RADIUS, 0);
  nib.renderOrder = 6;
  tilt.add(nib);

  // ground wash (the top's brushy shadow anchor)
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: uTopOpacity, uInk: { value: INK } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uInk;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        float r = length(vUv);
        float wash = (1.0 - smoothstep(0.1, 1.0, r)) * 0.2;
        wash *= 0.7 + 0.6 * nr_fbm(vec3(vUv * 5.0, 1.3));
        float dot_ = (1.0 - smoothstep(0.0, 0.08, r)) * 0.5;
        gl_FragColor = vec4(uInk, (wash + dot_) * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.001;
  ground.renderOrder = 1;
  scene.add(ground);

  const ribbon = new InkRibbon(4096);
  scene.add(ribbon.mesh);

  let heroShift = 0;
  let width = 1;
  let height = 1;

  function applyView(): void {
    const aspect = width / height;
    // Portrait is narrower than the rosette is wide, so the frustum has to open
    // up there or the mark loses its outer loops off both edges.
    const halfH = fitHalfHeight(aspect, CAMERA_HALF_HEIGHT);
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    if (heroShift !== 0) {
      camera.setViewOffset(width, height, -heroShift * width, 0, width, height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    ribbon.uniforms.uAspect.value = aspect;
  }

  function resize(): void {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    applyView();
  }
  resize();

  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Vector3();
  let poseTheta = 0;
  let posePhi = 0;

  function sphereCenterPx(): { x: number; y: number } {
    tmp.set(0, 0, 0).project(camera);
    return { x: ((tmp.x + 1) / 2) * width, y: ((1 - tmp.y) / 2) * height };
  }

  function sphereRadiusPx(): number {
    const c = sphereCenterPx();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    tmp.copy(right).multiplyScalar(TRAIL_RADIUS).project(camera);
    const x = ((tmp.x + 1) / 2) * width;
    const y = ((1 - tmp.y) / 2) * height;
    return Math.hypot(x - c.x, y - c.y);
  }

  function topAnchorPx(): { x: number; y: number } {
    const sinTheta = Math.sin(poseTheta);
    tmp.set(
      TOP_HEIGHT * sinTheta * Math.sin(posePhi),
      TOP_HEIGHT * Math.cos(poseTheta),
      TOP_HEIGHT * sinTheta * Math.cos(posePhi),
    ).project(camera);
    return { x: ((tmp.x + 1) / 2) * width, y: ((1 - tmp.y) / 2) * height };
  }

  function makeMarkDataUrl(
    dirs: Float32Array,
    speeds: Float32Array,
    n: number,
    bold = false,
  ): string {
    const size = 1200;
    const mark = document.createElement('canvas');
    mark.width = mark.height = size;
    const ctx = mark.getContext('2d')!;
    const center = size / 2;
    const scale = size / 2;
    const c = sphereCenterPx();
    const r = sphereRadiusPx();
    const count = Math.min(n, Math.floor(dirs.length / 3), speeds.length);
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const depths = new Float32Array(count);
    const world = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const cameraSpace = new THREE.Vector3();
    const cameraOrigin = new THREE.Vector3().applyMatrix4(camera.matrixWorldInverse);
    let thetaMin = Infinity;
    let thetaMax = -Infinity;

    for (let i = 0; i < count; i++) {
      world.set(dirs[3 * i], dirs[3 * i + 1], dirs[3 * i + 2]);
      projected.copy(world).project(camera);
      const screenX = ((projected.x + 1) / 2) * width;
      const screenY = ((1 - projected.y) / 2) * height;
      xs[i] = center + ((screenX - c.x) / r) * scale;
      ys[i] = center + ((screenY - c.y) / r) * scale;
      cameraSpace.copy(world).applyMatrix4(camera.matrixWorldInverse);
      depths[i] = cameraSpace.z - cameraOrigin.z;
      const theta = Math.acos(Math.min(Math.max(dirs[3 * i + 1], -1), 1));
      thetaMin = Math.min(thetaMin, theta);
      thetaMax = Math.max(thetaMax, theta);
    }

    const projectToMark = (x: number, y: number, z: number) => {
      projected.set(x, y, z).project(camera);
      const screenX = ((projected.x + 1) / 2) * width;
      const screenY = ((1 - projected.y) / 2) * height;
      return {
        x: center + ((screenX - c.x) / r) * scale,
        y: center + ((screenY - c.y) / r) * scale,
      };
    };
    const weight = bold ? 1.75 : 1;
    const clipRadius = 0.99 * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, clipRadius, 0, 2 * Math.PI);
    ctx.clip();

    // Match the middle regime figure: faint dashed turning circles.
    ctx.strokeStyle = '#1c1917';
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 0.008 * scale * weight;
    ctx.setLineDash([0.045 * scale, 0.04 * scale]);
    for (const theta of [thetaMin, thetaMax]) {
      ctx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const phi = (i / 160) * 2 * Math.PI;
        const sinTheta = Math.sin(theta);
        const p = projectToMark(
          sinTheta * Math.sin(phi),
          Math.cos(theta),
          sinTheta * Math.cos(phi),
        );
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Same binary front/back treatment as the figure.
    ctx.strokeStyle = '#1c1917';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const front of [false, true]) {
      ctx.globalAlpha = front ? 1 : 0.16;
      ctx.lineWidth = (front ? 0.017 : 0.007) * scale * weight;
      ctx.beginPath();
      let penDown = false;
      for (let i = 0; i < count; i++) {
        if ((depths[i] > 0) === front) {
          if (penDown) ctx.lineTo(xs[i], ys[i]);
          else ctx.moveTo(xs[i], ys[i]);
          penDown = true;
        } else {
          penDown = false;
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    // Draw the silhouette last so every meeting at the edge is clean.
    ctx.globalAlpha = 0.96;
    ctx.lineWidth = 0.016 * scale * weight;
    ctx.beginPath();
    ctx.arc(center, center, clipRadius, 0, 2 * Math.PI);
    ctx.stroke();

    const drawArrow = (x0: number, y0: number, x1: number, y1: number) => {
      const x0p = center + x0 * scale;
      const y0p = center + y0 * scale;
      const x1p = center + x1 * scale;
      const y1p = center + y1 * scale;
      const angle = Math.atan2(y1p - y0p, x1p - x0p);
      const headLen = 0.078 * scale * weight;
      const headHalf = 0.048 * scale * weight;
      const shaftW = 0.016 * scale * weight;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const bx = x1p - headLen * cos;
      const by = y1p - headLen * sin;
      const nx = -sin;
      const ny = cos;

      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.strokeStyle = '#1c1917';
      ctx.fillStyle = '#1c1917';
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.lineWidth = shaftW;

      ctx.beginPath();
      ctx.moveTo(x0p, y0p);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1p, y1p);
      ctx.lineTo(bx + nx * headHalf, by + ny * headHalf);
      ctx.lineTo(bx - nx * headHalf, by - ny * headHalf);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    drawArrow(0.15, -0.82, -0.15, -0.82);
    drawArrow(-0.48, 0.24, -0.22, 0.24);
    drawArrow(0.04, 0.24, 0.3, 0.24);

    return mark.toDataURL('image/png');
  }

  return {
    renderer,
    ribbon,
    setPose(theta, phi, psi) {
      poseTheta = theta;
      posePhi = phi;
      yaw.rotation.y = phi;
      tilt.rotation.x = theta;
      spinner.rotation.y = psi;
    },
    setTopOpacity(v) {
      uTopOpacity.value = v;
      axisMat.opacity = v * 0.45;
      nibMat.opacity = v * 0.9;
      // let the traced path show through the ghost as the top fades
      topMat.depthWrite = v > 0.55;
    },
    setCanvasOpacity(v) {
      canvas.style.opacity = String(v);
    },
    setHeroShift(frac) {
      heroShift = frac;
      applyView();
    },
    setFocus,
    sphereCenterPx,
    sphereRadiusPx,
    topAnchorPx,
    makeMarkDataUrl,
    pointerToSphere(clientX, clientY) {
      const ndc = new THREE.Vector2(
        (clientX / width) * 2 - 1,
        -(clientY / height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin;
      const d = raycaster.ray.direction;
      const b = o.dot(d);
      const c = o.dot(o) - TRAIL_RADIUS * TRAIL_RADIUS;
      const disc = b * b - c;
      let p: THREE.Vector3;
      let onSphere = false;
      if (disc >= 0) {
        p = tmp.copy(d).multiplyScalar(-b - Math.sqrt(disc)).add(o);
        onSphere = true;
      } else {
        p = tmp.copy(d).multiplyScalar(-b).add(o).normalize().multiplyScalar(TRAIL_RADIUS);
      }
      const theta = Math.acos(Math.min(Math.max(p.y / TRAIL_RADIUS, -1), 1));
      const phi = Math.atan2(p.x, p.z);
      return { theta, phi, onSphere };
    },
    resize,
    render() {
      renderer.render(scene, camera);
    },
  };
}
