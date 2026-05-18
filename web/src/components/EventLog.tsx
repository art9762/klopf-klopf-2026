import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { EventLogEntry } from '../lib/contracts';

interface Props {
  events: EventLogEntry[];
}

const LEVEL_COLORS = {
  info: 'text-blue-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const LEVEL_ICONS = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
};

interface GroupedEvent {
  event: EventLogEntry;
  count: number;
}

export function EventLog({ events }: Props) {
  const grouped = useMemo(() => {
    const reversed = [...events].reverse();
    const result: GroupedEvent[] = [];
    for (const ev of reversed) {
      const last = result[result.length - 1];
      if (last && last.event.msg === ev.msg && last.event.level === ev.level) {
        last.count++;
      } else {
        result.push({ event: ev, count: 1 });
      }
    }
    return result;
  }, [events]);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Event Log</h3>
        {events.length > 0 && (
          <span className="text-[10px] text-gray-600">{events.length} events</span>
        )}
      </div>
      <div className="h-52 space-y-0.5 overflow-y-auto pr-1">
        {grouped.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-gray-600">
            No events yet
          </div>
        )}
        {grouped.map((g, i) => {
          const Icon = LEVEL_ICONS[g.event.level];
          return (
            <div key={i} className="animate-fade-in flex items-start gap-2 rounded px-1.5 py-1 text-xs hover:bg-gray-800/50">
              <span className="mt-0.5 shrink-0 text-gray-600 tabular-nums">
                {new Date(g.event.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <Icon size={12} className={`mt-0.5 shrink-0 ${LEVEL_COLORS[g.event.level]}`} />
              <span className="text-gray-300">{g.event.msg}</span>
              {g.count > 1 && (
                <span className="ml-auto shrink-0 rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                  x{g.count}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
