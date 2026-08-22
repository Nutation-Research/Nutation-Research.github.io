import { describe, it, expect } from 'vitest';
import {
  WATERCOLOR_BAKE,
  WATERCOLOR_FADE,
  WATERCOLOR_STEP,
  bakeHeightForWidth,
  sourceLabel,
  watercolorStillAt,
  watercolorStillTime,
} from './watercolorStills';

describe('watercolorStillAt', () => {
  it('holds still 1 until the first xfade', () => {
    expect(watercolorStillAt(0).index).toBe(1);
    expect(watercolorStillAt(WATERCOLOR_STEP - 0.01)).toEqual({
      index: 1,
      next: null,
      mix: 0,
    });
  });

  it('crossfades 1 → 2 at the first step', () => {
    const mid = watercolorStillAt(WATERCOLOR_STEP + WATERCOLOR_FADE / 2);
    expect(mid.index).toBe(1);
    expect(mid.next).toBe(2);
    expect(mid.mix).toBeCloseTo(0.5, 5);
  });

  it('lands on still 18 after the last fade', () => {
    expect(watercolorStillAt(17 * WATERCOLOR_STEP + WATERCOLOR_FADE + 0.1).index).toBe(18);
  });
});

describe('bakeHeightForWidth', () => {
  it('keeps the baked picture aspect', () => {
    expect(bakeHeightForWidth(WATERCOLOR_BAKE.w)).toBe(WATERCOLOR_BAKE.h);
    expect(bakeHeightForWidth(680)).toBe(499);
  });
});

describe('sourceLabel', () => {
  it('marks 01–03 as cropped into the shared box', () => {
    expect(sourceLabel(1)).toBe('1540×1021 → 1464×1074');
    expect(sourceLabel(4)).toBe('1464×1074');
  });
});

describe('watercolorStillTime', () => {
  it('seeks to a fully-on still, not a dissolve', () => {
    expect(watercolorStillAt(watercolorStillTime(1)).next).toBeNull();
    expect(watercolorStillAt(watercolorStillTime(4)).index).toBe(4);
    expect(watercolorStillAt(watercolorStillTime(4)).next).toBeNull();
    expect(watercolorStillAt(watercolorStillTime(18)).index).toBe(18);
  });
});
