import type { EventLogEntry } from '../lib/contracts';

interface Props {
  events: EventLogEntry[];
}

const LEVEL_COLORS = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

export function EventLog({ events }: Props) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-200">Event Log</h3>
      <div className="h-48 space-y-1 overflow-y-auto">
        {events.length === 0 && (
          <div className="text-xs text-gray-500">No events yet</div>
        )}
        {[...events].reverse().map((ev, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="shrink-0 text-gray-500">
              {new Date(ev.ts * 1000).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 font-medium ${LEVEL_COLORS[ev.level]}`}>
              [{ev.level.toUpperCase()}]
            </span>
            <span className="text-gray-300">{ev.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
