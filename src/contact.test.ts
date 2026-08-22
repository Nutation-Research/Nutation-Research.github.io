import { describe, it, expect } from 'vitest';
import { CONTACT_EMAIL, copyLabel, mailtoHref } from './contact';

describe('contact', () => {
  it('points mailto at the public address', () => {
    expect(CONTACT_EMAIL).toBe('contact@nutationresearch.com');
    expect(mailtoHref(CONTACT_EMAIL)).toBe('mailto:contact@nutationresearch.com');
  });

  it('names the copy action, then confirms it', () => {
    expect(copyLabel(false)).toBe('copy');
    expect(copyLabel(true)).toBe('copied');
  });
});
