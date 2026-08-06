/**
 * Pose effort LUT — dusk rose is the default; orchid is an optional alternate
 * (small toggle in the UI). Well is locked to wine (--color-well in globals.css).
 */
import { useSyncExternalStore } from 'react';

export type PoseThemeId = 'dusk' | 'orchid';

export interface PoseTheme {
  id: PoseThemeId;
  label: string;
  lut: readonly [number, number, number][];
}

/** Locked letterbox — matches --color-well in globals.css. */
export const WELL = '#452130';

export const POSE_THEMES: Record<PoseThemeId, PoseTheme> = {
  dusk: {
    id: 'dusk',
    label: 'Dusk rose',
    lut: [
      [10, 10, 16],
      [28, 24, 40],
      [55, 30, 62],
      [100, 40, 90],
      [150, 50, 110],
      [196, 68, 128],
      [224, 110, 150],
      [250, 215, 225],
    ],
  },
  orchid: {
    id: 'orchid',
    label: 'Orchid',
    lut: [
      [10, 10, 18],
      [26, 22, 48],
      [50, 28, 80],
      [95, 40, 115],
      [145, 55, 140],
      [185, 80, 155],
      [220, 130, 175],
      [245, 210, 230],
    ],
  },
};

export function effortColorFromLut(
  e: number,
  lut: readonly [number, number, number][],
): string {
  if (Number.isNaN(e)) return 'rgba(130, 130, 140, 0.5)';
  const t = e < 0 ? 0 : e > 1 ? 1 : e;
  const segs = lut.length - 1;
  const i = Math.min(Math.floor(t * segs), segs - 1);
  const f = t * segs - i;
  const [r0, g0, b0] = lut[i];
  const [r1, g1, b1] = lut[i + 1];
  const r = Math.round(r0 + (r1 - r0) * f);
  const g = Math.round(g0 + (g1 - g0) * f);
  const b = Math.round(b0 + (b1 - b0) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

type ThemeSnapshot = { poseId: PoseThemeId };
type Listener = () => void;

let snapshot: ThemeSnapshot = { poseId: 'dusk' };
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

/** Stable reference — required by useSyncExternalStore (new object each call = infinite loop). */
export function getThemeState(): ThemeSnapshot {
  return snapshot;
}

export function setPoseId(id: PoseThemeId) {
  if (snapshot.poseId === id) return;
  snapshot = { poseId: id };
  emit();
}

export function toggleOrchid() {
  setPoseId(snapshot.poseId === 'orchid' ? 'dusk' : 'orchid');
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLandingTheme(): {
  poseId: PoseThemeId;
  pose: PoseTheme;
  orchidOn: boolean;
  toggleOrchid: () => void;
} {
  const s = useSyncExternalStore(subscribeTheme, getThemeState, getThemeState);
  return {
    poseId: s.poseId,
    pose: POSE_THEMES[s.poseId],
    orchidOn: s.poseId === 'orchid',
    toggleOrchid,
  };
}

/** Ensure --color-well stays on wine (in case something overwrote it during experiments). */
export function applyWellCss() {
  document.documentElement.style.setProperty('--color-well', WELL);
}
