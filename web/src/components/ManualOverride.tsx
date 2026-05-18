import { useState } from 'react';
import { Play, Shield } from 'lucide-react';
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

  async function startScenario() {
    await fetch(`${API_BASE}/scenario/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenario, mode }),
    });
  }

  async function sendOverride(action: OverrideAction) {
    await fetch(`${API_BASE}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, operator: 'demo' }),
    });
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-200">Control Panel</h3>

      <div className="space-y-3">
        {/* Scenario selector */}
        <div className="flex items-center gap-2">
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
            className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          {/* Mode toggle */}
          <button
            onClick={() => setMode(mode === 'fixed' ? 'adaptive' : 'fixed')}
            className={`rounded px-2 py-1 text-xs font-medium ${
              mode === 'adaptive'
                ? 'bg-green-700 text-green-100'
                : 'bg-gray-600 text-gray-200'
            }`}
          >
            {mode}
          </button>

          <button
            onClick={startScenario}
            className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500"
          >
            <Play size={12} /> Start
          </button>
        </div>

        {/* Override buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => sendOverride('FORCE_GREEN_A')}
            className="rounded bg-green-700 px-2 py-1 text-xs text-white hover:bg-green-600"
          >
            Force Green A
          </button>
          <button
            onClick={() => sendOverride('FORCE_GREEN_B')}
            className="rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-600"
          >
            Force Green B
          </button>
          <button
            onClick={() => sendOverride('ALL_RED')}
            className="flex items-center gap-1 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600"
          >
            <Shield size={12} /> All Red
          </button>
        </div>
      </div>
    </div>
  );
}
