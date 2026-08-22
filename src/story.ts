/**
 * Post-intro landing sequence: watercolor fall → imagined futures → gray/pink body.
 * Media is baked by scripts/bake_story.sh into /story/*.mp4.
 */
export interface StoryCopy {
  chip: HTMLElement;
  hint: HTMLElement;
}

export type StoryBeat = 'watercolor' | 'futures' | 'duet';
export const STORY_BEATS: StoryBeat[] = ['watercolor', 'futures', 'duet'];

export function nextStoryBeat(beat: StoryBeat): StoryBeat | null {
  const i = STORY_BEATS.indexOf(beat);
  return i >= 0 && i < STORY_BEATS.length - 1 ? STORY_BEATS[i + 1] : null;
}

const DEFAULT_CHIP = 'loops — released with a backward flick';
const DEFAULT_HINT =
  'The heavy symmetric top, Goldstein §5.7 · drag the axis and let go — the release picks the pattern';
const DEFAULT_CAPTION = 'alysa_fall · world model';

const BEATS: Record<
  StoryBeat,
  { chip: string; hint: string; caption: string; plate: string }
> = {
  watercolor: {
    chip: 'watercolor · the fall',
    hint: 'Eighteen stills of the attempt, in order',
    caption: 'alysa_fall · watercolor · the fall',
    plate: '2022 US Nationals Short Program: Alysa Liu Triple Axel',
  },
  futures: {
    chip: 'futures · <mark>don’t fall</mark>',
    hint: 'Gray ghost is the attempt · colored paths are hypotheses',
    caption: 'alysa_fall · futures · don’t fall',
    plate: 'Imagined futures',
  },
  duet: {
    chip: '<mark class="mark-gray">gray</mark> observed · <mark class="mark-pink">pink</mark> hypothetical',
    hint: 'Finish the spin in the air — spot your landing early',
    caption: 'alysa_fall · gray / pink · correction',
    plate: 'Gray observed · pink hypothetical',
  },
};

export interface StoryPlayer {
  start(opts?: { delayMs?: number }): void;
  stop(): void;
  playBeat(beat: StoryBeat, opts?: { sequence?: boolean }): void;
  replay(): void;
  pause(): void;
  resume(): void;
  activeVideo(): HTMLVideoElement | null;
  readonly playing: boolean;
  readonly paused: boolean;
  readonly beat: StoryBeat | null;
  readonly sequence: boolean;
}

export function createStory(
  layer: HTMLElement,
  videos: Record<StoryBeat, HTMLVideoElement>,
  copy: StoryCopy,
  onBegin?: () => void,
): StoryPlayer {
  const all = STORY_BEATS.map((b) => videos[b]);
  const stage = layer.querySelector('#story-stage') as HTMLElement | null;
  const caption = layer.querySelector('#story-caption');
  const plateText = layer.querySelector('#story-plate-text');
  let playing = false;
  let paused = false;
  let sequence = false;
  let beat: StoryBeat | null = null;
  let timer = 0;

  const setCopy = (next: StoryBeat | null) => {
    if (!next) {
      copy.chip.textContent = DEFAULT_CHIP;
      copy.hint.textContent = DEFAULT_HINT;
      if (caption) caption.textContent = DEFAULT_CAPTION;
      if (plateText) plateText.textContent = BEATS.watercolor.plate;
      if (stage) delete stage.dataset.beat;
      return;
    }
    copy.chip.innerHTML = BEATS[next].chip;
    copy.hint.textContent = BEATS[next].hint;
    if (caption) caption.textContent = BEATS[next].caption;
    if (plateText) plateText.textContent = BEATS[next].plate;
    if (stage) stage.dataset.beat = next;
  };

  const show = (el: HTMLVideoElement) => {
    for (const v of all) {
      if (v === el) continue;
      v.onended = null;
      v.pause();
      v.classList.remove('is-on');
    }
    el.classList.add('is-on');
    if (el.currentTime > 0.05) {
      try {
        el.currentTime = 0;
      } catch {
        /* unseekable until metadata */
      }
    }
    paused = false;
    const play = el.play();
    if (play) play.catch(() => {});
  };

  const advance = (from: HTMLVideoElement, next: () => void) => {
    const done = () => {
      from.onended = null;
      next();
    };
    from.onended = done;
    window.setTimeout(() => {
      if (from.readyState < 2) done();
    }, 1200);
  };

  const playBeat = (next: StoryBeat, opts?: { sequence?: boolean }) => {
    window.clearTimeout(timer);
    timer = 0;
    playing = true;
    sequence = opts?.sequence ?? false;
    beat = next;
    document.body.classList.add('story-playing');
    layer.setAttribute('aria-hidden', 'false');
    onBegin?.();
    setCopy(next);
    videos.watercolor.loop = next === 'watercolor';
    videos.duet.loop = next === 'duet';
    show(videos[next]);
    const following = sequence ? nextStoryBeat(next) : null;
    if (following) advance(videos[next], () => playBeat(following, { sequence: true }));
  };

  return {
    get playing() {
      return playing;
    },
    get paused() {
      return paused;
    },
    get beat() {
      return beat;
    },
    get sequence() {
      return sequence;
    },
    activeVideo() {
      return beat ? videos[beat] : null;
    },
    playBeat,
    start(opts) {
      if (playing) return;
      const delay = opts?.delayMs ?? 0;
      if (delay <= 0) {
        playBeat('watercolor');
        return;
      }
      playing = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => playBeat('watercolor'), delay);
    },
    stop() {
      playing = false;
      paused = false;
      sequence = false;
      beat = null;
      window.clearTimeout(timer);
      timer = 0;
      for (const v of all) {
        v.onended = null;
        v.pause();
        v.classList.remove('is-on');
        try {
          v.currentTime = 0;
        } catch {
          /* unseekable until metadata */
        }
      }
      document.body.classList.remove('story-playing');
      layer.setAttribute('aria-hidden', 'true');
      setCopy(null);
    },
    replay() {
      const wasSeq = sequence || beat == null;
      const current = beat;
      this.stop();
      if (wasSeq) this.start({ delayMs: 0 });
      else playBeat(current!);
    },
    pause() {
      const el = beat ? videos[beat] : null;
      if (!el || paused) return;
      el.pause();
      paused = true;
    },
    resume() {
      const el = beat ? videos[beat] : null;
      if (!el || !paused) return;
      const play = el.play();
      if (play) play.catch(() => {});
      paused = false;
    },
  };
}
