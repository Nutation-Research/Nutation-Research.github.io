import { describe, it, expect } from 'vitest';
import { DOCK_START, INTRO_END, QUICK_START, rosetteDrawnAt } from './intro';

describe('QUICK_START', () => {
  it('lands inside the trace, so the top is still inking its own path', () => {
    expect(rosetteDrawnAt(QUICK_START)).toBeGreaterThan(0.8);
    expect(rosetteDrawnAt(QUICK_START)).toBeLessThan(1);
  });

  it('leaves the stamp and the dock ahead of the reader', () => {
    expect(QUICK_START).toBeLessThan(DOCK_START);
  });

  it('keeps a first visit to a title-card length wait', () => {
    expect(INTRO_END - QUICK_START).toBeLessThan(3.6);
  });
});

describe('rosetteDrawnAt', () => {
  it('inks nothing before the release and closes exactly once', () => {
    expect(rosetteDrawnAt(0)).toBe(0);
    expect(rosetteDrawnAt(INTRO_END)).toBe(1);
  });

  it('rises monotonically through the trace', () => {
    const samples = [1, 2, 3, 4, 5, 6].map(rosetteDrawnAt);
    for (const [a, b] of samples.slice(0, -1).map((v, i) => [v, samples[i + 1]])) {
      expect(b).toBeGreaterThanOrEqual(a);
    }
  });
});
