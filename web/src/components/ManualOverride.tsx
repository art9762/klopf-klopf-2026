import { useState } from 'react';
import { Play, Shield, Zap, ArrowLeft, ArrowRight } from 'lucide-react';
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
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-200">Control Panel</h3>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
            className="rounded-md border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 focus:border-blue-500 focus:outline-none"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={() => setMode(mode === 'fixed' ? 'adaptive' : 'fixed')}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === 'adaptive'
                ? 'bg-green-600 text-white hover:bg-green-500'
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
          >
            <Zap size={10} className="inline mr-1" />
            {mode}
          </button>

          <button
            onClick={startScenario}
            disabled={loading === 'start'}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            <Play size={12} /> Start
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => sendOverride('FORCE_GREEN_A')}
            disabled={loading === 'FORCE_GREEN_A'}
            className="flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <ArrowRight size={12} /> Force Green A
          </button>
          <button
            onClick={() => sendOverride('FORCE_GREEN_B')}
            disabled={loading === 'FORCE_GREEN_B'}
            className="flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            <ArrowLeft size={12} /> Force Green B
          </button>
          <button
            onClick={() => sendOverride('ALL_RED')}
            disabled={loading === 'ALL_RED'}
            className="flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            <Shield size={12} /> All Red
          </button>
        </div>
      </div>
    </div>
  );
}
