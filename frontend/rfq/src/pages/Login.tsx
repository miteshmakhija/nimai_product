import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';

// Org slug → display info.  Logos live in /public/customer_logo/
const ORG_MAP: Record<string, { name: string; logo: string }> = {
  acme:   { name: 'ACME',   logo: '/customer_logo/acme_logo.png' },
  varroc: { name: 'Varroc', logo: '/customer_logo/varroc_logo.png' },
  ltts:   { name: 'LTTS',   logo: '/customer_logo/LTTS_logo.png' },
};

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const orgSlug = (searchParams.get('org') || '').toLowerCase();
  const orgInfo = ORG_MAP[orgSlug] ?? null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwHidden, setPwHidden] = useState(true);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPw, setFocusPw] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      nav('/');
    } catch {
      setError('Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      fontFamily: "'Inter', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      letterSpacing: '-0.01em',
      color: 'var(--foreground)',
      background: 'var(--card)',
      padding: 28,
      gap: 0,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* ── Left: form ── */}
      <div style={{
        flexShrink: 1,
        minWidth: 0,
        width: 520,
        display: 'flex',
        flexDirection: 'column',
        padding: '0 56px',
        height: '100%',
      }}>
        {/* Brand lockup — NimAI + optional org logo */}
        <div style={{ height: 108, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, padding: '6px 12px', flexShrink: 0,
            background: 'linear-gradient(135deg,#3fb6fb 0%,#2f8bf6 44%,#1f6fe6 100%)',
            boxShadow: '0 4px 12px -4px rgba(47,139,246,0.45)',
          }}>
            <img
              src="/logo/nimai-03-lockup-light.svg"
              alt="NimAI"
              style={{ height: 24, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {/* Divider + org logo (shown when org is recognised) */}
          {orgInfo && (
            <>
              <div style={{
                width: 1, height: 32,
                background: 'var(--border, rgba(0,0,0,0.1))',
                margin: '0 4px', flexShrink: 0,
              }} />
              <img
                src={orgInfo.logo}
                alt={orgInfo.name}
                style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </>
          )}
        </div>

        {/* Form block */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 392 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Welcome back{orgInfo ? `, ${orgInfo.name}` : ''}
          </h1>
          <p style={{ margin: '0 0 30px', fontSize: 14, lineHeight: 1.55, color: 'var(--muted-foreground)' }}>
            {orgInfo
              ? `Sign in to your ${orgInfo.name} quotation portal powered by NimAI.`
              : 'Sign in to generate, review, and approve techno-commercial quotations.'}
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em' }}>
              Email
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              height: 48, padding: '0 14px', borderRadius: 13,
              border: `1px solid ${focusEmail ? 'var(--brand, #2f8bf6)' : 'rgba(15,18,32,0.10)'}`,
              background: 'var(--input-background, #f3f4f8)',
              marginBottom: 18,
              transition: 'border-color .18s, box-shadow .18s',
              boxShadow: focusEmail ? '0 0 0 4px rgba(47,139,246,0.10)' : 'none',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={focusEmail ? '#2f8bf6' : 'var(--muted-foreground)'}
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transition: 'stroke .18s' }}>
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                type="email" required autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusEmail(true)}
                onBlur={() => setFocusEmail(false)}
                placeholder="you@company.com"
                style={{
                  flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                  outline: 'none', font: 'inherit', fontSize: 14,
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {/* Password */}
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em' }}>
              Password
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              height: 48, padding: '0 8px 0 14px', borderRadius: 13,
              border: `1px solid ${focusPw ? 'var(--brand, #2f8bf6)' : 'rgba(15,18,32,0.10)'}`,
              background: 'var(--input-background, #f3f4f8)',
              transition: 'border-color .18s, box-shadow .18s',
              boxShadow: focusPw ? '0 0 0 4px rgba(47,139,246,0.10)' : 'none',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={focusPw ? '#2f8bf6' : 'var(--muted-foreground)'}
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0, transition: 'stroke .18s' }}>
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={pwHidden ? 'password' : 'text'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusPw(true)}
                onBlur={() => setFocusPw(false)}
                placeholder="Enter your password"
                style={{
                  flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                  outline: 'none', font: 'inherit', fontSize: 14,
                  color: 'var(--foreground)',
                }}
              />
              <button
                type="button"
                onClick={() => setPwHidden(h => !h)}
                title="Toggle password"
                style={{
                  width: 32, height: 32, border: 'none', background: 'transparent',
                  color: 'var(--muted-foreground)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', borderRadius: 8, flexShrink: 0,
                }}
              >
                {pwHidden ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 22 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#2f8bf6', cursor: 'pointer' }}>
                Forgot password?
              </span>
            </div>

            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#dc2626', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%', height: 50, border: 'none', borderRadius: 13,
                cursor: busy ? 'not-allowed' : 'pointer',
                font: 'inherit', fontSize: 14.5, fontWeight: 700,
                letterSpacing: '-0.01em', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                background: 'linear-gradient(135deg,#3fb6fb 0%,#2f8bf6 44%,#1f6fe6 100%)',
                boxShadow: '0 10px 24px -8px rgba(47,139,246,0.6), inset 0 1px 0 rgba(255,255,255,0.28)',
                opacity: busy ? 0.7 : 1,
                transition: 'opacity .16s, box-shadow .16s',
              }}
            >
              {busy ? (
                <>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)',
                    borderTopColor: '#fff',
                    display: 'inline-block',
                    animation: 'spin .7s linear infinite',
                  }} />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p style={{ margin: '26px 0 0', textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Need access?{' '}
            <a href="mailto:connect@nimai.ai" style={{ color: '#2f8bf6', fontWeight: 600, textDecoration: 'none' }}>
              Request an account
            </a>
          </p>
        </div>

        <div style={{ height: 48, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>© 2026 NimAI · Crafted by NimAI India</span>
        </div>
      </div>

      {/* ── Right: brand panel ── */}
      <div style={{
        width: 600,
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 28,
        background: 'linear-gradient(155deg,#3a9cf8 0%,#2f8bf6 38%,#1f5fd6 70%,#163a8f 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 48px',
      }}>
        {/* Radial blooms */}
        <div style={{
          position: 'absolute', top: -120, right: -100,
          width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(127,208,255,0.45), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -160, left: -120,
          width: 380, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(31,95,214,0.5), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Org logo badge on the right panel */}
        {orgInfo && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 12, padding: '8px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <img
                src={orgInfo.logo}
                alt={orgInfo.name}
                style={{ height: 28, width: 'auto', objectFit: 'contain' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1B2A56', letterSpacing: '-0.01em' }}>
                {orgInfo.name}
              </span>
            </div>
            <img
              src="/logo/nimai-03-lockup-light.svg"
              alt="NimAI"
              style={{ height: 22, width: 'auto', objectFit: 'contain', opacity: 0.75 }}
            />
          </div>
        )}

        {/* AI pill */}
        <div style={{
          position: 'relative', display: 'inline-flex', alignSelf: 'flex-start',
          alignItems: 'center', gap: 8, padding: '7px 13px 7px 11px',
          borderRadius: 99, background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.18)', marginBottom: 28,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#7fd0ff',
            boxShadow: '0 0 0 3px rgba(127,208,255,0.25)',
            animation: 'igq-pulse 1.8s ease-in-out infinite',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.92)' }}>
            AI-powered quotation engine
          </span>
        </div>

        <h2 style={{
          position: 'relative', margin: '0 0 16px',
          fontSize: 'clamp(26px, 2.5vw, 36px)', lineHeight: 1.14,
          fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', maxWidth: 440,
        }}>
          Win More Deals with Faster, AI-Powered Quoting
        </h2>
        <p style={{
          position: 'relative', margin: '0 0 40px',
          fontSize: 16, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)', maxWidth: 430,
        }}>
          Transform RFQs into review-ready quotes in minutes, helping your team respond quickly and confidently.
        </p>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 450 }}>
          {[
            {
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
                  <path d="M20 3v4" /><path d="M22 5h-4" />
                </svg>
              ),
              title: 'Automatic spec extraction',
              desc: 'Company, product, and technical values pulled straight from the RFQ.',
            },
            {
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ),
              title: 'Review before you send',
              desc: "Every quote stays editable and is confirmed before it's generated.",
            },
            {
              icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              ),
              title: 'Built-in approvals',
              desc: 'Route quotes for sign-off and issue them with full confidence.',
            },
          ].map(f => (
            <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{f.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.74)', marginTop: 3 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes igq-pulse {
            0%,100%{opacity:1;transform:scale(1)}
            50%{opacity:.5;transform:scale(.82)}
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
