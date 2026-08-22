import { describe, it, expect } from 'vitest';
import { nextStoryBeat } from './story';

describe('nextStoryBeat', () => {
  it('walks watercolor → futures → duet, then stops', () => {
    expect(nextStoryBeat('watercolor')).toBe('futures');
    expect(nextStoryBeat('futures')).toBe('duet');
    expect(nextStoryBeat('duet')).toBeNull();
  });
});
