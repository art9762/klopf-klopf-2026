import { useEffect, useState } from 'react';
import { useTrafficStore } from '../store/trafficStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDemoMode } from '../hooks/useDemoMode';
import { RoadVisualization } from '../components/RoadVisualization';
import { PhaseTimeline } from '../components/PhaseTimeline';
import { QueueGauges } from '../components/QueueGauges';
import { MetricsPanel } from '../components/MetricsPanel';
import { EventLog } from '../components/EventLog';
import { ManualOverride } from '../components/ManualOverride';

export function Dashboard() {
  const dispatch = useTrafficStore((s) => s.dispatch);
  const phase = useTrafficStore((s) => s.phase);
  const queues = useTrafficStore((s) => s.queues);
  const midzone = useTrafficStore((s) => s.midzone);
  const metrics = useTrafficStore((s) => s.metrics);
  const fixedMetrics = useTrafficStore((s) => s.fixedMetrics);
  const adaptiveMetrics = useTrafficStore((s) => s.adaptiveMetrics);
  const events = useTrafficStore((s) => s.events);
  const phaseHistory = useTrafficStore((s) => s.phaseHistory);

  const status = useWebSocket(dispatch);
  const isDemo = useDemoMode(status, dispatch, status === 'connected');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        setFullscreen((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0e11] p-6 text-[#e2e2e6] font-sans">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#adc7ff] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>schema</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#adc7ff] holo-text">CORRIDOR PRO</h1>
              <p className="text-xs text-[#8b90a0]">Adaptive traffic management system</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase ${
            status === 'connected'
              ? 'bg-[#26fedc]/10 text-[#26fedc] border border-[#26fedc]/30'
              : isDemo
              ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30'
              : 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/30'
          }`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              status === 'connected' ? 'bg-[#26fedc]' : isDemo ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
            }`} />
            {status === 'connected' ? 'Live' : isDemo ? 'Demo' : status}
          </div>

          {/* Phase badge */}
          {phase && (
            <div className="px-3 py-1.5 rounded-lg bg-[#1e2023] border border-[#414754]/50 text-xs font-mono text-[#e2e2e6]">
              {phase.phase}
            </div>
          )}

          {/* Fullscreen */}
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="glass-button w-9 h-9 rounded-lg flex items-center justify-center text-[#8b90a0] hover:text-[#adc7ff]"
          >
            <span className="material-symbols-outlined text-[18px]">
              {fullscreen ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          <RoadVisualization
            phase={phase?.phase ?? null}
            queues={queues}
            midzone={midzone}
          />
          <PhaseTimeline
            history={phaseHistory}
            currentPhase={phase?.phase ?? null}
            currentPhaseStartedAt={phase?.phase_started_at ?? null}
          />
          <MetricsPanel
            current={metrics}
            fixed={fixedMetrics}
            adaptive={adaptiveMetrics}
          />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <QueueGauges queues={queues} />
          {!fullscreen && <ManualOverride />}
          <EventLog events={events} />
        </div>
      </div>
    </div>
  );
}
