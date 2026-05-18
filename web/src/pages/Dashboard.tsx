import { useEffect, useState } from 'react';
import { useTrafficStore } from '../store/trafficStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDemoMode } from '../hooks/useDemoMode';
import { ThreeScene } from '../components/ThreeScene';
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
  const [activeNav, setActiveNav] = useState<'overview' | 'analytics' | 'settings' | 'history' | 'camera'>('overview');

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const vehiclesInZone = midzone?.vehicles_in_zone.length ?? 0;
  const queueA = queues?.queue_A ?? 0;
  const queueB = queues?.queue_B ?? 0;

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-[#080a0d]">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <ThreeScene
          phase={phase?.phase ?? null}
          queueA={queueA}
          queueB={queueB}
          vehiclesInZone={vehiclesInZone}
        />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col p-8 gap-6">
        {/* Top Row */}
        <div className="flex justify-between items-start w-full gap-6">
          {/* Branding panel */}
          <div className="glass-panel pointer-events-auto rounded-2xl p-6 flex flex-col gap-2">
            <div className="flex items-center gap-4 mb-1">
              <span
                className="material-symbols-outlined text-primary text-[28px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                schema
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-primary holo-text leading-none">
                CORRIDOR PRO
              </h1>
            </div>
            <div className="text-xl font-black tracking-tight text-on-surface leading-tight">
              Reversible Corridor Control
              <span className="block text-sm font-normal text-on-surface-variant mt-1">
                Adaptive traffic management system
              </span>
            </div>
          </div>

          {/* Status panel */}
          <div className="glass-panel pointer-events-auto rounded-2xl p-4 flex items-center gap-6">
            <div className="flex flex-col gap-2 items-end border-r border-outline-variant/30 pr-6">
              {status === 'connected' ? (
                <div className="flex items-center gap-2 text-secondary-fixed text-xs font-bold tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse shadow-[0_0_8px_#26fedc]"></span>
                  System Live
                </div>
              ) : isDemo ? (
                <div className="flex items-center gap-2 text-tertiary text-xs font-bold tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_#ffb3ae]"></span>
                  Demo Mode
                </div>
              ) : (
                <div className="flex items-center gap-2 text-error text-xs font-bold tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-error"></span>
                  {status}
                </div>
              )}
              <div className="text-[11px] font-bold tracking-wider text-on-surface-variant uppercase">
                System Admin
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase ${
                  status === 'connected'
                    ? 'bg-secondary-fixed/10 text-secondary-fixed border border-secondary-fixed/30 shadow-[0_0_10px_rgba(38,254,220,0.1)]'
                    : 'bg-tertiary/10 text-tertiary border border-tertiary/30'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {status === 'connected' ? 'wifi' : 'wifi_off'}
                </span>
                {status === 'connected' ? 'Connected' : isDemo ? 'Simulated' : 'Offline'}
              </div>

              {phase && (
                <div className="bg-surface-container/50 px-4 py-1.5 rounded-lg border border-outline-variant/50 text-xs font-mono text-on-surface backdrop-blur-md tracking-wide">
                  STATE: {phase.phase}
                </div>
              )}

              <button
                onClick={toggleFullscreen}
                className="glass-button w-10 h-10 rounded-lg flex items-center justify-center text-on-surface hover:text-primary"
                title="Toggle fullscreen (F)"
              >
                <span className="material-symbols-outlined">fullscreen</span>
              </button>
            </div>
          </div>
        </div>

        {/* Middle: floating columns */}
        <div className="flex-1 flex justify-between items-stretch gap-6 pointer-events-none">
          {/* Left column */}
          <div className="w-[480px] flex flex-col gap-6 justify-end pb-12 pointer-events-none">
            <div className="pointer-events-auto">
              <PhaseTimeline
                history={phaseHistory}
                currentPhase={phase?.phase ?? null}
                currentPhaseStartedAt={phase?.phase_started_at ?? null}
              />
            </div>
            <div className="pointer-events-auto">
              <MetricsPanel
                current={metrics}
                fixed={fixedMetrics}
                adaptive={adaptiveMetrics}
              />
            </div>
          </div>

          {/* Right column */}
          <div className="w-[400px] flex flex-col gap-6 justify-end pb-12 pointer-events-none">
            <div className="pointer-events-auto">
              <QueueGauges queues={queues} />
            </div>
            <div className="pointer-events-auto">
              <ManualOverride />
            </div>
            <div className="pointer-events-auto">
              <EventLog events={events} />
            </div>
          </div>
        </div>

        {/* Floating Navigation Dock */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-outline-variant/40">
            <NavButton
              active={activeNav === 'overview'}
              onClick={() => setActiveNav('overview')}
              icon="dashboard"
              title="Overview"
              filled
            />
            <div className="w-px h-6 bg-outline-variant/30 mx-1" />
            <NavButton
              active={activeNav === 'analytics'}
              onClick={() => setActiveNav('analytics')}
              icon="bar_chart"
              title="Analytics"
            />
            <NavButton
              active={activeNav === 'settings'}
              onClick={() => setActiveNav('settings')}
              icon="settings"
              title="Settings"
            />
            <NavButton
              active={activeNav === 'history'}
              onClick={() => setActiveNav('history')}
              icon="history"
              title="History"
            />
            <div className="w-px h-6 bg-outline-variant/30 mx-1" />
            <button
              onClick={() => setActiveNav('camera')}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${
                activeNav === 'camera'
                  ? 'bg-secondary-fixed/20 text-secondary-fixed border border-secondary-fixed/30 shadow-[0_0_15px_rgba(38,254,220,0.2)]'
                  : 'text-secondary-fixed hover:text-secondary hover:bg-secondary-fixed/10'
              }`}
              title="Live Camera"
            >
              <span className="material-symbols-outlined">videocam</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  filled?: boolean;
}

function NavButton({ active, onClick, icon, title, filled }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 ${
        active
          ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(173,199,255,0.2)]'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50'
      }`}
      title={title}
    >
      <span
        className="material-symbols-outlined"
        style={filled && active ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
    </button>
  );
}
