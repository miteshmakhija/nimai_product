import React from 'react';
import './Hero.css';

const Hero = () => (
  <section id="home" className="hero">
    <div className="hero__inner">
      <div className="hero__content">
        <span className="hero__badge">AI-Powered Business Solutions</span>
        <h1>
          Intelligent AI for <br />
          <span className="hero__gradient">Modern Business</span>
        </h1>
        <p className="hero__subtitle">
          Transform your operations with purpose-built AI — from intelligent process
          analytics to fully automated procurement.
        </p>
        <div className="hero__actions">
          <a href="#products" className="btn btn-primary">Explore Products</a>
          <a href="#contact" className="btn btn-ghost">Contact Us</a>
        </div>
      </div>

      <div className="hero__visual">
        <a href="#products" className="hero__product-card hero__product-card--pi">
          <div className="hero__card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h3>Process Intelligence</h3>
            <p>Map, monitor &amp; optimise every business process with AI</p>
          </div>
        </a>
        <a href="#products" className="hero__product-card hero__product-card--rfq">
          <div className="hero__card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <div>
            <h3>RFQ Automation</h3>
            <p>End-to-end procurement automation from request to award</p>
          </div>
        </a>
        <a href="#products" className="hero__product-card hero__product-card--ts">
          <div className="hero__card-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="9" width="7" height="9" rx="1" />
              <rect x="15" y="9" width="7" height="9" rx="1" strokeDasharray="2.5 1.5" />
              <path d="M9 13h6" strokeDasharray="2 1.5" />
              <polyline points="2,7 5,4 8,6 12,2 16,4 19,2 22,4" strokeWidth="1.6" />
            </svg>
          </div>
          <div>
            <h3>TwinSight</h3>
            <p>Predict failures &amp; simulate futures with Physical AI &amp; digital twins</p>
          </div>
        </a>
      </div>
    </div>
  </section>
);

export default Hero;
