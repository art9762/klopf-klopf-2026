import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { MetricsState } from '../lib/contracts';

interface Props {
  current: MetricsState | null;
  fixed: MetricsState | null;
  adaptive: MetricsState | null;
}

interface KPI {
  label: string;
  unit: string;
  fixedVal: number;
  adaptiveVal: number;
  lowerIsBetter: boolean;
}

export function MetricsPanel({ current, fixed, adaptive }: Props) {
  const f = fixed;
  const a = adaptive;

  const kpis: KPI[] = [
    {
      label: 'Avg Delay',
      unit: 's',
      fixedVal: f ? (f.avg_delay_A + f.avg_delay_B) / 2 : 0,
      adaptiveVal: a ? (a.avg_delay_A + a.avg_delay_B) / 2 : 0,
      lowerIsBetter: true,
    },
    {
      label: 'Max Queue',
      unit: 'veh',
      fixedVal: f ? Math.max(f.max_queue_A, f.max_queue_B) : 0,
      adaptiveVal: a ? Math.max(a.max_queue_A, a.max_queue_B) : 0,
      lowerIsBetter: true,
    },
    {
      label: 'Throughput',
      unit: '/hr',
      fixedVal: f?.throughput_per_hour ?? 0,
      adaptiveVal: a?.throughput_per_hour ?? 0,
      lowerIsBetter: false,
    },
    {
      label: 'Unsafe Switches',
      unit: '',
      fixedVal: f?.unsafe_switches ?? 0,
      adaptiveVal: a?.unsafe_switches ?? 0,
      lowerIsBetter: true,
    },
  ];

  const chartData = kpis.map((k) => ({
    name: k.label,
    fixed: k.fixedVal,
    adaptive: k.adaptiveVal,
  }));

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Metrics: Fixed vs Adaptive</h3>
        {current && (
          <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
            mode: {current.mode}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} kpi={kpi} />
        ))}
      </div>
      {(f || a) && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="fixed" name="Fixed" radius={[2, 2, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#6b7280" />
                ))}
              </Bar>
              <Bar dataKey="adaptive" name="Adaptive" radius={[2, 2, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#22c55e" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function KPICard({ kpi }: { kpi: KPI }) {
  const { label, unit, fixedVal, adaptiveVal, lowerIsBetter } = kpi;
  const hasData = fixedVal > 0 || adaptiveVal > 0;
  let delta = 0;
  let improved = false;
  if (hasData && fixedVal > 0) {
    delta = ((adaptiveVal - fixedVal) / fixedVal) * 100;
    improved = lowerIsBetter ? delta < 0 : delta > 0;
  }

  return (
    <div className="rounded-md border border-gray-700 bg-gray-800 p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 flex items-end gap-2">
        <div className="text-lg font-bold text-gray-100">
          {hasData ? adaptiveVal.toFixed(1) : '—'}
          <span className="text-xs text-gray-400"> {unit}</span>
        </div>
        {hasData && fixedVal > 0 && (
          <span className={`text-xs font-medium ${improved ? 'text-green-400' : 'text-red-400'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
          </span>
        )}
      </div>
      {hasData && (
        <div className="mt-1 text-[10px] text-gray-500">
          fixed: {fixedVal.toFixed(1)} {unit}
        </div>
      )}
    </div>
  );
}
