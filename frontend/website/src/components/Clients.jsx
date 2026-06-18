import React from 'react';
import './Clients.css';

const CLIENTS = [
  {
    name: 'ACME',
    logo: '/customer_logo/acme_logo.png',
    sector: 'Manufacturing & Engineering',
  },
  {
    name: 'Varroc',
    logo: '/customer_logo/varroc_logo.png',
    sector: 'Automotive Components',
  },
  {
    name: 'LTTS',
    logo: '/customer_logo/LTTS_logo.png',
    sector: 'Engineering Technology Services',
  },
];

const Clients = () => (
  <section id="clients" className="clients">
    <div className="section-wrapper">
      <div className="clients__header">
        <div className="section-tag">
          <span className="dot" />
          Clients &amp; Partners
        </div>
        <h2 className="clients__heading">
          Trusted by <span className="gradient-text">Industry Leaders</span>
        </h2>
        <p className="clients__subtext">
          We partner with forward-thinking companies to deliver transformative
          AI solutions across manufacturing, automotive, and technology sectors.
        </p>
      </div>

      <div className="clients__grid">
        {CLIENTS.map(({ name, logo, sector }) => (
          <div key={name} className="clients__card">
            <div className="clients__logo-wrap">
              <img
                src={logo}
                alt={`${name} logo`}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextSibling.style.display = 'flex';
                }}
              />
              <div className="clients__logo-fallback" style={{ display: 'none' }}>
                {name}
              </div>
            </div>
            <div className="clients__card-info">
              <p className="clients__card-name">{name}</p>
              <p className="clients__card-sector">{sector}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="clients__footnote">
        Delivering measurable impact across 50+ projects and 3 continents
      </p>
    </div>
  </section>
);

export default Clients;
