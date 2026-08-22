import { describe, it, expect } from 'vitest';
import {
  autoplayAction,
  isPastHero,
  progressPercent,
  seekFraction,
  seekTime,
  soundLabel,
} from './deck';

describe('autoplayAction', () => {
  it('starts the demo when it scrolls into view', () => {
    expect(autoplayAction(true, false, false)).toBe('play');
  });

  it('stops the demo once it scrolls out of view', () => {
    expect(autoplayAction(false, true, false)).toBe('pause');
  });

  it('leaves a running, visible demo alone', () => {
    expect(autoplayAction(true, true, false)).toBeNull();
  });

  it('does not restart a demo the reader paused on purpose', () => {
    expect(autoplayAction(true, false, true)).toBeNull();
  });

  it('still pauses a paused-by-hand demo that leaves the viewport', () => {
    expect(autoplayAction(false, false, true)).toBeNull();
  });
});

describe('isPastHero', () => {
  it('holds through the top of the hero and flips below the fraction', () => {
    expect(isPastHero(0, 1000)).toBe(false);
    expect(isPastHero(400, 1000)).toBe(false);
    expect(isPastHero(401, 1000)).toBe(true);
  });

  it('scales with the viewport rather than a fixed pixel count', () => {
    expect(isPastHero(300, 500)).toBe(true);
    expect(isPastHero(300, 1200)).toBe(false);
  });
});

describe('progressPercent', () => {
  it('reports the fraction played', () => {
    expect(progressPercent(30, 120)).toBe(25);
  });

  it('reads zero before metadata gives a duration', () => {
    expect(progressPercent(0, NaN)).toBe(0);
    expect(progressPercent(5, 0)).toBe(0);
    expect(progressPercent(1, Infinity)).toBe(0);
  });

  it('never overruns the bar', () => {
    expect(progressPercent(200, 120)).toBe(100);
  });
});

describe('seekFraction', () => {
  it('maps a pointer position onto the track', () => {
    expect(seekFraction(500, 100, 800)).toBe(0.5);
    expect(seekFraction(100, 100, 800)).toBe(0);
  });

  it('clamps a drag that runs off either end of the track', () => {
    expect(seekFraction(-40, 100, 800)).toBe(0);
    expect(seekFraction(5000, 100, 800)).toBe(1);
  });

  it('survives a zero-width track', () => {
    expect(seekFraction(500, 100, 0)).toBe(0);
  });
});

describe('seekTime', () => {
  it('converts a fraction into a playhead position', () => {
    expect(seekTime(0.25, 200)).toBe(50);
  });

  it('stops short of the end so a drag to the right does not trigger ended', () => {
    expect(seekTime(1, 200)).toBe(199.95);
  });

  it('refuses to seek before the duration is known', () => {
    expect(seekTime(0.5, NaN)).toBeNull();
    expect(seekTime(0.5, 0)).toBeNull();
  });
});

describe('soundLabel', () => {
  it('names the action the click performs, not the current state', () => {
    expect(soundLabel(true)).toBe('Unmute');
    expect(soundLabel(false)).toBe('Mute');
  });
});
