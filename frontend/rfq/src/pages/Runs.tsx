import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { rfqApi } from '../api';
import type { RfqRun } from '../types';
import { StatusBadge, getCombinedStatus } from '../components/StatusBadge';

type Filter =
  | 'all'
  | 'Processing…'
  | 'Action Required'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Sent to Customer'
  | 'Customer Approved'
  | 'Failed';

const FILTER_LABELS: Filter[] = [
  'all',
  'Processing…',
  'Action Required',
  'Awaiting Approval',
  'Approved',
  'Sent to Customer',
  'Customer Approved',
  'Failed',
];

export default function Runs() {
  const [runs, setRuns] = useState<RfqRun[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    const fetch = () => rfqApi.list().then((r) => setRuns(r.data)).catch(() => {});
    fetch();
    const iv = setInterval(fetch, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return runs.filter((r) => {
      if (filter !== 'all' && getCombinedStatus(r).label !== filter) return false;
      if (q && !(
        r.id.toLowerCase().includes(q) ||
        (r.meta_company_name ?? '').toLowerCase().includes(q) ||
        (r.meta_product ?? '').toLowerCase().includes(q)
      )) return false;
      const created = new Date(r.created_at).getTime();
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }, [runs, filter, query, dateFrom, dateTo]);

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1140px]">
        {/* Header */}
        <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Quotation Runs</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              History of your submitted quotations{' '}
              <span className="text-muted-foreground/70">· {runs.length} total</span>
            </p>
          </div>
          {/* Search + date range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-[38px] min-w-[220px] items-center gap-2 rounded-[11px] border border-border bg-card px-3">
              <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search runs…"
                className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From date"
              className="h-[38px] rounded-[11px] border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-brand"
            />
            <span className="text-[12px] text-muted-foreground">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To date"
              className="h-[38px] rounded-[11px] border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTER_LABELS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-[13px] py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? 'bg-brand font-semibold text-white'
                    : 'border border-border bg-card font-medium text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-[12px] text-muted-foreground">
              No runs match your filters.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="px-[22px] py-3 font-semibold">ID</th>
                  <th className="px-[22px] py-3 font-semibold">Company</th>
                  <th className="px-[22px] py-3 font-semibold">Product</th>
                  <th className="px-[22px] py-3 font-semibold">Type</th>
                  <th className="px-[22px] py-3 font-semibold">Status</th>
                  <th className="px-[22px] py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => nav(`/runs/${run.id}`)}
                    className="cursor-pointer border-b border-border text-[13px] last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-[22px] py-3.5 font-mono text-[12px] text-muted-foreground">{run.id.slice(0, 8)}</td>
                    <td className="px-[22px] py-3.5 font-medium text-foreground">{run.meta_company_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-[22px] py-3.5 text-muted-foreground">{run.meta_product ?? '—'}</td>
                    <td className="px-[22px] py-3.5 capitalize text-muted-foreground">{run.input_type}</td>
                    <td className="px-[22px] py-3.5"><StatusBadge run={run} /></td>
                    <td className="px-[22px] py-3.5 text-[12.5px] text-muted-foreground">{new Date(run.created_at).toLocaleString()}</td>
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
