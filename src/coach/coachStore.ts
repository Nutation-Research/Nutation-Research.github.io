import { create } from 'zustand';

/** Which per-bullet illustration the coach motion-trail is showing. The first row are the
 *  jump focuses (phase-anchored); the second row are the spin focuses (annotation-driven). */
export type CoachFocus =
  | 'overview' | 'height' | 'takeoff' | 'axis' | 'edge' | 'entry' | 'effort'
  | 'speed' | 'position' | 'centering' | 'catchfoot';

/** The coach has two stages: first the element plays through once as plain video (with the
 *  normal overlay), then it freezes into the motion trail. The user can replay either, and
 *  Escape/back exits coach entirely. */
export type CoachStage = 'video' | 'trail';

// ── generation schedule (pure) ────────────────────────────────────────────────
// The coach text "generates" section by section — summary first, then the callout,
// then each bullet — on a single wall clock started when the trail first appears
// (coachStore.genStartAt). Everything downstream (spinners, typewriters, the
// click-to-highlight gate) derives from elapsed time against this schedule, so
// collapsing/expanding a section never restarts or loses progress.

export type GenStatus = 'pending' | 'generating' | 'done';

export interface GenSection {
  key: string; // 'summary' | 'callout' | 'bullet-<i>'
  start: number; // ms after genStartAt when this section begins generating
  textStart: number; // ms after genStartAt when its words start appearing (after the "thinking" lead)
  end: number; // ms after genStartAt when its text is fully generated
}

export const GEN_MS_PER_WORD = 24; // typewriter speed — also sets each section's duration
const GEN_LEAD_MS = 700; // "thinking" beat before a section's words start appearing
const CALLOUT_LEAD_MS = 2600; // the edge analysis runs a longer reasoning beat first

const SUMMARY_LEAD_MS = 2400; // "Elucidating GOE score" beat before the summary typewriter

const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Sequential per-section schedule for one element's coach content. Pure — unit-testable. */
export function buildGenSchedule(content: {
  headline: string;
  summary: string;
  callout?: { advice: string };
  bullets: { why: string; improve?: string }[];
}): GenSection[] {
  const out: GenSection[] = [];
  let t = 200;
  const push = (key: string, lead: number, text: string) => {
    const dur = lead + wordsOf(text) * GEN_MS_PER_WORD;
    out.push({ key, start: t, textStart: t + lead, end: t + dur });
    t += dur;
  };
  push('summary', SUMMARY_LEAD_MS, content.summary);
  if (content.callout) push('callout', CALLOUT_LEAD_MS, content.callout.advice);
  content.bullets.forEach((b, i) => push(`bullet-${i}`, GEN_LEAD_MS, b.why + ' ' + (b.improve ?? '')));
  return out;
}

/** Which phase a scheduled section is in at `elapsed` ms. */
export function genPhaseOf(
  section: GenSection | undefined,
  elapsed: number | null,
): 'pending' | 'thinking' | 'typing' | 'done' {
  if (!section || elapsed == null || elapsed < section.start) return 'pending';
  if (elapsed >= section.end) return 'done';
  if (elapsed < section.textStart) return 'thinking';
  return 'typing';
}

/** Progress 0…1 through a section's "thinking" lead beat. */
export function thinkingProgress(section: GenSection, elapsed: number): number {
  const span = section.textStart - section.start;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (elapsed - section.start) / span));
}

/** A section's status at `elapsed` ms into the generation (null start = nothing generated). */
export function genStatusOf(section: GenSection | undefined, elapsed: number | null): GenStatus {
  if (!section || elapsed == null || elapsed < section.start) return 'pending';
  return elapsed >= section.end ? 'done' : 'generating';
}

interface CoachState {
  elementId: number | null;
  focus: CoachFocus;
  stage: CoachStage;
  trailNonce: number;
  /** Wall-clock ms (Date.now) when the text generation started — set once when the trail
   *  first appears for this coach session; null until then. Replaying the trail or toggling
   *  sections never resets it. */
  genStartAt: number | null;
  /** True once the user has revealed the authored rings/captions on the trail (by clicking the
   *  generated callout text). */
  revealRings: boolean;

  open: (elementId: number) => void;
  setFocus: (focus: CoachFocus) => void;
  setStage: (stage: CoachStage) => void;
  replayTrail: () => void;
  startGen: () => void;
  setRevealRings: (revealRings: boolean) => void;
  close: () => void;
}

const GEN_RESET = {
  genStartAt: null as number | null,
  revealRings: false,
};

export const useCoachStore = create<CoachState>((set) => ({
  elementId: null,
  focus: 'overview',
  stage: 'video',
  trailNonce: 0,
  genStartAt: null,
  revealRings: false,
  open: (elementId) =>
    set({ elementId, focus: 'overview', stage: 'video', trailNonce: 0, ...GEN_RESET }),
  setFocus: (focus) => set({ focus }),
  setStage: (stage) => set({ stage }),
  replayTrail: () => set((s) => ({ stage: 'trail', trailNonce: s.trailNonce + 1 })),
  startGen: () => set((s) => (s.genStartAt == null ? { genStartAt: Date.now() } : {})),
  setRevealRings: (revealRings) => set({ revealRings }),
  close: () => set({ elementId: null, ...GEN_RESET }),
}));
