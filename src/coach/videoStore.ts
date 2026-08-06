/** Trimmed stand-in for Yuna's app/src/stores/videoStore.ts — this embed has no raw <video>
 *  (the trail stage never needs one), but CoachPanel/MotionTrail call setPlaying on stage changes. */
import { create } from 'zustand';

interface VideoState {
  isPlaying: boolean;
  setPlaying: (isPlaying: boolean) => void;
  /** No-op: this embed has no raw <video> (the trail stage never needs one), but
   *  MotionTrail's "replay video" control calls this before flipping the stage. */
  seekToFrame: (frame: number) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  isPlaying: false,
  setPlaying: (isPlaying) => set({ isPlaying }),
  seekToFrame: () => {},
}));
