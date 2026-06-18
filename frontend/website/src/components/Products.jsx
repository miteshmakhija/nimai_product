import React, { useRef, useState } from 'react';
import './Products.css';

function fmt(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${sec}`;
}

function VideoPlayer({ src, accent }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  function play() {
    const v = ref.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  function pause() {
    const v = ref.current;
    if (!v) return;
    v.pause();
    setPlaying(false);
  }

  function close() {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
    setCurrent(0);
  }

  function seek(e) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrent(Number(e.target.value));
  }

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className="product-card__video-wrap">
      <video
        ref={ref}
        src={src}
        playsInline
        preload="none"
        className="product-card__video"
        onLoadedMetadata={() => setDuration(ref.current?.duration || 0)}
        onTimeUpdate={() => setCurrent(ref.current?.currentTime || 0)}
        onEnded={close}
      />

      {/* Play overlay — shown when not playing */}
      {!playing && (
        <div className="product-card__play-overlay" onClick={play} style={{ '--accent': accent }}>
          <div className="product-card__play-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          <span className="product-card__play-label">Watch demo</span>
        </div>
      )}

      {/* Controls bar — shown while playing */}
      {playing && (
        <div className="product-card__controls" style={{ '--accent': accent }}>
          {/* Play / Pause */}
          <button className="product-card__ctrl-btn" onClick={playing ? pause : play} title={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="4" height="18" rx="1" />
                <rect x="15" y="3" width="4" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="product-card__time">{fmt(current)}</span>

          {/* Seek bar */}
          <div className="product-card__seek-wrap">
            <div className="product-card__seek-track">
              <div className="product-card__seek-fill" style={{ width: `${pct}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={current}
              onChange={seek}
              className="product-card__seek-input"
            />
          </div>

          {/* Duration */}
          <span className="product-card__time">{fmt(duration)}</span>

          {/* Close */}
          <button className="product-card__ctrl-btn" onClick={close} title="Close video">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

const PRODUCTS = [
  {
    id: 'process-intelligence',
    color: '#4361ee',
    lightBg: '#eef1fd',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
    name: 'Process Intelligence',
    tagline: 'See, understand, and optimise every business process',
    description:
      'An AI-powered platform that maps, monitors, and continuously optimises your business processes. Surface bottlenecks instantly, eliminate waste, and drive measurable improvement across your entire operation.',
    features: [
      'Automated process discovery & visual mapping',
      'Real-time performance monitoring & alerts',
      'AI-driven root cause analysis',
      'Predictive optimisation recommendations',
      'Cross-department workflow visibility',
    ],
    industries: ['Manufacturing', 'Healthcare', 'Retail', 'Finance'],
    video: '/workflow/FlowInference.mp4',
  },
  {
    id: 'rfq-automation',
    color: '#10b981',
    lightBg: '#ecfdf5',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
    name: 'RFQ Automation',
    tagline: 'Streamline procurement from request to award',
    description:
      'End-to-end automation for your Request for Quotation process. Generate smart RFQs, distribute to vendors, compare bids with AI, and close deals faster — all from a single platform.',
    features: [
      'Intelligent RFQ generation from requirements',
      'Multi-vendor distribution & response tracking',
      'AI-powered bid comparison & scoring',
      'Automated compliance & audit trail',
      'Seamless ERP & procurement integration',
    ],
    industries: ['Manufacturing', 'Procurement', 'Supply Chain', 'Construction'],
  },
  {
    id: 'twinsight',
    color: '#7c3aed',
    lightBg: '#f5f3ff',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="9" width="7" height="9" rx="1" />
        <rect x="15" y="9" width="7" height="9" rx="1" strokeDasharray="2.5 1.5" />
        <path d="M9 13h6" strokeDasharray="2 1.5" />
        <polyline points="2,7 5,4 8,6 12,2 16,4 19,2 22,4" strokeWidth="1.6" />
      </svg>
    ),
    name: 'TwinSight',
    tagline: 'Predict failures, simulate futures, and act before events occur',
    description:
      'TwinSight fuses Physical AI with advanced predictive analytics to create high-fidelity digital replicas of your machinery, production lines, and facilities. Run simulations, stress-test scenarios, and forecast critical events — all in a virtual environment that mirrors your real-world operations with precision. For large manufacturing and engineering organisations, it means turning raw operational data into decisions that save time, budget, and lives.',
    features: [
      'High-fidelity digital twin modelling of assets & production lines',
      'Predictive failure detection days or weeks ahead of breakdown',
      'Real-time sensor synchronisation between physical and digital',
      'What-if scenario simulation & risk impact analysis',
      'Remaining Useful Life (RUL) estimation for critical equipment',
      'AI-driven maintenance scheduling to minimise downtime & cost',
    ],
    industries: ['Heavy Engineering', 'Automotive', 'Aerospace', 'Energy & Utilities'],
  },
];

const Products = () => (
  <section id="products" className="products">
    <div className="container">
      <div className="section-header">
        <h2>Our Products</h2>
        <p>Purpose-built AI solutions designed to solve real business challenges</p>
      </div>
      <div className="products__grid">
        {PRODUCTS.map((p) => (
          <article
            key={p.id}
            className="product-card"
            style={{ '--accent': p.color, '--accent-bg': p.lightBg }}
          >
            <div className="product-card__header">
              <div className="product-card__icon" style={{ background: p.lightBg, color: p.color }}>
                {p.icon}
              </div>
              <div>
                <h3>{p.name}</h3>
                <p className="product-card__tagline">{p.tagline}</p>
              </div>
            </div>

            <p className="product-card__desc">{p.description}</p>

            {p.video && <VideoPlayer src={p.video} accent={p.color} />}

            <ul className="product-card__features">
              {p.features.map((f) => (
                <li key={f}>
                  <span className="product-card__check" style={{ color: p.color }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="product-card__footer">
              <div className="product-card__industries">
                {p.industries.map((ind) => (
                  <span
                    key={ind}
                    className="product-card__tag"
                    style={{ color: p.color, background: p.lightBg }}
                  >
                    {ind}
                  </span>
                ))}
              </div>
              <a
                href="#contact"
                className="product-card__cta"
                style={{ background: p.color }}
              >
                Request Demo
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Products;
