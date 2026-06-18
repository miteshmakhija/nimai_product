import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ShieldCheck, Clock, Inbox, ChevronRight } from 'lucide-react';
import { approvalApi } from '../api';
import type { ApprovalAssignment } from '../types';

type Tab = 'pending' | 'reviewed';

export default function Approvals() {
  const nav = useNavigate();
  const [pending, setPending] = useState<ApprovalAssignment[]>([]);
  const [reviewed, setReviewed] = useState<ApprovalAssignment[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([approvalApi.queue(), approvalApi.reviewed()])
      .then(([q, r]) => {
        setPending(q.data);
        setReviewed(r.data);
      })
      .catch((e) => {
        const msg = e?.response?.data?.detail ?? e?.message ?? 'Failed to load approvals';
        setError(msg);
      });
  }, []);

  async function decide(assignmentId: string, decision: 'approved' | 'rejected', comment?: string) {
    setDeciding(assignmentId);
    try {
      await approvalApi.decide(assignmentId, decision, comment);
      // Refresh both lists
      const [q, rev] = await Promise.all([approvalApi.queue(), approvalApi.reviewed()]);
      setPending(q.data);
      setReviewed(rev.data);
    } finally {
      setDeciding(null);
    }
  }

  function promptReject(assignmentId: string) {
    const comment = window.prompt('Reason for rejection (optional):') ?? undefined;
    decide(assignmentId, 'rejected', comment || undefined);
  }

  const items = tab === 'pending' ? pending : reviewed;

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1000px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Approvals</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Review and sign off on quotes before they&apos;re issued to customers.
            </p>
          </div>
          <div className="inline-flex rounded-[12px] border border-border bg-input-background p-1">
            {(['pending', 'reviewed'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-[9px] px-4 py-2 text-[12.5px] font-semibold capitalize transition-colors ${
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t}
                {t === 'pending' && pending.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-[12px] border border-error/30 bg-error/10 px-4 py-3 text-[13px] text-error">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-[18px] border border-border bg-card p-14 text-center shadow-[var(--elevated-shadow)]">
            <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-[13px] bg-input-background text-muted-foreground">
              <Inbox className="h-[22px] w-[22px]" />
            </div>
            <div className="mb-1 text-sm font-semibold text-foreground">
              {tab === 'pending' ? "You're all caught up" : 'No reviewed items yet'}
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {tab === 'pending'
                ? 'No quotes are waiting for your approval.'
                : 'Previously approved & rejected quotes will appear here.'}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {items.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-4 rounded-[16px] border border-border bg-card p-4 pl-5 shadow-[var(--elevated-shadow)]"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${
                  a.decision === 'approved' ? 'bg-success/15 text-success' :
                  a.decision === 'rejected' ? 'bg-error/15 text-error' :
                  'bg-brand-soft text-brand'
                }`}>
                  {a.decision === 'approved' ? <Check className="h-5 w-5" strokeWidth={2.4} /> :
                   a.decision === 'rejected' ? <X className="h-5 w-5" /> :
                   <ShieldCheck className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-foreground">
                    Assignment #{a.id.slice(0, 8)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {a.decided_at
                      ? `Decided ${new Date(a.decided_at).toLocaleString()}`
                      : 'Awaiting your decision'}
                    {a.comment && <span>· &quot;{a.comment}&quot;</span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Navigate to the run — extract run_id from stage/request via the tree
                    // For now navigate to approvals detail; RunDetail shows the full tree
                    nav('/runs');
                  }}
                  className="h-[36px] rounded-[10px] border border-border bg-card px-3.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground inline-flex items-center gap-1"
                >
                  Review <ChevronRight className="h-3.5 w-3.5" />
                </button>
                {tab === 'pending' && (
                  <>
                    <button
                      disabled={deciding === a.id}
                      onClick={() => promptReject(a.id)}
                      className="inline-flex h-[36px] items-center gap-1.5 rounded-[10px] border border-error bg-transparent px-3.5 text-[12.5px] font-semibold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      disabled={deciding === a.id}
                      onClick={() => decide(a.id, 'approved')}
                      className="inline-flex h-[36px] items-center gap-1.5 rounded-[10px] bg-success px-4 text-[12.5px] font-bold text-white disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                      Approve
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
