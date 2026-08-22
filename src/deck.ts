/**
 * The scrolling deck below the hero.
 *
 * Two behaviours matter: the Yuna demo starts itself when the reader scrolls it
 * into the middle of the viewport, and the fixed hero layers (WebGL top, story
 * plate) retire once the reader has moved past them.
 */

/** Whether the demo should be running, given visibility and the reader's own last call. */
export function autoplayAction(
  visible: boolean,
  playing: boolean,
  userPaused: boolean,
): 'play' | 'pause' | null {
  if (visible && !playing && !userPaused) return 'play';
  if (!visible && playing) return 'pause';
  return null;
}

/** The hero is spent once this much of it has scrolled off the top. */
export function isPastHero(scrollY: number, viewportH: number, fraction = 0.4): boolean {
  return scrollY > viewportH * fraction;
}

/** Progress bar width, clamped and safe before metadata arrives. */
export function progressPercent(currentTime: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  if (!Number.isFinite(currentTime) || currentTime <= 0) return 0;
  return Math.min(100, (currentTime / duration) * 100);
}

/** Where along the track a pointer landed, as a 0..1 fraction. */
export function seekFraction(clientX: number, trackLeft: number, trackWidth: number): number {
  if (!(trackWidth > 0)) return 0;
  return Math.min(1, Math.max(0, (clientX - trackLeft) / trackWidth));
}

/**
 * Target time for a seek. Stops a hair short of the end: seeking to exactly
 * `duration` fires `ended` and throws the reader back to the first frame.
 */
export function seekTime(fraction: number, duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return Math.min(duration - 0.05, Math.min(1, Math.max(0, fraction)) * duration);
}

/** The chip names the action, not the state — "Sound off" reads both ways. */
export function soundLabel(muted: boolean): string {
  return muted ? 'Unmute' : 'Mute';
}

export interface DeckRefs {
  video: HTMLVideoElement | null;
  frame: HTMLElement | null;
  toggle: HTMLElement | null;
  sound: HTMLButtonElement | null;
  /** The seek track. */
  scrub: HTMLElement | null;
  /** The filled portion of the seek track. */
  bar: HTMLElement | null;
  reveal: Iterable<Element>;
  /** Called when the reader crosses out of, or back into, the hero. */
  onPastHero?(past: boolean): void;
}

export function mountDeck(refs: DeckRefs): void {
  mountDemo(refs);
  mountReveal(refs.reveal);
  mountPastHero(refs.onPastHero);
}

function mountDemo({ video, frame, toggle, sound, scrub, bar }: DeckRefs): void {
  if (!video) return;

  let userPaused = false;
  const paint = () => {
    frame?.classList.toggle('is-playing', !video.paused);
    frame?.classList.toggle('is-paused', video.paused);
  };
  const attempt = (action: 'play' | 'pause' | null) => {
    if (action === 'play') video.play().catch(() => {});
    else if (action === 'pause') video.pause();
  };

  // `timeupdate` only fires about four times a second, which reads as a stutter
  // on a bar this wide. Drive it from the frame clock while it is running.
  let raf = 0;
  const drawProgress = () => {
    const pct = progressPercent(video.currentTime, video.duration);
    if (bar) bar.style.width = `${pct}%`;
    scrub?.setAttribute('aria-valuenow', String(Math.round(pct)));
  };
  const follow = () => {
    drawProgress();
    raf = requestAnimationFrame(follow);
  };
  const stopFollowing = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    drawProgress();
  };

  video.addEventListener('play', () => {
    paint();
    if (!raf) follow();
  });
  video.addEventListener('pause', () => {
    paint();
    stopFollowing();
  });
  video.addEventListener('seeked', drawProgress);
  video.addEventListener('loadedmetadata', drawProgress);
  video.addEventListener('ended', () => {
    // Park it back on the opening frame rather than freezing on the last one.
    video.currentTime = 0;
    userPaused = true;
    stopFollowing();
    paint();
  });
  paint();
  mountScrubber(video, scrub, drawProgress);

  toggle?.addEventListener('click', () => {
    userPaused = !video.paused;
    attempt(video.paused ? 'play' : 'pause');
  });

  if (sound) {
    sound.textContent = soundLabel(video.muted);
    sound.addEventListener('click', (e) => {
      e.stopPropagation();
      video.muted = !video.muted;
      sound.textContent = soundLabel(video.muted);
      // Unmuting is a clear signal the reader wants to watch it.
      if (video.paused) {
        userPaused = false;
        attempt('play');
      }
    });
  }

  // A negative rootMargin means "inside the middle band of the viewport", which
  // behaves the same whether the frame is shorter or taller than the window.
  new IntersectionObserver(
    ([entry]) => attempt(autoplayAction(entry.isIntersecting, !video.paused, userPaused)),
    { rootMargin: '-18% 0px -22% 0px', threshold: 0 },
  ).observe(video);
}

function mountScrubber(
  video: HTMLVideoElement,
  scrub: HTMLElement | null,
  onSeek: () => void,
): void {
  if (!scrub) return;

  const seek = (clientX: number) => {
    const rect = scrub.getBoundingClientRect();
    const t = seekTime(seekFraction(clientX, rect.left, rect.width), video.duration);
    if (t === null) return;
    video.currentTime = t;
    onSeek();
  };

  scrub.addEventListener('pointerdown', (e) => {
    // Otherwise the play/pause hit area underneath swallows the grab.
    e.preventDefault();
    e.stopPropagation();
    scrub.setPointerCapture(e.pointerId);
    scrub.classList.add('is-scrubbing');
    seek(e.clientX);
  });
  scrub.addEventListener('pointermove', (e) => {
    if (scrub.hasPointerCapture(e.pointerId)) seek(e.clientX);
  });
  const release = (e: PointerEvent) => {
    if (!scrub.hasPointerCapture(e.pointerId)) return;
    scrub.releasePointerCapture(e.pointerId);
    scrub.classList.remove('is-scrubbing');
  };
  scrub.addEventListener('pointerup', release);
  scrub.addEventListener('pointercancel', release);

  scrub.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0;
    if (!step) return;
    e.preventDefault();
    video.currentTime = Math.min(
      Math.max(0, video.currentTime + step),
      Math.max(0, video.duration - 0.05),
    );
    onSeek();
  });
}

function mountReveal(targets: Iterable<Element>): void {
  const items = Array.from(targets);
  if (!items.length) return;
  // Added here rather than in the markup so the copy stays visible without JS.
  for (const el of items) el.classList.add('reveal');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.04 },
  );
  for (const el of items) io.observe(el);
}

function mountPastHero(onPastHero?: (past: boolean) => void): void {
  let past = false;
  let queued = false;
  const read = () => {
    queued = false;
    const next = isPastHero(window.scrollY, window.innerHeight);
    if (next === past) return;
    past = next;
    document.body.classList.toggle('past-hero', past);
    onPastHero?.(past);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    },
    { passive: true },
  );
  read();
}
