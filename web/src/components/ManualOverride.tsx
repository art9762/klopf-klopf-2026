import { useState } from 'react';
import type { ScenarioId, TrafficMode, OverrideAction } from '../lib/contracts';

const API_BASE = '';

const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: 'baseline', label: 'Baseline' },
  { id: 'rush_hour', label: 'Rush Hour' },
  { id: 'stuck_truck', label: 'Stuck Truck' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'comm_loss', label: 'Comm Loss' },
];

export function ManualOverride() {
  const [scenario, setScenario] = useState<ScenarioId>('rush_hour');
  const [mode, setMode] = useState<TrafficMode>('adaptive');
  const [loading, setLoading] = useState<string | null>(null);

  async function startScenario() {
    setLoading('start');
    try {
      await fetch(`${API_BASE}/scenario/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario, mode }),
      });
    } finally {
      setTimeout(() => setLoading(null), 500);
    }
  }

  async function sendOverride(action: OverrideAction) {
    setLoading(action);
    try {
      await fetch(`${API_BASE}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, operator: 'demo' }),
      });
    } finally {
      setTimeout(() => setLoading(null), 500);
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e2e2e6]">
        <span className="material-symbols-outlined text-[18px] text-[#adc7ff]">tune</span>
        Command Interface
      </h2>

      <div className="flex gap-3">
        <select
          value={scenario}
          onChange={(e) => setScenario(e.target.value as ScenarioId)}
          className="glass-button flex-1 rounded-lg border border-[#414754]/50 bg-transparent px-3 py-1.5 text-sm text-[#e2e2e6] focus:border-[#adc7ff]/50 focus:outline-none"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#1e2023]">
              {s.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setMode(mode === 'fixed' ? 'adaptive' : 'fixed')}
          className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            mode === 'adaptive'
              ? 'bg-[#10B981]/20 border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
              : 'bg-[#0c0e11]/50 border-[#414754]/50 text-[#c1c6d7] hover:bg-[#0c0e11]/70'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          {mode}
        </button>

        <button
          onClick={startScenario}
          disabled={loading === 'start'}
          className="flex items-center gap-1 rounded-lg border border-[#adc7ff]/50 bg-[#adc7ff]/20 px-3 py-1.5 text-sm text-[#adc7ff] shadow-[0_0_10px_rgba(173,199,255,0.1)] transition-colors hover:bg-[#adc7ff]/30 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Start
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => sendOverride('FORCE_GREEN_A')}
          disabled={loading === 'FORCE_GREEN_A'}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#10B981] bg-[#10B981]/80 px-2 py-2 text-sm font-medium text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] backdrop-blur-sm transition-colors hover:bg-[#10B981] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          Force A
        </button>
        <button
          onClick={() => sendOverride('FORCE_GREEN_B')}
          disabled={loading === 'FORCE_GREEN_B'}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#3B82F6] bg-[#3B82F6]/80 px-2 py-2 text-sm font-medium text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-sm transition-colors hover:bg-[#3B82F6] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Force B
        </button>
        <button
          onClick={() => sendOverride('ALL_RED')}
          disabled={loading === 'ALL_RED'}
          className="flex items-center justify-center gap-1 rounded-lg border border-[#EF4444] bg-[#EF4444]/80 px-3 py-2 text-sm font-medium text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] backdrop-blur-sm transition-colors hover:bg-[#EF4444] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">shield</span>
          All Red
        </button>
      </div>
    </div>
  );
}
