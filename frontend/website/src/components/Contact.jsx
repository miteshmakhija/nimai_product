import React, { useState } from 'react';
import './Contact.css';

const CONTACT_EMAIL = 'connect@nimai.ai';

const WEB3FORMS_KEY = 'cd20bfd2-f30e-404b-9fd1-cf26f33a97de';

const OFFICE_ADDRESS = {
  lines: [
    'WeWork Futura Magarpatta,',
    'Magarpatta Road, Kirtane Baugh,',
    'Hadapsar, Pune — 411028',
    'Maharashtra, India',
  ],
  mapsUrl:
    'https://maps.google.com/maps?q=WeWork+Futura+Magarpatta,+Magarpatta+Road,+Hadapsar,+Pune,+Maharashtra+411028,+India',
  embedUrl:
    'https://maps.google.com/maps?q=WeWork+Futura+Magarpatta,+Hadapsar,+Pune+411028,+India&output=embed&z=15',
};

const INITIAL_FORM = { name: '', email: '', company: '', message: '' };

const Contact = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `[nimai.ai] Enquiry from ${form.name}${form.company ? ` — ${form.company}` : ''}`,
          from_name: form.name,
          email: form.email,
          message: `Company: ${form.company || '—'}\n\n${form.message}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus('sent');
        setForm(INITIAL_FORM);
      } else {
        throw new Error(json.message || 'Submission failed');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(`Could not send your message. Please email us directly at ${CONTACT_EMAIL}`);
    }
  };

  return (
    <section id="contact" className="contact">
      <div className="container">
        <div className="section-header">
          <h2>Get in Touch</h2>
          <p>Send us a message and we'll get back within one business day.</p>
        </div>

        <div className="contact__grid">
          {/* Form */}
          <div className="contact__form-card">
            {status === 'sent' ? (
              <div className="contact__success">
                <div className="contact__success-icon">✓</div>
                <h3>Message sent!</h3>
                <p>
                  Thank you for reaching out. Our team at{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{' '}
                  will get back to you within one business day.
                </p>
                <button
                  className="contact__reset"
                  onClick={() => setStatus('idle')}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div className="contact__row">
                  <div className="contact__field">
                    <label htmlFor="name">Full Name *</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={handleChange}
                      disabled={status === 'sending'}
                    />
                  </div>
                  <div className="contact__field">
                    <label htmlFor="email">Email Address *</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={handleChange}
                      disabled={status === 'sending'}
                    />
                  </div>
                </div>
                <div className="contact__field">
                  <label htmlFor="company">Company</label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    placeholder="Your organisation"
                    value={form.company}
                    onChange={handleChange}
                    disabled={status === 'sending'}
                  />
                </div>
                <div className="contact__field">
                  <label htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us about your project or question…"
                    value={form.message}
                    onChange={handleChange}
                    disabled={status === 'sending'}
                  />
                </div>
                {errorMsg && (
                  <p className="contact__error">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  className="contact__submit"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Info + Map */}
          <div className="contact__info">
            <div className="contact__details">
              <h3>Contact Details</h3>
              <div className="contact__detail-item">
                <span className="contact__detail-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              </div>
              <div className="contact__detail-item">
                <span className="contact__detail-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <address>
                  {OFFICE_ADDRESS.lines.map((line) => (
                    <span key={line}>{line}<br /></span>
                  ))}
                </address>
              </div>
            </div>

            <div className="contact__map">
              <iframe
                title="Nimai AI Office Location"
                src={OFFICE_ADDRESS.embedUrl}
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={OFFICE_ADDRESS.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact__maps-link"
              >
                Open in Google Maps ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
