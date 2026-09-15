// resources/js/Pages/Landing.jsx
import { useState } from 'react';
import { Head } from '@inertiajs/react';

import '../../css/landing.css';

import HeroSlideshow from '@/Components/HeroSlideshow';
import LoginModal from '@/Components/LoginModal';
import { workflowSteps } from '@/data/workflowSteps';
import { useReveal } from '@/hooks/useReveal';
import { useScrollSpy } from '@/hooks/useScrollSpy';

const SLIDES = [1, 2, 3, 4, 5].map((n) => ({
  src: `/img/slideshow_img/slideshow_${n}.jpg`,
  alt: `Slide ${n}`,
}));

const ABOUT_PHOTOS = [1, 2, 3, 4].map((n) => ({
  src: `/img/about_img/${n}.jpg`,
  alt: `Healthcare image ${n}`,
}));

const ABOUT_FEATURES = [
  'Centralized patient registration',
  'Real-time flagging of suspicious cases',
  'Digital diagnostic assessment',
  'Tracking patient treatment progress',
];

const SECTION_IDS = ['about', 'workflow'];

/**
 * CareLink TB landing page.
 *
 * Markup and class names are the original landing page's; the styles live in
 * resources/css/landing.css, scoped under `.cl-landing`.
 */
export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false);
  const { activeSection, scrolled } = useScrollSpy(SECTION_IDS);

  useReveal();

  function scrollToSection(e, id) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="cl-landing">
      <Head title="CareLink TB" />

      {/* ── NAVBAR ── */}
      <nav className={scrolled ? 'scrolled' : ''}>
        <a href="#" className="nav-logo">
          <img className="nav-logo-icon" src="/img/logo_img/carelink_logo.svg" alt="" />
          CareLink TB
        </a>

        <div className="nav-links">
          <a
            href="#about"
            className={activeSection === 'about' ? 'active-link' : ''}
            onClick={(e) => scrollToSection(e, 'about')}
          >
            About CareLink
          </a>
          <a
            href="#workflow"
            className={activeSection === 'workflow' ? 'active-link' : ''}
            onClick={(e) => scrollToSection(e, 'workflow')}
          >
            CareLink Workflow
          </a>
          <button type="button" className="btn-login" onClick={() => setLoginOpen(true)}>
            Log in
          </button>
        </div>
      </nav>

      {/* ── HERO / SLIDESHOW ── */}
      <HeroSlideshow
        slides={SLIDES}
        eyebrow="Connecting People. Supporting Care. Saving Lives."
        title="CareLink TB"
        description="A centralized digital platform designed to support tuberculosis screening, diagnostic follow-ups, and six-month treatment monitoring for communities served by International Care Ministries, Rural Health Units, and partner X-ray service provider."
      />

      {/* ── ABOUT ── */}
      <section className="about" id="about">
        <div className="about-text reveal">
          <h2>About CareLink</h2>
          <p>
            CareLink TB helps organize the entire TB management process, ensuring no patient falls
            through the cracks. By digitizing the workflow from community screening to treatment
            completion, we improve the efficiency and accuracy of the Active Case Finding program.
          </p>
          <ul className="about-features">
            {ABOUT_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>

        <div className="about-photos reveal reveal-delay-2">
          {ABOUT_PHOTOS.map((photo) => (
            <div key={photo.src} className="photo-wrap">
              <img src={photo.src} alt={photo.alt} />
            </div>
          ))}
        </div>
      </section>

      {/* ── WORKFLOW ── */}
      <section className="workflow" id="workflow">
        <div className="workflow-header reveal">
          <h2>CareLink Workflow</h2>
        </div>
        <p className="workflow-sub reveal reveal-delay-1">
          Our end-to-end digital solution tracks every step of the TB management process.
        </p>

        <div className="steps-grid reveal reveal-delay-2">
          {workflowSteps.map((step) => (
            <div key={step.num} className="step">
              <div className="step-num">{step.num}</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {step.icon}
                </svg>
              </div>
              <h4>{step.title}</h4>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <span>© 2026 CareLink TB</span>
        <div className="footer-socials">
          <a href="#" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>
          <a href="#" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <a href="#" aria-label="YouTube">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" />
            </svg>
          </a>
        </div>
      </footer>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
