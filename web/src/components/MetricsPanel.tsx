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
  icon: string;
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
      icon: 'timer',
      fixedVal: f ? (f.avg_delay_A + f.avg_delay_B) / 2 : 0,
      adaptiveVal: a ? (a.avg_delay_A + a.avg_delay_B) / 2 : 0,
      lowerIsBetter: true,
    },
    {
      label: 'Max Queue',
      unit: 'veh',
      icon: 'queue',
      fixedVal: f ? Math.max(f.max_queue_A, f.max_queue_B) : 0,
      adaptiveVal: a ? Math.max(a.max_queue_A, a.max_queue_B) : 0,
      lowerIsBetter: true,
    },
    {
      label: 'Throughput',
      unit: '/hr',
      icon: 'speed',
      fixedVal: f?.throughput_per_hour ?? 0,
      adaptiveVal: a?.throughput_per_hour ?? 0,
      lowerIsBetter: false,
    },
    {
      label: 'Unsafe Switches',
      unit: '',
      icon: 'warning',
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
    <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#e2e2e6]">
          <span className="material-symbols-outlined text-[18px] text-[#adc7ff]">monitoring</span>
          Metrics: Fixed vs Adaptive
        </h2>
        {current && (
          <span
            className={`rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-[0.05em] border ${
              current.mode === 'adaptive'
                ? 'bg-[#26fedc]/10 border-[#26fedc]/30 text-[#26fedc] shadow-[0_0_8px_rgba(38,254,220,0.1)]'
                : 'bg-[#0c0e11]/50 border-[#414754]/50 text-[#c1c6d7]'
            }`}
          >
            mode: {current.mode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} kpi={kpi} hasMetrics={!!current} />
        ))}
      </div>

      {hasData ? (
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4} barSize={16}>
              <XAxis dataKey="name" tick={{ fill: '#c1c6d7', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#c1c6d7', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(12,14,17,0.9)',
                  border: '1px solid rgba(65,71,84,0.5)',
                  borderRadius: '8px',
                  backdropFilter: 'blur(8px)',
                }}
                labelStyle={{ color: '#e2e2e6' }}
                itemStyle={{ color: '#c1c6d7' }}
                cursor={{ fill: 'rgba(173,199,255,0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#c1c6d7' }} />
              <Bar dataKey="fixed" name="Fixed" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#8b90a0" />
                ))}
              </Bar>
              <Bar dataKey="adaptive" name="Adaptive" radius={[3, 3, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="#26fedc" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : current ? (
        <div className="flex h-24 items-center justify-center rounded-xl border border-[#414754]/30 bg-[#0c0e11]/40 backdrop-blur-md">
          <span className="text-xs text-[#c1c6d7]/70">Start a scenario to compare metrics</span>
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-xl border border-[#414754]/30 bg-[#0c0e11]/40 backdrop-blur-md">
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
  const { label, unit, icon, fixedVal, adaptiveVal, lowerIsBetter } = kpi;
  const hasComparison = fixedVal > 0 && adaptiveVal > 0;
  let delta = 0;
  let improved = false;
  if (hasComparison) {
    delta = ((adaptiveVal - fixedVal) / fixedVal) * 100;
    improved = lowerIsBetter ? delta < 0 : delta > 0;
  }

  return (
    <div className="rounded-xl border border-[#414754]/30 bg-[#0c0e11]/40 p-4 backdrop-blur-md transition-colors hover:bg-[#0c0e11]/60">
      <div className="mb-1 flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.05em] text-[#c1c6d7]">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 flex items-end gap-2">
        {hasMetrics ? (
          <>
            <div className="animate-count-up text-[24px] font-light tabular-nums leading-none text-white">
              {adaptiveVal.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-[#c1c6d7]">{unit}</span>
            </div>
            {hasComparison && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  improved ? 'text-[#26fedc]' : 'text-[#ff5352]'
                }`}
              >
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
        <div className="mt-1 text-[10px] text-[#c1c6d7]/70">
          fixed: {fixedVal.toFixed(1)} {unit}
        </div>
      )}
    </div>
  );
}
