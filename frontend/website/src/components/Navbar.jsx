import React, { useState, useEffect } from 'react';
import './Navbar.css';

const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#products', label: 'Products' },
  { href: '#consulting', label: 'Consulting' },
  { href: '#services', label: 'Services' },
  { href: '#contact', label: 'Contact' },
];

const Navbar = ({ onLoginClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <a href="#home" className="navbar__logo" onClick={closeMenu}>
          <img src="/logo/nimai-03-lockup-light.svg" alt="Nimai AI" />
          <span className="navbar__tagline">Orchestrating Intelligent Processes</span>
        </a>

        <nav className={`navbar__nav${menuOpen ? ' navbar__nav--open' : ''}`} aria-label="Main navigation">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="navbar__link" onClick={closeMenu}>
              {label}
            </a>
          ))}
          <button
            className="navbar__login"
            onClick={() => { onLoginClick(); closeMenu(); }}
          >
            Client Login
          </button>
        </nav>

        <button
          className={`navbar__hamburger${menuOpen ? ' navbar__hamburger--open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
