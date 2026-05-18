import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import type { MetricsState } from '../lib/contracts';
import { TrendingDown, TrendingUp } from 'lucide-react';

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
    fixed: +k.fixedVal.toFixed(1),
    adaptive: +k.adaptiveVal.toFixed(1),
  }));

  const hasData = !!(f || a);

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Metrics: Fixed vs Adaptive</h3>
        {current && (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium border ${
            current.mode === 'adaptive'
              ? 'border-green-700 bg-green-900/30 text-green-400'
              : 'border-gray-600 bg-gray-800 text-gray-300'
          }`}>
            mode: {current.mode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} kpi={kpi} hasMetrics={!!current} />
        ))}
      </div>

      {hasData ? (
        <div className="mt-4 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4} barSize={16}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb' }}
                cursor={{ fill: 'rgba(75, 85, 99, 0.2)' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="fixed" name="Fixed" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#6b7280" />
                ))}
              </Bar>
              <Bar dataKey="adaptive" name="Adaptive" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#22c55e" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : current ? (
        <div className="mt-4 flex h-24 items-center justify-center rounded-lg bg-gray-800/30 border border-gray-700/30">
          <span className="text-xs text-gray-500">Start a scenario to compare metrics</span>
        </div>
      ) : (
        <div className="mt-4 flex h-36 items-center justify-center rounded-lg bg-gray-800/50">
          <div className="text-center">
            <div className="mx-auto mb-2 h-3 w-32 skeleton" />
            <div className="mx-auto h-3 w-24 skeleton" />
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ kpi, hasMetrics }: { kpi: KPI; hasMetrics: boolean }) {
  const { label, unit, fixedVal, adaptiveVal, lowerIsBetter } = kpi;
  const hasComparison = fixedVal > 0 && adaptiveVal > 0;
  let delta = 0;
  let improved = false;
  if (hasComparison) {
    delta = ((adaptiveVal - fixedVal) / fixedVal) * 100;
    improved = lowerIsBetter ? delta < 0 : delta > 0;
  }

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-3 transition-colors hover:border-gray-600">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 flex items-end gap-2">
        {hasMetrics ? (
          <>
            <div className="animate-count-up text-xl font-bold tabular-nums text-gray-100">
              {adaptiveVal.toFixed(1)}
              <span className="ml-0.5 text-xs font-normal text-gray-500">{unit}</span>
            </div>
            {hasComparison && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${improved ? 'text-green-400' : 'text-red-400'}`}>
                {improved ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                {Math.abs(delta).toFixed(0)}%
              </span>
            )}
          </>
        ) : (
          <div className="h-6 w-16 skeleton" />
        )}
      </div>
      {hasComparison && (
        <div className="mt-1 text-[10px] text-gray-600">
          fixed: {fixedVal.toFixed(1)} {unit}
        </div>
      )}
    </div>
  );
}
