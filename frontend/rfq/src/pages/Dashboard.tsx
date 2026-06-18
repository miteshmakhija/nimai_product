import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { metricsApi, rfqApi } from '../api';
import type { Metrics, RfqRun } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { List, CircleCheck, CircleX, BarChart3, Sparkles } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../AuthContext';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';

export default function Dashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [runs, setRuns] = useState<RfqRun[]>([]);

  useEffect(() => {
    metricsApi.get().then((r) => setMetrics(r.data)).catch(() => {});
    rfqApi.list().then((r) => setRuns(r.data)).catch(() => {});
  }, []);

  const firstName = (user?.full_name || user?.email || 'there').split(/[\s@]/)[0];

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1140px]">
        {/* Hero */}
        <div className="relative mb-[22px] overflow-hidden rounded-[20px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(54,148,252,0.10),transparent_60%)]" />
          <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-5 px-[30px] py-7">
            <div>
              <p className="mb-1 text-[12.5px] text-muted-foreground">{greeting()},</p>
              <h1 className="text-[30px] font-bold capitalize leading-tight tracking-[-0.03em] text-foreground">
                Welcome back, <span className="text-brand">{firstName}</span>
              </h1>
              <p className="mt-2 text-[13.5px] text-muted-foreground">
                Here&apos;s an overview of your RFQ generation activity.
              </p>
            </div>
            <Link
              to="/generate"
              className={`flex h-11 items-center gap-2 rounded-[13px] px-5 text-[13.5px] font-bold text-white shadow-[0_10px_24px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:saturate-[1.06] ${BRAND_GRADIENT}`}
            >
              <Sparkles className="h-[17px] w-[17px]" />
              New RFQ
            </Link>
          </div>
        </div>

        {/* KPIs */}
        {metrics && (
          <div className="mb-[22px] grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Total Runs" value={metrics.total} icon={<List className="h-4 w-4" />} accent="bg-brand/10 text-brand" />
            <KpiCard label="Succeeded" value={metrics.succeeded} icon={<CircleCheck className="h-4 w-4" />} accent="bg-emerald-500/10 text-emerald-500" />
            <KpiCard label="Failed" value={metrics.failed} icon={<CircleX className="h-4 w-4" />} accent="bg-red-500/10 text-red-500" />
            <KpiCard label="Success Rate" value={`${(metrics.success_rate * 100).toFixed(1)}%`} icon={<BarChart3 className="h-4 w-4" />} accent="bg-violet-500/10 text-violet-500" />
          </div>
        )}

        {/* Volume chart */}
        {metrics && metrics.volume_by_day.length > 0 && (
          <div className="mb-[22px] rounded-[18px] border border-border bg-card p-5 shadow-[var(--elevated-shadow)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
                Runs per day{' '}
                <span className="font-medium text-muted-foreground">· last 30 days</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metrics.volume_by_day}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3fb6fb" />
                    <stop offset="100%" stopColor="#2f8bf6" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: 'rgba(54,148,252,0.06)' }}
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="url(#volGrad)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent runs */}
        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          <div className="border-b border-border px-[22px] py-4 text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
            Recent runs
          </div>
          {runs.length === 0 ? (
            <p className="p-8 text-center text-[12px] text-muted-foreground">No runs yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="px-[22px] py-2.5 font-semibold">ID</th>
                  <th className="px-[22px] py-2.5 font-semibold">Company</th>
                  <th className="px-[22px] py-2.5 font-semibold">Product</th>
                  <th className="px-[22px] py-2.5 font-semibold">Status</th>
                  <th className="px-[22px] py-2.5 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 8).map((run) => (
                  <tr key={run.id} className="border-b border-border text-[13px] last:border-0 hover:bg-accent/40">
                    <td className="px-[22px] py-3 font-mono text-[12px] text-muted-foreground">{run.id.slice(0, 8)}</td>
                    <td className="px-[22px] py-3 font-medium text-foreground">{run.meta_company_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-[22px] py-3 text-muted-foreground">{run.meta_product ?? '—'}</td>
                    <td className="px-[22px] py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-[22px] py-3 text-[12.5px] text-muted-foreground">{new Date(run.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--elevated-shadow)]">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-[9px] ${accent}`}>
          {icon}
        </div>
        <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-[30px] font-bold tracking-[-0.03em] text-foreground">{value}</span>
    </div>
  );
}
