import { useMemo } from 'react';
import type { EventLogEntry } from '../lib/contracts';

interface Props {
  events: EventLogEntry[];
}

const LEVEL_ICONS: Record<EventLogEntry['level'], string> = {
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const LEVEL_STYLES: Record<EventLogEntry['level'], string> = {
  info: 'text-[#adc7ff] drop-shadow-[0_0_5px_rgba(173,199,255,0.5)]',
  warn: 'text-[#F59E0B] drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]',
  error: 'text-[#ff5352] drop-shadow-[0_0_5px_rgba(255,83,82,0.5)]',
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
    <div className="glass-panel rounded-2xl p-6 flex flex-col max-h-[200px]">
      <div className="mb-3 flex items-center justify-between border-b border-[#414754]/30 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e2e2e6]">
          <span className="material-symbols-outlined text-[18px] text-[#adc7ff]">history</span>
          System Logs
        </h2>
        <span className="rounded-full border border-[#414754]/30 bg-[#0c0e11]/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[#c1c6d7]">
          {events.length} events
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-2">
        {grouped.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-[#c1c6d7]/60">
            No events yet
          </div>
        )}
        {grouped.map((g, i) => (
          <div key={i} className="animate-fade-in group flex items-start justify-between text-sm">
            <div className="flex items-start gap-2 text-[#c1c6d7] transition-colors group-hover:text-[#e2e2e6]">
              <span className="mt-0.5 whitespace-nowrap font-mono text-[10px] opacity-70">
                {new Date(g.event.ts * 1000).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className={`material-symbols-outlined mt-0.5 text-[14px] ${LEVEL_STYLES[g.event.level]}`}>
                {LEVEL_ICONS[g.event.level]}
              </span>
              <span className="leading-tight">{g.event.msg}</span>
            </div>
            {g.count > 1 && (
              <span className="ml-2 shrink-0 rounded border border-[#414754]/30 bg-[#0c0e11]/50 px-1.5 py-0.5 font-mono text-[10px] text-[#c1c6d7]">
                x{g.count}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
