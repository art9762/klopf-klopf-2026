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
  ALL_RED: '#ef4444',
  EMERGENCY: '#f59e0b',
};

const PHASE_LABELS: Record<Phase, string> = {
  GREEN_A: 'A',
  GREEN_B: 'B',
  ALL_RED: 'RED',
  EMERGENCY: '!',
};

const WINDOW_SEC = 300;

export function PhaseTimeline({ history, currentPhase, currentPhaseStartedAt }: Props) {
  const now = Date.now() / 1000;
  const windowStart = now - WINDOW_SEC;

  const segments: { phase: Phase; start: number; end: number }[] = [];

  for (const entry of history) {
    if (entry.endedAt < windowStart) continue;
    segments.push({
      phase: entry.phase,
      start: Math.max(entry.startedAt, windowStart),
      end: entry.endedAt,
    });
  }

  if (currentPhase && currentPhaseStartedAt) {
    segments.push({
      phase: currentPhase,
      start: Math.max(currentPhaseStartedAt, windowStart),
      end: now,
    });
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
      <div className="mb-1 text-xs text-gray-400">Phase Timeline (5 min)</div>
      <div className="flex h-8 w-full overflow-hidden rounded">
        {segments.length === 0 && (
          <div className="flex h-full w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
            No data
          </div>
        )}
        {segments.map((seg, i) => {
          const width = ((seg.end - seg.start) / WINDOW_SEC) * 100;
          if (width < 0.5) return null;
          return (
            <div
              key={i}
              className="flex items-center justify-center text-xs font-bold text-white/80"
              style={{
                width: `${width}%`,
                backgroundColor: PHASE_COLORS[seg.phase],
                minWidth: '2px',
              }}
            >
              {width > 5 ? PHASE_LABELS[seg.phase] : ''}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500">
        <span>-5:00</span>
        <span>-2:30</span>
        <span>now</span>
      </div>
    </div>
  );
}
