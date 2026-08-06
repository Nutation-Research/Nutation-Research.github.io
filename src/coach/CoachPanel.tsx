/**
 * CoachPanel — the coaching view shown in the sidebar when an element's "Coach" button is
 * pressed. It layers an interpretability read of the GOE: why the panel scored it,
 * bullet-by-bullet against the ISU +GOE guidelines, plus technique-specific advice and any
 * technical-panel call (e.g. an unclear edge). Content is hand-authored per element
 * (coachContent.ts).
 *
 * The text "generates" like a live model: one wall clock (coachStore.genStartAt, started when
 * the motion trail first appears) drives a sequential per-section schedule (summary → callout →
 * bullets). Each section shows a small spinner while generating and a check when done; expand a
 * row to see its typewriter text. All of it is a pure function of elapsed time, so
 * collapsing/expanding never restarts progress.
 */
import { ArrowLeft, GraduationCap, AlertTriangle, Check, Minus, X, RotateCcw, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Panel } from './Panel';
import { useArtifactStore } from './artifactStore';
import { useVideoStore } from './videoStore';
import {
  useCoachStore,
  buildGenSchedule,
  genStatusOf,
  GEN_MS_PER_WORD,
  type GenSection,
  type GenStatus,
  type CoachFocus,
} from './coachStore';
import { coachContentFor, type BulletStatus, type CoachBullet, type CoachCallout } from './coachContent';
import type { EventRow } from './decode';
import { TimedText, GenSpinner, wordsVisible } from './CoachAnalysis';
import {
  UI_ACCENT,
  UI_POS,
  UI_NEG,
  UI_WARN,
  UI_JUDGE,
} from './palette';

