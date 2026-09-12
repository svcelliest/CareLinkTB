// resources/js/Components/HeroSlideshow.jsx
import { useState, useEffect, useRef, useCallback } from 'react';

const INTERVAL = 5000;

/**
 * Hero slideshow for the landing page, converted from the original page's
 * markup and behavior: autoplay on a 5s interval, prev/next arrows, dot
 * indicators, a progress bar that fills across the interval, a Ken Burns pan
 * on the active slide, and pause-on-hover.
 *
 * Styling comes from resources/css/landing.css, so this renders the original
 * class names rather than component styles.
 *
 * @param {{src: string, alt: string}[]} slides
 * @param {string} eyebrow
 * @param {string} title
 * @param {string} description
 */
export default function HeroSlideshow({ slides, eyebrow, title, description }) {
  const [current, setCurrent] = useState(0);
  const [progressWidth, setProgressWidth] = useState(100);
  const timerRef = useRef(null);
  const progressTimeoutRef = useRef(null);
  const slideCount = slides.length;

  // Snap the bar back to empty, then let CSS animate it across the interval.
  const animateProgress = useCallback(() => {
    setProgressWidth(0);
    clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = setTimeout(() => setProgressWidth(100), 50);
  }, []);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slideCount);
      animateProgress();
    }, INTERVAL);
  }, [animateProgress, slideCount]);

  useEffect(() => {
    animateProgress();
    resetTimer();
    return () => {
      clearInterval(timerRef.current);
      clearTimeout(progressTimeoutRef.current);
    };
  }, [animateProgress, resetTimer]);

  const goTo = (index) => {
    setCurrent((index + slideCount) % slideCount);
    animateProgress();
    resetTimer();
  };

  const handleHeroHover = (isHovering) => {
    if (isHovering) {
      clearInterval(timerRef.current);
      setProgressWidth(100);
    } else {
      resetTimer();
    }
  };

  return (
    <section
      className="hero"
      onMouseEnter={() => handleHeroHover(true)}
      onMouseLeave={() => handleHeroHover(false)}
    >
      <div className="slideshow">
        {slides.map((slide, index) => (
          <div key={slide.src} className={`slide ${current === index ? 'active' : ''}`}>
            <img src={slide.src} alt={slide.alt} />
          </div>
        ))}
      </div>

      <div
        className="slide-progress"
        style={{ width: `${progressWidth}%`, transition: `width ${INTERVAL}ms linear` }}
      />

      <div className="slide-dots">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            className={`slide-dot ${current === index ? 'active' : ''}`}
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <div className="hero-content">
        <p className="hero-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="hero-divider" />
        <p className="hero-desc">{description}</p>
      </div>
    </section>
  );
}
