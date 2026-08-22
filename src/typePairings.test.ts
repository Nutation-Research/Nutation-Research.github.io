import { describe, expect, it } from 'vitest';
import {
  applyType,
  DEFAULT_DISPLAY,
  DEFAULT_LEAD,
  DEFAULT_PILL,
  DISPLAY_IDS,
  LEAD_IDS,
  parseDisplayId,
  parseLeadId,
  parsePillId,
} from './typePairings';

describe('parseDisplayId', () => {
  it('accepts known headline faces', () => {
    for (const id of DISPLAY_IDS) expect(parseDisplayId(id)).toBe(id);
  });

  it('falls back for junk', () => {
    expect(parseDisplayId(null)).toBe(DEFAULT_DISPLAY);
    expect(parseDisplayId('comic-sans')).toBe(DEFAULT_DISPLAY);
  });
});

describe('parseLeadId', () => {
  it('accepts known lead faces', () => {
    for (const id of LEAD_IDS) expect(parseLeadId(id)).toBe(id);
  });

  it('falls back for junk', () => {
    expect(parseLeadId(null)).toBe(DEFAULT_LEAD);
    expect(parseLeadId('source')).toBe(DEFAULT_LEAD);
  });
});

describe('parsePillId', () => {
  it('parses known ids and falls back', () => {
    expect(parsePillId('silver')).toBe('silver');
    expect(parsePillId('nope')).toBe(DEFAULT_PILL);
  });
});

describe('applyType', () => {
  it('writes face attrs on the root', () => {
    const removed: string[] = [];
    const root = {
      dataset: {} as DOMStringMap,
      style: { removeProperty: (k: string) => { removed.push(k); } },
    };
    applyType(
      { display: 'cormorant', lead: 'garamond', pill: 'muted' },
      root as HTMLElement,
    );
    expect(root.dataset.display).toBe('cormorant');
    expect(root.dataset.lead).toBe('garamond');
    expect(root.dataset.pill).toBe('muted');
    expect(removed).toEqual([
      '--display-weight',
      '--lead-weight',
      '--head-size',
      '--lead-size',
    ]);
  });
});
