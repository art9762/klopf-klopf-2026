import { useEffect, useState } from 'react';
import { useTrafficStore } from '../store/trafficStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDemoMode } from '../hooks/useDemoMode';
import { RoadCanvas } from '../components/RoadCanvas';
import { PhaseTimeline } from '../components/PhaseTimeline';
import { QueueGauges } from '../components/QueueGauges';
import { MetricsPanel } from '../components/MetricsPanel';
import { EventLog } from '../components/EventLog';
import { ManualOverride } from '../components/ManualOverride';
import { Wifi, WifiOff, Maximize, Minimize, Radio } from 'lucide-react';

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
  const hasRealData = !!(queues && (queues.queue_A > 0 || queues.queue_B > 0)) || !!(metrics && metrics.throughput_per_hour > 0);
  const isDemo = useDemoMode(status, dispatch, hasRealData);
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
    <div className="min-h-screen bg-gray-950 p-4 text-gray-100 md:p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-gray-800 bg-gray-950/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:-mt-6 md:px-6">
        <div>
          <h1 className="text-lg font-bold tracking-tight md:text-xl">Reversible Corridor Control</h1>
          <p className="text-xs text-gray-500">Adaptive traffic management system</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {status === 'connected' ? (
              <><Wifi size={14} className="text-green-400" /><span className="text-green-400 font-medium">Live</span></>
            ) : isDemo ? (
              <><Radio size={14} className="text-amber-400 animate-pulse-glow" /><span className="text-amber-400 font-medium">Demo</span></>
            ) : (
              <><WifiOff size={14} className="text-red-400" /><span className="text-red-400">{status}</span></>
            )}
          </div>
          {phase && (
            <span className="rounded-md bg-gray-800 px-2.5 py-1 text-xs font-mono font-medium text-gray-200 border border-gray-700">
              {phase.phase}
            </span>
          )}
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
            title="Toggle fullscreen (F)"
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {/* Left column - visualization */}
        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          <RoadCanvas
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

        {/* Right column - controls & logs */}
        <div className="space-y-4 lg:space-y-5">
          <QueueGauges queues={queues} />
          {!fullscreen && <ManualOverride />}
          <EventLog events={events} />
        </div>
      </div>
    </div>
  );
}
