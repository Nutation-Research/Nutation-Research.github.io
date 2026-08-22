import './style.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { axisDir, bakeClosedRosette, psiDot, solveLogoMotion, type Baked } from './physics';
import { createScene, type NutationScene } from './scene';
import { DOCK_START, INTRO_END, Intro, QUICK_START } from './intro';
import { revealSite } from './boot';
import { createStory } from './story';
import { mountDeck } from './deck';
import { mountContact } from './contact';
import { canEmbed, mountEmbed } from './embed';
import { coachEmbedHref } from './sites';
import { markIntroSeen, shouldSkipIntro, shouldSkipTrace } from './introSkip';

declare global {
  interface Window {
    __nutation?: {
      ready: boolean;
      END: number;
      seek(t: number): void;
      freeze(t: number): void;
      readonly docked: boolean;
      error?: string;
      readonly debug?: { uHead: number; uOpacity: number; samples: number; playT: number };
    };
  }
}

// Only for a hung/failed module boot — not the ~10s intro itself.
const failsafe = window.setTimeout(() => {
  if (!window.__nutation?.ready) {
    revealSite('boot failsafe timeout (2.5s) — main never became ready');
  }
}, 2500);

try {
  boot();
  window.clearTimeout(failsafe);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[nutation] boot failed', err);
  window.__nutation = {
    ready: false,
    END: 0,
    seek() {},
    freeze() {},
    get docked() {
      return true;
    },
    error: msg,
  };
  revealSite(msg);
  window.clearTimeout(failsafe);
}

