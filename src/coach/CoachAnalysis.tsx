/**
 * Presentational pieces for the coach panel's "generating" experience. All of them are
 * PURE functions of elapsed time (the coachStore genStartAt clock + buildGenSchedule):
 * no internal timers, so expanding/collapsing a section never restarts or loses progress —
 * re-render with a new `elapsed` and they show the right state.
 */
import { UI_ACCENT } from './palette';
import { GEN_MS_PER_WORD } from './coachStore';

/** A small spinning ring — the per-section "generating" indicator. */
export function GenSpinner({ size = 12 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 animate-spin shrink-0"
      style={{ width: size, height: size, borderColor: `${UI_ACCENT}30`, borderTopColor: UI_ACCENT }}
    />
  );
}

/** How many words of `text` are visible `sinceTextStartMs` after its words began. */
export function wordsVisible(text: string, sinceTextStartMs: number): number {
  const total = text.split(/\s+/).filter(Boolean).length;
  if (sinceTextStartMs <= 0) return 0;
  return Math.min(total, Math.floor(sinceTextStartMs / GEN_MS_PER_WORD));
}

/** Typewriter text as a pure function of elapsed time. `sinceTextStartMs` < 0 → nothing yet;
 *  ≥ words·GEN_MS_PER_WORD → the full text (no cursor). */
export function TimedText({
  text,
  sinceTextStartMs,
  className,
  style,
}: {
  text: string;
  sinceTextStartMs: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  const n = wordsVisible(text, sinceTextStartMs);
  const done = n >= words.length;
  if (n === 0) return null;
  return (
    <p className={className ?? 'text-[12px] leading-relaxed'} style={style ?? { color: '#44403a' }}>
      {words.slice(0, n).join(' ')}
      {!done && (
        <span className="ml-px inline-block w-px h-[1em] align-[-1px] animate-pulse" style={{ background: UI_ACCENT }} />
      )}
    </p>
  );
}
