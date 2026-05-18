import type { QueueState } from '../lib/contracts';

interface Props {
  queues: QueueState | null;
}

export function QueueGauges({ queues }: Props) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-200">Queue Status</h3>
      <div className="space-y-4">
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
  const color = pct < 30 ? 'bg-green-500' : pct < 70 ? 'bg-amber-500' : 'bg-red-500';
  const glowColor = pct < 30 ? 'shadow-green-500/20' : pct < 70 ? 'shadow-amber-500/20' : 'shadow-red-500/20';

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-300">{label}</span>
        <span className="tabular-nums text-gray-400">
          <span className="text-gray-200 font-medium">{count}</span> veh / wait <span className="text-gray-200 font-medium">{waitSec.toFixed(0)}</span>s
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${color} ${glowColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
