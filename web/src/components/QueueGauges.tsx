import type { QueueState } from '../lib/contracts';

interface Props {
  queues: QueueState | null;
}

export function QueueGauges({ queues }: Props) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-200">Queue Status</h3>
      <div className="space-y-3">
        <Gauge
          label="Side A"
          count={queues?.queue_A ?? 0}
          waitSec={queues?.wait_A_sec ?? 0}
          color="bg-green-500"
        />
        <Gauge
          label="Side B"
          count={queues?.queue_B ?? 0}
          waitSec={queues?.wait_B_sec ?? 0}
          color="bg-blue-500"
        />
      </div>
    </div>
  );
}

function Gauge({ label, count, waitSec, color }: { label: string; count: number; waitSec: number; color: string }) {
  const pct = Math.min((count / 20) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{count} veh / wait {waitSec.toFixed(0)}s</span>
      </div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-700">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
