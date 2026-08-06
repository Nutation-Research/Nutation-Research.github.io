/**
 * Trimmed stand-in for Yuna's app/src/artifact/artifactStore.ts — same field names CoachPanel.tsx
 * and MotionTrail.tsx read (elements/events/table/meta/viewRange/cutouts/base/cursorFrame), hydrated
 * once from the precomputed JSON bundle (see HomeCoachDemo) instead of the full run pipeline.
 */
import { create } from 'zustand';
import type { ArtifactTable, EventTable } from './decode';
import type { CutoutManifest } from './cutouts';

export interface ArtifactMeta {
  element_id: string;
  fps: number;
  frame_width: number;
  frame_height: number;
}

interface ViewRange {
  startFrame: number;
  endFrame: number;
}

interface ArtifactState {
  elements: EventTable | null;
  events: EventTable | null;
  table: ArtifactTable | null;
  meta: ArtifactMeta | null;
  cutouts: CutoutManifest | null;
  base: string | null;
  viewRange: ViewRange | null;
  cursorFrame: number | null;
  hydrate: (data: {
    elements: EventTable;
    events: EventTable;
    table: ArtifactTable;
    meta: ArtifactMeta;
    cutouts: CutoutManifest | null;
    base: string;
  }) => void;
  setViewRange: (vr: ViewRange | null) => void;
  resetViewRange: () => void;
  setCursorFrame: (f: number | null) => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  elements: null,
  events: null,
  table: null,
  meta: null,
  cutouts: null,
  base: null,
  viewRange: null,
  cursorFrame: null,
  hydrate: (data) => set({ ...data, viewRange: null, cursorFrame: null }),
  setViewRange: (viewRange) => set({ viewRange }),
  resetViewRange: () => set({ viewRange: null }),
  setCursorFrame: (cursorFrame) => set({ cursorFrame }),
}));
