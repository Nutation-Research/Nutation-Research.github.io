/**
 * Hand-authored coaching content — ported verbatim from Yuna's app/src/artifact/coachContent.ts,
 * trimmed to element 0 ("3F!", the triple flip with an unclear take-off edge) since that's the
 * only element this embed ships pose/cutout data for.
 */

import type { CoachFocus } from './coachStore';
import type { AnnoTarget, AnnoTone } from './coachIllustrations';

export type BulletStatus = 'met' | 'partial' | 'missed';

export interface CoachAnnotation {
  echo: number;
  target: AnnoTarget;
  text: string;
  tone?: AnnoTone;
  scale?: number;
  below?: boolean;
  offsetX?: number;
  offsetY?: number;
}

export interface CoachIllustration {
  echoRange?: [number, number];
  annotations?: CoachAnnotation[];
}

export interface CoachBullet {
  title: string;
  status: BulletStatus;
  why: string;
  improve?: string;
  focus: CoachFocus;
}

export interface CoachCallout {
  title: string;
  advice: string;
  focus: CoachFocus;
}

export interface CoachPhases {
  takeoff: number;
  apex: number;
  landing: number;
}

export interface CoachMetrics {
  airTimeS?: number;
  heightCm?: number;
  lengthM?: number;
  rotations?: number;
  revPerS?: number;
}

export interface CoachContent {
  headline: string;
  summary: string;
  callout?: CoachCallout;
  bullets: CoachBullet[];
  phases?: CoachPhases;
  metrics?: CoachMetrics;
  phases2?: CoachPhases;
  metrics2?: CoachMetrics;
  trailStartFrame?: number;
  trailEndFrame?: number;
  illustrations?: Partial<Record<CoachFocus, CoachIllustration>>;
}

const COACH: Record<string, Record<number, CoachContent>> = {
  alysa_skate: {
    // Element 1 — 3F! (triple flip, unclear take-off edge). Judge GOE +1.71 (raw) / +0.91 pts.
    0: {
      trailStartFrame: 791,
      phases: { takeoff: 820, apex: 827, landing: 835 },
      metrics: { lengthM: 2.4, rotations: 3, revPerS: 3.75 },
      headline: 'Strong triple flip — held back only by an unclear take-off edge.',
      summary:
        'The panel built a starting GOE around +3 from the positive bullets — clear height, a ' +
        'secure checked landing, and effortless rotation — then reduced for the take-off edge the ' +
        'technical panel flagged with “!”. That reduction is the whole gap between this +1.7 and a ' +
        '+3 jump: the flight and landing are already at a high level; the edge is the one fixable thing ' +
        'standing between you and a top-tier grade.',
      callout: {
        title: 'Unclear take-off edge ( ! )',
        advice:
          'A flip must take off from a back-inside edge with a toe-pick assist. The "!" means the ' +
          'blade looked flat or outside at pick-in — drifting toward a Lutz — so the panel could not ' +
          'confirm a clean inside edge. Fix the entry: hold a deep inside edge into the circle, stay ' +
          'bent through the knee, keep the free hip and right shoulder closed, and pick straight back ' +
          'without rolling the blade. Drill three-turn → inside-edge entries, holding that edge one ' +
          'extra beat before the pick.',
        focus: 'edge',
      },
      bullets: [
        {
          title: 'Very good height & length',
          status: 'met',
          focus: 'height',
          why: 'Good elevation and travel across the ice — a clear positive the panel credited.',
        },
        {
          title: 'Good take-off and landing',
          status: 'partial',
          focus: 'takeoff',
          why:
            'The landing was secure and checked on a clean back-outside edge, but the take-off edge was ' +
            'unclear — so only half of this bullet was earned.',
          improve: 'Establish and hold the back-inside entry edge (see the edge note) so the take-off reads as cleanly as the landing.',
        },
        {
          title: 'Effortless throughout',
          status: 'met',
          focus: 'effort',
          why:
            'Unhurried, well-controlled rotation with good rhythm in and out of the jump — the jerk ' +
            '(rate-of-change of acceleration, the body’s effort) stays low across the arc.',
        },
        {
          title: 'Steps before / creative entry',
          status: 'missed',
          focus: 'entry',
          why: 'A fairly standard glide-in; no difficult step or unexpected entry directly before the jump.',
          improve:
            'Add a recognizable turn/step immediately into the flip (a tight three-turn or rocker on the ' +
            'inside edge) — it both claims this bullet and naturally sets the correct take-off edge.',
        },
        {
          title: 'Very good body position (take-off → landing)',
          status: 'met',
          focus: 'axis',
          why: 'Tight, upright air position over a stable rotational axis.',
        },
        {
          title: 'Element matches the music',
          status: 'partial',
          focus: 'overview',
          why: 'Reasonably placed, but not landed on a distinct musical accent.',
          improve: 'Time the take-off to a clear beat/accent so the jump visibly punctuates the music.',
        },
      ],
      illustrations: {
        edge: {
          echoRange: [1, 7],
          annotations: [
            {
              echo: 3,
              target: 'leftFoot',
              tone: 'warn',
              scale: 1.5,
              below: true,
              text: 'Approach is flat — not strongly committed to an inside edge yet.',
            },
            {
              echo: 6,
              target: 'rightFoot',
              tone: 'warn',
              scale: 1.5,
              below: true,
              offsetX: -8,
              offsetY: -9,
              text:
                'Still no commitment to the inside edge. Not as wrong as an “e” where the edge is ' +
                'definitely wrong, but the edge still looks flat at take-off, right before the pick and lift.',
            },
          ],
        },
      },
    },
  },
};

export function coachContentFor(clipId: string | undefined, entityId: number | undefined): CoachContent | null {
  if (clipId == null || entityId == null) return null;
  return COACH[clipId]?.[entityId] ?? null;
}

export function coachPhasesFor(clipId: string | undefined, entityId: number | undefined): CoachPhases | null {
  return coachContentFor(clipId, entityId)?.phases ?? null;
}

export function coachMetricsFor(clipId: string | undefined, entityId: number | undefined): CoachMetrics {
  return coachContentFor(clipId, entityId)?.metrics ?? {};
}

export function coachPhases2For(clipId: string | undefined, entityId: number | undefined): CoachPhases | null {
  return coachContentFor(clipId, entityId)?.phases2 ?? null;
}

export function coachMetrics2For(clipId: string | undefined, entityId: number | undefined): CoachMetrics {
  return coachContentFor(clipId, entityId)?.metrics2 ?? {};
}

export function coachIllustrationFor(
  clipId: string | undefined,
  entityId: number | undefined,
  focus: CoachFocus,
): CoachIllustration | null {
  return coachContentFor(clipId, entityId)?.illustrations?.[focus] ?? null;
}

export function coachWindowFor(
  clipId: string | undefined,
  entityId: number | undefined,
  defaultStart: number,
  defaultEnd: number,
): { startFrame: number; endFrame: number } {
  const c = coachContentFor(clipId, entityId);
  return {
    startFrame: c?.trailStartFrame ?? defaultStart,
    endFrame: c?.trailEndFrame ?? defaultEnd,
  };
}
