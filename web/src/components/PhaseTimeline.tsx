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
  GREEN_A: '#22c55e',
  GREEN_B: '#3b82f6',
  ALL_RED_A_to_B: '#ef4444',
  ALL_RED_B_to_A: '#ef4444',
  EMERGENCY: '#f59e0b',
  MANUAL: '#a855f7',
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
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">Phase Timeline (5 min)</span>
        <div className="flex items-center gap-3">
          {([['GREEN_A', 'Green A'], ['GREEN_B', 'Green B'], ['ALL_RED_A_to_B', 'All Red'], ['EMERGENCY', 'Emergency'], ['MANUAL', 'Manual']] as [Phase, string][]).map(([p, label]) => (
            <div key={p} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[p] }} />
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-8 w-full overflow-hidden rounded-md">
        {segments.length === 0 && (
          <div className="flex h-full w-full items-center justify-center bg-gray-800 text-xs text-gray-600">
            Waiting for data...
          </div>
        )}
        {segments.map((seg, i) => {
          const width = ((seg.end - seg.start) / WINDOW_SEC) * 100;
          if (width < 0.3) return null;
          return (
            <div
              key={i}
              className={`flex items-center justify-center text-[10px] font-bold text-white/90 transition-all ${
                seg.isCurrent ? 'animate-pulse-glow' : ''
              }`}
              style={{
                width: `${width}%`,
                backgroundColor: PHASE_COLORS[seg.phase],
                minWidth: '2px',
              }}
            >
              {width > 4 ? PHASE_LABELS[seg.phase] : ''}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-gray-600">
        <span>-5:00</span>
        <span>-2:30</span>
        <span>now</span>
      </div>
    </div>
  );
}
