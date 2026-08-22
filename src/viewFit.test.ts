import { describe, it, expect } from 'vitest';
import { FIT_HALF_WIDTH, MARK_RADIUS, fitHalfHeight, fitHalfWidth } from './viewFit';

const BASE = 1.16;

// width x height of the viewports that actually matter
const VIEWPORTS: [string, number, number][] = [
  ['desktop 1440x900', 1440, 900],
  ['laptop 1280x800', 1280, 800],
  ['tablet portrait 820x1180', 820, 1180],
  ['iPhone 430x932', 430, 932],
  ['small phone 360x780', 360, 780],
  ['landscape phone 932x430', 932, 430],
];

describe('fitHalfHeight', () => {
  it('leaves landscape framing exactly as tuned', () => {
    expect(fitHalfHeight(1440 / 900, BASE)).toBe(BASE);
    expect(fitHalfHeight(1280 / 800, BASE)).toBe(BASE);
  });

  it('grows the frustum on portrait rather than cropping', () => {
    expect(fitHalfHeight(430 / 932, BASE)).toBeGreaterThan(BASE);
  });

  it('never crops the mark on any viewport we care about', () => {
    for (const [name, w, h] of VIEWPORTS) {
      const halfW = fitHalfWidth(w / h, BASE);
      expect(halfW, name).toBeGreaterThanOrEqual(MARK_RADIUS);
    }
  });

  it('keeps a margin so the outer loops do not touch the edge', () => {
    expect(fitHalfWidth(430 / 932, BASE)).toBeCloseTo(FIT_HALF_WIDTH, 6);
  });

  it('falls back to the tuned height before the canvas has a size', () => {
    expect(fitHalfHeight(0, BASE)).toBe(BASE);
    expect(fitHalfHeight(NaN, BASE)).toBe(BASE);
  });
});
