import React from 'react';
import './Footer.css';

const YEAR = new Date().getFullYear();

const Footer = () => (
  <footer className="footer">
    <div className="footer__inner">
      <div className="footer__brand">
        <img src="/logo/nimai-03-lockup-light.png" alt="Nimai AI" className="footer__logo" />
        <p>
          AI-powered solutions for intelligent process management
          and procurement automation.
        </p>
        <address className="footer__address">
          WeWork Futura Magarpatta,<br />
          Magarpatta Road, Kirtane Baugh,<br />
          Hadapsar, Pune — 411028<br />
          Maharashtra, India
        </address>
      </div>

      <nav className="footer__nav" aria-label="Footer navigation">
        <div className="footer__col">
          <h4>Products</h4>
          <ul>
            <li><a href="#products">Process Intelligence</a></li>
            <li><a href="#products">RFQ Automation</a></li>
          </ul>
        </div>
        <div className="footer__col">
          <h4>Company</h4>
          <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#contact">Contact Us</a></li>
          </ul>
        </div>
        <div className="footer__col">
          <h4>Reach Us</h4>
          <ul>
            <li>
              <a href="mailto:connect@nimai.ai">connect@nimai.ai</a>
            </li>
          </ul>
        </div>
      </nav>
    </div>

    <div className="footer__bottom">
      <div className="footer__bottom-inner">
        <p>&copy; {YEAR} Nimai AI Pvt. Ltd. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
