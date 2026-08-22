import { describe, it, expect } from 'vitest';
import { canEmbed, isViewerReady } from './embed';
import { coachEmbedHref, yunaHref } from './sites';

/** Fake matchMedia for a viewport of the given size. */
function media(w: number, h: number) {
  return (q: string) => {
    const minW = /min-width:\s*(\d+)px/.exec(q);
    const minH = /min-height:\s*(\d+)px/.exec(q);
    if (minW) return w >= Number(minW[1]);
    if (minH) return h >= Number(minH[1]);
    return false;
  };
}

describe('canEmbed', () => {
  it('runs the viewer on a laptop or a landscape tablet', () => {
    expect(canEmbed(media(1440, 900))).toBe(true);
    expect(canEmbed(media(1024, 768))).toBe(true);
  });

  it('keeps the still on a phone and on a window too short for the panes', () => {
    expect(canEmbed(media(393, 852))).toBe(false);
    expect(canEmbed(media(852, 393))).toBe(false);
    expect(canEmbed(media(1440, 480))).toBe(false);
  });
});

describe('isViewerReady', () => {
  it('only accepts the viewer saying it is running', () => {
    expect(isViewerReady({ type: 'yuna:ready' })).toBe(true);
    expect(isViewerReady({ type: 'yuna:ready', frame: 791 })).toBe(true);
  });

  it('ignores anything else on the message bus', () => {
    for (const data of [null, undefined, 'yuna:ready', 42, {}, { type: 'other' }, { type: 1 }]) {
      expect(isViewerReady(data)).toBe(false);
    }
  });
});

describe('coachEmbedHref', () => {
  it('addresses a run and the element number on its scoreboard card, with the lanes seeded', () => {
    expect(coachEmbedHref('alysa_skate', 1, 'https://yuna.example/')).toBe(
      'https://yuna.example/?artifact=alysa_skate&embed=1&coach=1' +
        '&signals=inclination_deg,com_height,shoulder_sep',
    );
  });

  it('points at the local viewer in dev and at this same site in prod', () => {
    expect(yunaHref(true)).toBe('http://localhost:5173/');
    expect(yunaHref(false)).toBe('/viewer/index.html');
  });
});
