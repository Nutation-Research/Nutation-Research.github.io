import { describe, it, expect } from 'vitest';
import { shouldSkipTrace } from './introSkip';

/** Fake matchMedia for a viewport of the given size and pointer type. */
function media(w: number, h: number, coarse = false) {
  return (q: string) => {
    const maxW = /max-width:\s*(\d+)px/.exec(q);
    const maxH = /max-height:\s*(\d+)px/.exec(q);
    if (q.includes('pointer: coarse') && !coarse) return false;
    if (maxW && w > Number(maxW[1])) return false;
    if (maxH && h > Number(maxH[1])) return false;
    return !!(maxW || maxH);
  };
}

describe('shouldSkipTrace', () => {
  it('skips the trace on phones in either orientation', () => {
    expect(shouldSkipTrace(media(393, 852, true))).toBe(true);
    expect(shouldSkipTrace(media(852, 393, true))).toBe(true);
  });

  it('keeps the trace on desktop and on a tablet with room for it', () => {
    expect(shouldSkipTrace(media(1440, 900))).toBe(false);
    expect(shouldSkipTrace(media(1024, 768, true))).toBe(false);
  });

  it('does not skip on a small desktop window with a fine pointer', () => {
    expect(shouldSkipTrace(media(900, 500, false))).toBe(false);
  });
});
import { DOCK_START, INTRO_END } from './intro';
import { INTRO_SEEN_KEY, markIntroSeen, shouldSkipIntro } from './introSkip';

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('intro skip target', () => {
  it('lands on the stamped logo before the header dock', () => {
    expect(DOCK_START).toBeGreaterThan(0);
    expect(DOCK_START).toBeLessThan(INTRO_END);
  });
});

describe('shouldSkipIntro', () => {
  it('plays the intro on a first visit', () => {
    expect(shouldSkipIntro('', memory())).toBe(false);
    expect(shouldSkipIntro('?', memory())).toBe(false);
  });

  it('skips when ?skip is present', () => {
    expect(shouldSkipIntro('?skip', memory())).toBe(true);
    expect(shouldSkipIntro('skip=1', memory())).toBe(true);
  });

  it('skips a return visit in the same session', () => {
    const store = memory();
    markIntroSeen(store);
    expect(store.getItem(INTRO_SEEN_KEY)).toBe('1');
    expect(shouldSkipIntro('', store)).toBe(true);
  });
});
