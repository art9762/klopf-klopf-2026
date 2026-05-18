import type { Phase } from '../lib/contracts';

interface PhaseHistoryEntry {
  phase: Phase;
  startedAt: number;
  endedAt: number;
}

interface Props {
  history: PhaseHistoryEntry[];
  currentPhase: Phase | null;
  currentPhaseStartedAt: number | null;
}

const PHASE_COLORS: Record<Phase, string> = {
  GREEN_A: '#10B981',
  GREEN_B: '#3B82F6',
  ALL_RED_A_to_B: '#EF4444',
  ALL_RED_B_to_A: '#EF4444',
  EMERGENCY: '#F59E0B',
  MANUAL: '#a855f7',
};

const PHASE_GLOWS: Record<Phase, string> = {
  GREEN_A: '0 0 15px rgba(16,185,129,0.3)',
  GREEN_B: '0 0 15px rgba(59,130,246,0.3)',
  ALL_RED_A_to_B: '0 0 15px rgba(239,68,68,0.3)',
  ALL_RED_B_to_A: '0 0 15px rgba(239,68,68,0.3)',
  EMERGENCY: '0 0 15px rgba(245,158,11,0.3)',
  MANUAL: '0 0 15px rgba(168,85,247,0.3)',
};

const PHASE_LABELS: Record<Phase, string> = {
  GREEN_A: 'A',
  GREEN_B: 'B',
  ALL_RED_A_to_B: 'R',
  ALL_RED_B_to_A: 'R',
  EMERGENCY: '!',
  MANUAL: 'M',
};

const WINDOW_SEC = 300;

const LEGEND: { phase: Phase; label: string; color: string }[] = [
  { phase: 'GREEN_A', label: 'Grn A', color: '#10B981' },
  { phase: 'GREEN_B', label: 'Grn B', color: '#3B82F6' },
  { phase: 'ALL_RED_A_to_B', label: 'Red', color: '#EF4444' },
];

export function PhaseTimeline({ history, currentPhase, currentPhaseStartedAt }: Props) {
  const now = Date.now() / 1000;
  const windowStart = now - WINDOW_SEC;

  const segments: { phase: Phase; start: number; end: number; isCurrent: boolean }[] = [];

  for (const entry of history) {
    if (entry.endedAt < windowStart) continue;
    segments.push({
      phase: entry.phase,
      start: Math.max(entry.startedAt, windowStart),
      end: entry.endedAt,
      isCurrent: false,
    });
  }

  if (currentPhase && currentPhaseStartedAt) {
    segments.push({
      phase: currentPhase,
      start: Math.max(currentPhaseStartedAt, windowStart),
      end: now,
      isCurrent: true,
    });
  }

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e2e2e6]">
          <span className="material-symbols-outlined text-[18px] text-[#adc7ff]">timeline</span>
          Phase Timeline (5 min)
        </h2>
        <div className="flex gap-3 text-[10px] font-bold uppercase tracking-[0.05em] text-[#c1c6d7]">
          {LEGEND.map(({ phase, label, color }) => (
            <div key={phase} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex h-10 w-full overflow-hidden rounded-lg border border-[#414754]/30 bg-[#0c0e11]/50 shadow-inner backdrop-blur-sm">
        {segments.length === 0 && (
          <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.05em] text-[#c1c6d7]/60">
            Waiting for data...
          </div>
        )}
        {segments.map((seg, i) => {
          const width = ((seg.end - seg.start) / WINDOW_SEC) * 100;
          if (width < 0.3) return null;
          return (
            <div
              key={i}
              className="flex h-full items-center justify-center border-l border-[#0c0e11]/50 text-[10px] font-bold uppercase tracking-[0.05em] text-white backdrop-blur-md transition-all first:border-l-0"
              style={{
                width: `${width}%`,
                backgroundColor: `${PHASE_COLORS[seg.phase]}cc`,
                minWidth: '2px',
                boxShadow: seg.isCurrent ? PHASE_GLOWS[seg.phase] : undefined,
              }}
            >
              {width > 4 ? PHASE_LABELS[seg.phase] : ''}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between px-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[#c1c6d7]">
        <span>-5:00</span>
        <span>-2:30</span>
        <span className="holo-text text-[#adc7ff]">now</span>
      </div>
    </div>
  );
}
