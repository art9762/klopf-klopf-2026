import { useEffect, useState } from 'react';
import { useTrafficStore } from '../store/trafficStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { RoadCanvas } from '../components/RoadCanvas';
import { PhaseTimeline } from '../components/PhaseTimeline';
import { QueueGauges } from '../components/QueueGauges';
import { MetricsPanel } from '../components/MetricsPanel';
import { EventLog } from '../components/EventLog';
import { ManualOverride } from '../components/ManualOverride';
import { Wifi, WifiOff, Maximize, Minimize } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-950 p-4 text-gray-100">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reversible Corridor Control</h1>
          <p className="text-xs text-gray-400">Adaptive traffic management system</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            {status === 'connected' ? (
              <><Wifi size={14} className="text-green-400" /><span className="text-green-400">Live</span></>
            ) : (
              <><WifiOff size={14} className="text-red-400" /><span className="text-red-400">{status}</span></>
            )}
          </div>
          {phase && (
            <span className="rounded bg-gray-800 px-2 py-1 text-xs font-mono">
              {phase.phase}
            </span>
          )}
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            title="Toggle fullscreen (F)"
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left column - visualization */}
        <div className="space-y-4 lg:col-span-2">
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
        <div className="space-y-4">
          <QueueGauges queues={queues} />
          {!fullscreen && <ManualOverride />}
          <EventLog events={events} />
        </div>
      </div>
    </div>
  );
}
