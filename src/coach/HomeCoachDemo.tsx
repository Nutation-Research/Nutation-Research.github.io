/**
 * The landing-page embed: Yuna's real Coach experience (motion trail + GOE bullets), live and
 * clickable, scoped to one element (alysa_skate, entity_id=0, "3F!") so the data footprint stays
 * small (~5.9MB of matted cutouts + a tiny pose-data slice — no raw video, no Git LFS).
 */
import { useEffect, useState } from 'react';
import { GraduationCap, Loader2, Play } from 'lucide-react';
import { useArtifactStore, type ArtifactMeta } from './artifactStore';
import { useCoachStore } from './coachStore';
import { loadArtifactTable } from './loadTable';
import { loadCutouts, cutoutAssetUrl } from './cutouts';
import type { EventRow, EventTable } from './decode';
import { MotionTrail } from './MotionTrail';
import { CoachPanel } from './CoachPanel';

const DATA_BASE = '/data/alysa_skate';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function HomeCoachDemo() {
  const [status, setStatus] = useState<LoadState>('idle');
  const elementId = useCoachStore((s) => s.elementId);
  const open = useCoachStore((s) => s.open);
  const setStage = useCoachStore((s) => s.setStage);
  const hydrate = useArtifactStore((s) => s.hydrate);
  const cutouts = useArtifactStore((s) => s.cutouts);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const [table, elRow, meta, cutoutManifest] = await Promise.all([
        loadArtifactTable('/data/el0-table.json'),
        fetch('/data/el0-row.json').then((r) => r.json()) as Promise<EventRow>,
        fetch('/data/meta.json').then((r) => r.json()) as Promise<{ fps: number; frame_width: number; frame_height: number }>,
        loadCutouts(DATA_BASE),
      ]);
      if (cancelled) return;
      const elements: EventTable = { rows: [elRow] };
      const events: EventTable = { rows: [] };
      const fullMeta: ArtifactMeta = { element_id: 'alysa_skate', ...meta };
      hydrate({ elements, events, table, meta: fullMeta, cutouts: cutoutManifest, base: DATA_BASE });
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const start = () => {
    open(0);
    setStage('trail');
  };

  const plateUrl = cutouts?.plates?.['0'] ? cutoutAssetUrl(DATA_BASE, cutouts.plates['0']) : null;
  const active = elementId != null;

  return (
    <div className="rounded-2xl border border-line bg-well overflow-hidden flex flex-col md:flex-row md:h-[560px]">
      <div className="relative w-full aspect-video md:aspect-auto md:flex-1 md:min-w-0">
        {status !== 'ready' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin" style={{ color: '#d4789a' }} />
          </div>
        ) : !active ? (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 w-full h-full group cursor-pointer border-0 p-0"
            aria-label="Play the Coach demo"
          >
            {plateUrl && (
              <img src={plateUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover opacity-70" />
            )}
            <div className="absolute inset-0 bg-[rgba(16,14,18,0.35)] group-hover:bg-[rgba(16,14,18,0.22)] transition-colors" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(240,230,226,0.14)] border border-[rgba(240,230,226,0.4)] group-hover:scale-105 transition-transform">
                <Play size={22} style={{ color: '#f0e6e2' }} fill="#f0e6e2" />
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.08em]" style={{ color: '#d4789a' }}>
                <GraduationCap size={13} /> Coach — 3F! triple flip
              </div>
              <p className="max-w-xs text-[13px] leading-relaxed" style={{ color: 'rgba(240,230,226,0.75)' }}>
                Click to see the motion trail and click any GOE bullet to illustrate it.
              </p>
            </div>
          </button>
        ) : (
          <MotionTrail />
        )}
      </div>
      {active && (
        <div className="w-full h-[320px] md:w-[360px] md:h-full shrink-0">
          <CoachPanel />
        </div>
      )}
    </div>
  );
}
