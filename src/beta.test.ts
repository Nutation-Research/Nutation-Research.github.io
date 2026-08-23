import { describe, it, expect } from 'vitest';
import { isConfigured, statusText } from './beta';

describe('isConfigured', () => {
  it('rejects the placeholder endpoint', () => {
    expect(isConfigured('https://formspree.io/f/YOUR_FORM_ID')).toBe(false);
  });

  it('accepts a real-looking Formspree endpoint', () => {
    expect(isConfigured('https://formspree.io/f/abcdwxyz')).toBe(true);
  });

  it('rejects a non-Formspree URL', () => {
    expect(isConfigured('https://example.com/f/abcdwxyz')).toBe(false);
  });
});

describe('statusText', () => {
  it('describes each state while configured', () => {
    expect(statusText('idle', true)).toBe('');
    expect(statusText('pending', true)).toBe('Sending…');
    expect(statusText('ok', true)).toBe("Thanks — we'll be in touch.");
    expect(statusText('error', true)).toBe('Something went wrong. Please try again, or email us directly.');
  });

  it('names the setup gap instead of a generic error when unconfigured', () => {
    expect(statusText('error', false)).toBe("This form isn't connected yet — email us directly in the meantime.");
  });
});