const STATUS_META: Record<BulletStatus, { color: string; Icon: typeof Check; label: string }> = {
  met: { color: UI_POS, Icon: Check, label: 'earned' },
  partial: { color: UI_WARN, Icon: Minus, label: 'partial' },
  missed: { color: UI_JUDGE, Icon: X, label: 'not earned' },
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fmtGoe = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

/** Quiet inline action — the "illustrate on trail" / "highlight" affordances. */
function InlineAction({ color, onClick, children }: { color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="text-[10px] font-medium transition-colors px-2 py-1 rounded-md leading-none"
      style={{ color, background: `${color}0f`, border: `1px solid ${color}33` }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** One collapsible GOE bullet. Header always shows the title + a generation spinner / the
 *  earned-status icon; the body typewrites `why` then `improve` on the shared clock. */
function BulletRow({
  bullet,
  section,
  elapsed,
  active,
  expanded,
  onToggle,
  onIllustrate,
}: {
  bullet: CoachBullet;
  section: GenSection | undefined;
  elapsed: number | null;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onIllustrate: (f: CoachFocus) => void;
}) {
  const status: GenStatus = genStatusOf(section, elapsed);
  const sm = STATUS_META[bullet.status];
  const sinceText = section && elapsed != null ? elapsed - section.textStart : -1;
  // `improve` starts typing once `why` has fully typed.
  const whyWords = bullet.why.split(/\s+/).filter(Boolean).length;
  const whyDone = wordsVisible(bullet.why, sinceText) >= whyWords;
  const improveSince = whyDone ? sinceText - whyWords * GEN_MS_PER_WORD : -1;

  return (
    <div
      className="rounded-[10px] bg-card border overflow-hidden transition-colors"
      style={
        active
          ? { borderColor: `${UI_ACCENT}88`, boxShadow: `0 0 0 2px ${UI_ACCENT}1a` }
          : { borderColor: '#e8d4cf' }
      }
    >
      {/* header row — always visible */}
      <button
        type="button"
        className="w-full text-left flex items-center gap-2 px-2.5 py-2"
        onClick={onToggle}
        style={{ opacity: status === 'pending' ? 0.45 : 1, transition: 'opacity 300ms ease' }}
      >
        {status === 'generating' ? (
          <GenSpinner size={14} />
        ) : (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
            style={
              status === 'done'
                ? { background: `${sm.color}14`, border: `1px solid ${sm.color}55` }
                : { border: '1px solid #dbc4bd' }
            }
          >
            {status === 'done' && <sm.Icon size={10} style={{ color: sm.color }} />}
          </span>
        )}
        <span className="text-[12px] font-medium text-ink flex-1">{bullet.title}</span>
        <span className="text-[9px] font-mono uppercase tracking-[0.06em]" style={{ color: status === 'done' ? sm.color : '#a07874' }}>
          {status === 'done' ? sm.label : status === 'generating' ? 'generating' : 'queued'}
        </span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform duration-200 text-faint"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {/* expanded detail — typewrites on the shared clock */}
      {expanded && status !== 'pending' && (
        <div className="px-2.5 pb-2.5 border-t border-line">
          <div className="mt-2">
            <TimedText
              text={bullet.why}
              sinceTextStartMs={sinceText}
              className="text-[11.5px] leading-relaxed"
              style={{ color: '#57534e' }}
            />
          </div>
          {bullet.improve && whyDone && (
            <div className="flex items-start gap-1.5 mt-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] mt-0.5 shrink-0" style={{ color: UI_ACCENT }}>Fix</span>
              <TimedText
                text={bullet.improve}
                sinceTextStartMs={improveSince}
                className="text-[11.5px] leading-relaxed"
                style={{ color: '#44403a' }}
              />
            </div>
          )}
          {status === 'done' && (
            <div className="mt-2">
              <InlineAction color={UI_ACCENT} onClick={() => onIllustrate(bullet.focus)}>
                Illustrate on trail ›
              </InlineAction>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible overall GOE analysis — header shows the headline + spinner/check; body typewrites
 *  the summary only when expanded (same calm pattern as the GOE bullets). */
function SummaryRow({
  headline,
  summary,
  section,
  elapsed,
  expanded,
  onToggle,
}: {
  headline: string;
  summary: string;
  section: GenSection | undefined;
  elapsed: number | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status: GenStatus = genStatusOf(section, elapsed);
  const sinceText = section && elapsed != null ? elapsed - section.textStart : -1;

  return (
    <div className="rounded-[10px] bg-card border border-line overflow-hidden">
      <button
        type="button"
        className="w-full text-left flex items-center gap-2 px-2.5 py-2"
        onClick={onToggle}
        style={{ opacity: status === 'pending' ? 0.45 : 1, transition: 'opacity 300ms ease' }}
      >
        {status === 'generating' ? (
          <GenSpinner size={14} />
        ) : (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
            style={
              status === 'done'
                ? { background: '#1c19170a', border: '1px solid #dbc4bd' }
                : { border: '1px solid #dbc4bd' }
            }
          >
            {status === 'done' && <Check size={10} className="text-ink" />}
          </span>
        )}
        <span className="text-[12px] font-medium text-ink flex-1 leading-snug">{headline}</span>
        <span className="text-[9px] font-mono uppercase tracking-[0.06em] text-faint">
          {status === 'done' ? 'analysis' : status === 'generating' ? 'generating' : 'queued'}
        </span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform duration-200 text-faint"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {expanded && status !== 'pending' && (
        <div className="px-2.5 pb-2.5 border-t border-line">
          <TimedText
            text={summary}
            sinceTextStartMs={sinceText}
            className="mt-2 text-[12px] leading-relaxed"
            style={{ color: '#57534e' }}
          />
        </div>
      )}
    </div>
  );
}

/** Collapsible technical-panel callout (e.g. unclear edge) — same header spinner/check pattern. */
function CalloutRow({
  callout,
  section,
  elapsed,
  expanded,
  onToggle,
  active,
  revealRings,
  onIllustrate,
  onToggleRings,
}: {
  callout: CoachCallout;
  section: GenSection | undefined;
  elapsed: number | null;
  expanded: boolean;
  onToggle: () => void;
  active: boolean;
  revealRings: boolean;
  onIllustrate: () => void;
  onToggleRings: () => void;
}) {
  const status: GenStatus = genStatusOf(section, elapsed);
  const sinceText = section && elapsed != null ? elapsed - section.textStart : -1;

  return (
    <div
      className="rounded-[10px] overflow-hidden transition-shadow"
      style={{
        background: `${UI_WARN}08`,
        border: `1px solid ${UI_WARN}44`,
        boxShadow: active && revealRings ? `0 0 0 2px ${UI_WARN}26` : 'none',
      }}
    >
      <button
        type="button"
        className="w-full text-left flex items-center gap-2 px-2.5 py-2"
        onClick={onToggle}
        style={{ opacity: status === 'pending' ? 0.45 : 1, transition: 'opacity 300ms ease' }}
      >
        {status === 'generating' ? (
          <GenSpinner size={14} />
        ) : (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0"
            style={
              status === 'done'
                ? { background: `${UI_WARN}14`, border: `1px solid ${UI_WARN}55` }
                : { border: `1px solid ${UI_WARN}44` }
            }
          >
            {status === 'done' ? (
              <Check size={10} style={{ color: UI_WARN }} />
            ) : (
              <AlertTriangle size={9} style={{ color: UI_WARN }} />
            )}
          </span>
        )}
        <span className="text-[12px] font-semibold flex-1 leading-snug" style={{ color: '#7a5200' }}>
          {callout.title}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-[0.06em]" style={{ color: UI_WARN }}>
          {status === 'done' ? 'callout' : status === 'generating' ? 'generating' : 'queued'}
        </span>
        <ChevronDown
          size={13}
          className="shrink-0 transition-transform duration-200"
          style={{ color: UI_WARN, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {expanded && status !== 'pending' && (
        <div className="px-2.5 pb-2.5 border-t" style={{ borderColor: `${UI_WARN}26` }}>
          <TimedText
            text={callout.advice}
            sinceTextStartMs={sinceText}
            className="mt-2 text-[12px] leading-relaxed"
            style={{ color: '#57534e' }}
          />
          {status === 'done' && (
            <div className="flex flex-wrap gap-2 mt-2">
              <InlineAction color={UI_WARN} onClick={onIllustrate}>
                Illustrate on trail ›
              </InlineAction>
              <InlineAction color={UI_WARN} onClick={onToggleRings}>
                {revealRings ? 'Highlighting ✓' : 'Highlight on trail ›'}
              </InlineAction>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CoachPanel() {
  const elementId = useCoachStore((s) => s.elementId);
  const close = useCoachStore((s) => s.close);
  const focus = useCoachStore((s) => s.focus);
  const stage = useCoachStore((s) => s.stage);
  const setFocus = useCoachStore((s) => s.setFocus);
  const setStage = useCoachStore((s) => s.setStage);
  const genStartAt = useCoachStore((s) => s.genStartAt);
  const startGen = useCoachStore((s) => s.startGen);
  const revealRings = useCoachStore((s) => s.revealRings);
  const setRevealRings = useCoachStore((s) => s.setRevealRings);
  const elements = useArtifactStore((s) => s.elements);
  const meta = useArtifactStore((s) => s.meta);
  const resetViewRange = useArtifactStore((s) => s.resetViewRange);

  const row = elements?.rows.find((r) => (r.entity_id as number) === elementId) as EventRow | undefined;
  const content = coachContentFor(meta?.element_id, elementId ?? undefined);

  const schedule = useMemo(() => (content ? buildGenSchedule(content) : []), [content]);
  const sectionOf = (key: string) => schedule.find((s) => s.key === key);
  const summarySection = sectionOf('summary');
  const calloutSection = sectionOf('callout');
  const totalMs = schedule.length ? schedule[schedule.length - 1].end : 0;

  // Re-render on a short interval while generation is in flight (the sections/typewriters are
  // pure functions of elapsed time — this is the only clock).
  const [, force] = useReducer((n: number) => n + 1, 0);
  const elapsed = genStartAt != null ? Date.now() - genStartAt : null;
  const generating = genStartAt != null && elapsed != null && elapsed < totalMs;
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(force, 120);
    return () => clearInterval(id);
  }, [generating]);

  // Start the generation clock (once) when the trail first appears.
  useEffect(() => {
    if (stage !== 'trail' || genStartAt != null || !content) return;
    startGen();
  }, [stage, genStartAt, content, startGen]);

  // Focus the edge callout on the trail once its analysis section begins (after the summary).
  useEffect(() => {
    if (!calloutSection || elapsed == null || elapsed < calloutSection.start) return;
    if (content?.callout && focus === 'overview') setFocus(content.callout.focus);
  }, [calloutSection, elapsed, content, focus, setFocus]);

  // Which sections are expanded. Collapsed by default.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [calloutOpen, setCalloutOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    setSummaryOpen(false);
    setCalloutOpen(false);
    setOpenIdx(new Set());
  }, [elementId]);
  const toggleIdx = (i: number) =>
    setOpenIdx((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const allOpen = content != null && openIdx.size >= content.bullets.length;

  const back = () => {
    resetViewRange();
    useVideoStore.getState().setPlaying(false);
    close();
  };

  // Clicking a GOE bullet switches the trail illustration — never restarts generation.
  const illustrate = (f: CoachFocus) => {
    setFocus(f);
    setStage('trail');
    setRevealRings(false);
  };

  const summaryStatus = genStatusOf(summarySection, elapsed);

  const illustrateCallout = () => {
    if (!content?.callout) return;
    setFocus(content.callout.focus);
    setStage('trail');
    setRevealRings(false);
  };

  const toggleCalloutRings = () => {
    if (!content?.callout || genStatusOf(calloutSection, elapsed) !== 'done') return;
    if (focus !== content.callout.focus) {
      illustrateCallout();
      return;
    }
    setRevealRings(!revealRings);
  };

  const code = (row?.element_code as string | undefined) ?? '—';
  const goe = num(row?.goe);
  const sop = num(row?.score_of_panel);

  return (
    <Panel variant="raised" padding="none" className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-3 border-b border-line">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <GraduationCap size={13} style={{ color: UI_ACCENT }} />
            <span className="microlabel">Coach</span>
          </div>
          <button
            onClick={back}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] leading-none text-muted hover:text-ink hover:bg-soft transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </button>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-[22px] font-semibold text-ink leading-none tracking-[-0.01em]">{code}</div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-[9px] text-faint uppercase tracking-[0.08em]">GOE</div>
              <div className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: goe != null && goe < 0 ? UI_NEG : UI_POS }}>
                {goe == null ? '—' : fmtGoe(goe)}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-faint uppercase tracking-[0.08em]">SoP</div>
              <div className="text-[13px] font-mono font-semibold tabular-nums text-ink">{sop == null ? '—' : sop.toFixed(2)}</div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => illustrate('overview')}
          className="mt-2 inline-flex items-center gap-1.5 text-[10px] rounded-md px-1.5 py-1 leading-none transition-colors text-muted hover:text-ink"
          style={
            focus === 'overview'
              ? { color: UI_ACCENT, background: `${UI_ACCENT}0f` }
              : undefined
          }
          title="Show the full motion trail"
        >
          <RotateCcw size={11} /> Motion trail — click a bullet to illustrate it
        </button>
      </div>

      {/* Body — analysis + callout stay in a dedicated top band; GOE bullets scroll below */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-paper">
        {!content ? (
          <div className="flex-1 overflow-y-auto p-3 text-[12px] text-muted leading-relaxed">
            Coaching for this element is coming soon. (Authored coaching is wired for the triple
            flip — element #1 — and the layback spin — element #12 — for now.)
          </div>
        ) : (
          <>
            <div className="shrink-0 max-h-[52%] min-h-0 overflow-y-auto px-3 pt-3 flex flex-col gap-2">
              {summaryStatus === 'pending' ? (
                <div className="text-[11px] font-mono text-faint">waiting for the motion trail…</div>
              ) : (
                <SummaryRow
                  headline={content.headline}
                  summary={content.summary}
                  section={summarySection}
                  elapsed={elapsed}
                  expanded={summaryOpen}
                  onToggle={() => setSummaryOpen((v) => !v)}
                />
              )}

              {content.callout && (
                <CalloutRow
                  callout={content.callout}
                  section={calloutSection}
                  elapsed={elapsed}
                  expanded={calloutOpen}
                  onToggle={() => setCalloutOpen((v) => !v)}
                  active={focus === content.callout.focus}
                  revealRings={revealRings}
                  onIllustrate={illustrateCallout}
                  onToggleRings={toggleCalloutRings}
                />
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 pt-2 mt-2 border-t border-line">
              <div className="flex items-center mb-2 sticky top-0 z-[1] bg-paper py-1 -mx-3 px-3">
                <div className="microlabel">GOE bullets · why &amp; how</div>
                <button
                  type="button"
                  className="ml-auto text-[10px] text-faint hover:text-muted transition-colors"
                  onClick={() =>
                    setOpenIdx(allOpen ? new Set() : new Set(content.bullets.map((_, i) => i)))
                  }
                >
                  {allOpen ? 'collapse all' : 'expand all'}
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {content.bullets.map((b, i) => (
                  <BulletRow
                    key={i}
                    bullet={b}
                    section={sectionOf(`bullet-${i}`)}
                    elapsed={elapsed}
                    active={focus !== 'overview' && focus === b.focus}
                    expanded={openIdx.has(i)}
                    onToggle={() => toggleIdx(i)}
                    onIllustrate={illustrate}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
