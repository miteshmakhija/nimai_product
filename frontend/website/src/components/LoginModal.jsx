import React, { useState, useEffect, useRef } from 'react';
import './LoginModal.css';

const toSlug = (value) =>
  value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const KNOWN_CLIENTS = [
  { name: 'ACME',   logo: '/customer_logo/acme_logo.png',  slug: 'acme' },
  { name: 'Varroc', logo: '/customer_logo/varroc_logo.png', slug: 'varroc' },
  { name: 'LTTS',   logo: '/customer_logo/LTTS_logo.png',   slug: 'ltts' },
];

// Dev:  http://localhost:5173
// Prod: set VITE_RFQ_URL in .env before building
const RFQ_URL = import.meta.env.VITE_RFQ_URL || 'http://localhost:5173';

const LoginModal = ({ isOpen, onClose }) => {
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      document.body.style.overflow = '';
      setOrgName('');
      setError('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const slug = toSlug(orgName);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!slug) {
      setError('Please enter your organisation name.');
      return;
    }
    window.location.href = `${RFQ_URL}/login?org=${encodeURIComponent(slug)}`;
  };

  const handleClientClick = (clientSlug) => {
    window.location.href = `${RFQ_URL}/login?org=${encodeURIComponent(clientSlug)}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="login-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="login-modal__box">
        <button className="login-modal__close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="login-modal__header">
          <div className="login-modal__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <h2 id="login-modal-title">Client Portal</h2>
          <p>Enter your organisation name to access your portal</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="login-modal__field">
            <label htmlFor="org-input">Organisation Name</label>
            <input
              id="org-input"
              ref={inputRef}
              type="text"
              value={orgName}
              onChange={(e) => { setOrgName(e.target.value); setError(''); }}
              placeholder="e.g. acme"
              autoComplete="organization"
            />
            {slug && (
              <p className="login-modal__preview">
                You'll be taken to the <strong>{slug}</strong> client portal
              </p>
            )}
            {error && <p className="login-modal__error">{error}</p>}
          </div>
          <button type="submit" className="login-modal__submit">
            Continue to Portal
          </button>
        </form>

        <div className="login-modal__clients">
          <p>Quick access</p>
          <div className="login-modal__client-list">
            {KNOWN_CLIENTS.map(({ name, logo, slug: cSlug }) => (
              <button
                key={name}
                className="login-modal__client-btn"
                onClick={() => handleClientClick(cSlug)}
                title={`${name} portal`}
              >
                <img
                  src={logo}
                  alt={name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextSibling.style.display = 'inline';
                  }}
                />
                <span style={{ display: 'none' }}>{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