function boot(): void {
  for (const id of ['story-watercolor', 'story-futures', 'story-duet'] as const) {
    (document.getElementById(id) as HTMLVideoElement | null)?.load();
  }

  /* ----------------------------------------------- the liquid-gold equation */
  const LAGRANGIAN = String.raw`\mathcal{L}=\tfrac{1}{2}I_1\!\left(\dot\theta^{2}+\dot\varphi^{2}\sin^{2}\theta\right)+\tfrac{1}{2}I_3\!\left(\dot\psi+\dot\varphi\cos\theta\right)^{2}-Mg\ell\cos\theta`;
  const fxEq = document.getElementById('fx-eq');
  if (fxEq) katex.render(LAGRANGIAN, fxEq, { displayMode: true, throwOnError: false });

  /* ------------------------------------------------- the mark's exact motion */
  const logo = solveLogoMotion();
  // Two petal-widths rotates the release toward camera-left while leaving the
  // completed ten-fold rosette geometrically unchanged.
  const markState = { ...logo.state, phi: (4 * Math.PI) / 10 };
  const rosetteBaked = bakeClosedRosette(logo.motion, markState, 2e-3, 8);
  const ROSETTE_T = rosetteBaked.dtSample * (rosetteBaked.n - 1);

  function dirsOf(b: Baked): Float32Array {
    const d = new Float32Array(3 * b.n);
    for (let i = 0; i < b.n; i++) {
      const [x, y, z] = axisDir(b.theta[i], b.phi[i]);
      d[3 * i] = x;
      d[3 * i + 1] = y;
      d[3 * i + 2] = z;
    }
    return d;
  }
  const rosetteDirs = dirsOf(rosetteBaked);

  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  let scene: NutationScene;
  try {
    scene = createScene(canvas);
  } catch (err) {
    throw new Error(
      `WebGL renderer failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  // Confirm the context actually stuck — some browsers report WebGL then black-hole it.
  if (!scene.renderer.getContext()) {
    throw new Error('WebGL context missing after renderer init');
  }
  scene.ribbon.setPath(rosetteDirs, rosetteBaked.speed, rosetteBaked.n, true);

  const fxMark = document.getElementById('fx-mark') as HTMLImageElement;
  const fxMarkBold = document.getElementById('fx-mark-bold') as HTMLImageElement;
  const fxWord = document.getElementById('fx-word') as HTMLElement;
  const fxEqEl = document.getElementById('fx-eq') as HTMLElement;
  const headerMark = document.getElementById('header-mark') as HTMLImageElement;
  const headerWord = document.querySelector('#header-lockup .wordmark') as HTMLElement;
  scene.setFocus(1);
  const generatedMark = scene.makeMarkDataUrl(
    rosetteDirs,
    rosetteBaked.speed,
    rosetteBaked.n,
  );
  const generatedMarkBold = scene.makeMarkDataUrl(
    rosetteDirs,
    rosetteBaked.speed,
    rosetteBaked.n,
    true,
  );
  scene.setFocus(0);
  fxMark.src = generatedMark;
  fxMarkBold.src = generatedMarkBold;
  // Header keeps the bold weight — only readable at small size.
  headerMark.src = generatedMarkBold;

  const intro = new Intro(
    scene,
    {
      baked: rosetteBaked,
      T: ROSETTE_T,
      theta0: markState.theta,
      phi0: markState.phi,
      phiDot0: logo.phiDot0,
      psiDot0: psiDot(logo.motion, logo.state.theta),
    },
    { fxMark, fxMarkBold, fxWord, fxEq: fxEqEl, headerMark, headerWord },
    () => {
      markIntroSeen(sessionStorage);
      scene.setTopOpacity(0);
      scene.ribbon.uniforms.uOpacity.value = 0;
      story.start({ delayMs: 0 });
    },
  );
  const WHEEL_SKIP_PX = 140;
  const story = createStory(
    document.getElementById('story-layer')!,
    {
      watercolor: document.getElementById('story-watercolor') as HTMLVideoElement,
      futures: document.getElementById('story-futures') as HTMLVideoElement,
      duet: document.getElementById('story-duet') as HTMLVideoElement,
    },
    {
      chip: document.getElementById('regime-chip')!,
      hint: document.getElementById('hero-hint')!,
    },
  );

  // JS owns the intro now — allow the fx layer to animate.
  // Intentionally NOT auto-skipping on prefers-reduced-motion: the logo trace
  // IS the brand moment. Escape / the skip control still skips to the dock.
  document.body.classList.remove('boot-pending');
  document.getElementById('boot-hint')?.remove();

  mountContact(document.querySelectorAll<HTMLDetailsElement>('[data-contact]'));

  mountDeck({
    video: document.getElementById('demo-video') as HTMLVideoElement | null,
    frame: document.querySelector('.demo-frame'),
    toggle: document.getElementById('demo-toggle'),
    sound: document.getElementById('demo-sound') as HTMLButtonElement | null,
    scrub: document.getElementById('demo-scrub'),
    bar: document.getElementById('demo-bar-fill'),
    reveal: document.querySelectorAll('.band > *'),
    onPastHero: (past) => {
      // The hero story is the only thing still burning frames up there.
      if (past) story.pause();
      else if (story.playing) story.resume();
    },
  });

  // The triple flip is element 1 of the short program.
  const coachHref = coachEmbedHref('alysa_skate', 1);
  mountEmbed({
    frame: document.querySelector('[data-embed-frame]'),
    iframe: document.querySelector('[data-embed]'),
    src: coachHref,
    wide: canEmbed((q) => window.matchMedia(q).matches),
  });
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-embed-open]')) {
    a.href = coachHref;
  }

  // Following a deck link means the reader is done with the trace.
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener('click', () => markIntroSeen(sessionStorage));
  }

  // Desktop opens near the end of the trace so the top still shows where the
  // mark comes from. A phone skips the trace outright and opens on the stamped
  // mark flying to the header, which is the only part that reads at that size.
  const alreadySeen = shouldSkipIntro(location.search, sessionStorage);
  const noTrace = shouldSkipTrace((q) => window.matchMedia(q).matches);
  if (alreadySeen) markIntroSeen(sessionStorage);
  intro.seek(alreadySeen ? INTRO_END : noTrace ? DOCK_START : QUICK_START);

  document.getElementById('replay')!.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    story.stop();
    scene.ribbon.setPath(rosetteDirs, rosetteBaked.speed, rosetteBaked.n, true);
    scene.ribbon.uniforms.uHead.value = 0;
    scene.ribbon.uniforms.uOpacity.value = 1;
    document.body.classList.remove('boot-failed');
    intro.reset();
  });

  const skipIntro = () => {
    if (intro.done) return;
    markIntroSeen(sessionStorage);
    if (intro.time() < DOCK_START) intro.seek(DOCK_START);
  };
  document.getElementById('skip-intro')?.addEventListener('click', skipIntro);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') skipIntro();
  });

  // The deck is locked while the trace plays, so a reader who scrolls anyway
  // gets a dead page. Take a deliberate push — not a stray graze — as "skip".
  let wheeled = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (intro.done) return;
      wheeled += Math.max(0, e.deltaY);
      if (wheeled > WHEEL_SKIP_PX) skipIntro();
    },
    { passive: true },
  );

  function frame(now: number): void {
    try {
      if (!intro.done) {
        intro.tick(now);
        scene.render();
      }
    } catch (err) {
      console.error('[nutation] frame error', err);
      revealSite(err instanceof Error ? err.message : String(err));
      return; // stop the loop
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => scene.resize());

  window.__nutation = {
    ready: true,
    END: INTRO_END,
    seek: (t) => intro.seek(t),
    freeze: (t) => intro.freeze(t),
    get docked() {
      return intro.done;
    },
    get debug() {
      return {
        uHead: scene.ribbon.uniforms.uHead.value,
        uOpacity: scene.ribbon.uniforms.uOpacity.value,
        samples: scene.ribbon.sampleCount,
        playT: ROSETTE_T,
      };
    },
  };
}
