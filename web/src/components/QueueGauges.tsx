import type { QueueState } from '../lib/contracts';

interface Props {
  queues: QueueState | null;
}

export function QueueGauges({ queues }: Props) {
  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e2e2e6]">
        <span className="material-symbols-outlined text-[18px] text-[#adc7ff]">traffic</span>
        Queue Status
      </h2>
      <div className="flex flex-col gap-4">
        <Gauge
          label="Side A"
          count={queues?.queue_A ?? 0}
          waitSec={queues?.wait_A_sec ?? 0}
        />
        <Gauge
          label="Side B"
          count={queues?.queue_B ?? 0}
          waitSec={queues?.wait_B_sec ?? 0}
        />
      </div>
    </div>
  );
}

function Gauge({ label, count, waitSec }: { label: string; count: number; waitSec: number }) {
  const pct = Math.min((count / 20) * 100, 100);

  let fillColor: string;
  let glow: string;
  if (pct < 30) {
    fillColor = '#26fedc';
    glow = '0 0 10px rgba(38,254,220,0.5)';
  } else if (pct < 70) {
    fillColor = '#adc7ff';
    glow = '0 0 10px rgba(173,199,255,0.5)';
  } else {
    fillColor = '#ff5352';
    glow = '0 0 10px rgba(255,83,82,0.5)';
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end justify-between">
        <span className="text-sm text-[#e2e2e6]">{label}</span>
        <span className="text-sm tabular-nums text-[#c1c6d7]">
          <strong className="font-medium text-white">{count}</strong> veh / wait{' '}
          <strong className="font-medium text-white">{waitSec.toFixed(0)}</strong>s
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-[#414754]/30 bg-[#0c0e11]/50 shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: `${fillColor}cc`,
            boxShadow: glow,
          }}
        />
      </div>
    </div>
  );
}
