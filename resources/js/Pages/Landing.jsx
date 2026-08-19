import { useState, useEffect, useRef, useCallback } from "react";
import { Head } from "@inertiajs/react";
import { useReveal } from "@/hooks/useReveal";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import LoginModal from "@/Components/modal/LoginModal";
import { workflowSteps } from "@/data/workflowSteps.jsx";

const SLIDES = [
    "/img/slideshow_img/slideshow_1.jpg",
    "/img/slideshow_img/slideshow_2.jpg",
    "/img/slideshow_img/slideshow_3.jpg",
    "/img/slideshow_img/slideshow_4.jpg",
    "/img/slideshow_img/slideshow_5.jpg",
];
const INTERVAL = 5000;

function ProgressBar({ paused, duration }) {
    const ref = useRef(null);
    useEffect(() => {
        if (paused || !ref.current) return;
        ref.current.style.transition = "none";
        ref.current.style.width = "0%";
        ref.current.getBoundingClientRect();
        ref.current.style.transition = `width ${duration}ms linear`;
        ref.current.style.width = "100%";
    }, [paused, duration]);
    return (
        <div
            ref={ref}
            style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: "3px",
                background: "#d94f4f",
                width: "0%",
                zIndex: 3,
            }}
        />
    );
}

export default function Landing() {
    const [loginOpen, setLoginOpen] = useState(false);
    const { activeSection, scrolled } = useScrollSpy(["about", "workflow"]);
    useReveal();

    /* ── Slideshow state ── */
    const [current, setCurrent] = useState(0);
    const [progKey, setProgKey] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef(null);
    const heroRef = useRef(null);
    const slideshowRef = useRef(null);

    const goTo = useCallback((indexOrFn) => {
        setCurrent((prev) => {
            const next =
                typeof indexOrFn === "function" ? indexOrFn(prev) : indexOrFn;
            return ((next % SLIDES.length) + SLIDES.length) % SLIDES.length;
        });
        setProgKey((k) => k + 1);
    }, []);

    const resetTimer = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => goTo((c) => c + 1), INTERVAL);
    }, [goTo]);

    useEffect(() => {
        resetTimer();
        return () => clearInterval(timerRef.current);
    }, [resetTimer]);

    useEffect(() => {
        const onScroll = () => {
            if (!heroRef.current || !slideshowRef.current) return;
            const scrolledY = window.scrollY;
            if (scrolledY > heroRef.current.offsetHeight) return;
            slideshowRef.current.style.transform = `translateY(${(scrolledY * 0.3).toFixed(1)}px)`;
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const handleGoTo = (index) => {
        goTo(index);
        resetTimer();
    };

    const scrollTo = (id) => (e) => {
        e.preventDefault();
        document
            .getElementById(id)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <>
            <Head title="CareLink TB" />

            {/* ═══════════════ NAVBAR ═══════════════ */}
            <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
                <a href="#" className="nav-logo">
                    <div className="nav-logo-icon">
                        <img
                            src="/img/logo_img/icm_logo_transparent.png"
                            alt="CareLink TB Logo"
                            className="nav-logo-img"
                        />
                    </div>
                    CareLink TB
                </a>

                <div className="nav-links-group">
                    <a
                        href="#about"
                        onClick={scrollTo("about")}
                        className={`nav-link ${activeSection === "about" ? "active" : ""}`}
                    >
                        About CareLink
                    </a>

                    <a
                        href="#workflow"
                        onClick={scrollTo("workflow")}
                        className={`nav-link ${activeSection === "workflow" ? "active" : ""}`}
                    >
                        CareLink Workflow
                    </a>
                    <button
                        className="btn-login"
                        onClick={() => setLoginOpen(true)}
                    >
                        Log in
                    </button>
                </div>
            </nav>

            {/* ═══════════════ HERO ═══════════════ */}
            <section
                ref={heroRef}
                className="hero-section"
                onMouseEnter={() => {
                    setPaused(true);
                    clearInterval(timerRef.current);
                }}
                onMouseLeave={() => {
                    setPaused(false);
                    resetTimer();
                    setProgKey((k) => k + 1);
                }}
            >
                <div ref={slideshowRef} className="slideshow-wrap">
                    {SLIDES.map((src, i) => (
                        <div
                            key={i}
                            className={`slide ${i === current ? "active" : ""}`}
                        >
                            <img src={src} alt={`Slide ${i + 1}`} />
                        </div>
                    ))}
                </div>

                <button
                    className="slide-arrow prev"
                    onClick={() => handleGoTo(current - 1)}
                    aria-label="Previous slide"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                <button
                    className="slide-arrow next"
                    onClick={() => handleGoTo(current + 1)}
                    aria-label="Next slide"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>

                <ProgressBar
                    key={progKey}
                    paused={paused}
                    duration={INTERVAL}
                />

                <div className="slide-dots">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            className={`slide-dot ${i === current ? "active" : ""}`}
                            onClick={() => handleGoTo(i)}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>

                <div className="hero-content">
                    <p className="hero-eyebrow">
                        Connecting People. Supporting Care. Saving Lives.
                    </p>
                    <h1 className="hero-h1">CareLink TB</h1>
                    <div className="hero-divider" />
                    <p className="hero-desc">
                        A centralized digital platform designed to support
                        tuberculosis screening, diagnostic follow-ups, and
                        six-month treatment monitoring for communities served by
                        International Care Ministries, Rural Health Units, and
                        partner X-ray service provider.
                    </p>
                </div>
            </section>

            {/* ═══════════════ ABOUT ═══════════════ */}
            <section id="about" className="about-section">
                <div className="reveal">
                    <h2 className="about-h2">About CareLink</h2>
                    <p className="about-p">
                        CareLink TB helps organize the entire TB management
                        process, ensuring no patient falls through the cracks.
                        By digitizing the workflow from community screening to
                        treatment completion, we improve the efficiency and
                        accuracy of the Active Case Finding program.
                    </p>
                    <ul className="about-features">
                        <li>Centralized patient registration</li>
                        <li>Real-time flagging of suspicious cases</li>
                        <li>Digital diagnostic assessment</li>
                        <li>Tracking patient treatment progress</li>
                    </ul>
                </div>

                <div className="about-photos-grid reveal reveal-delay-2">
                    {[
                        {
                            src: "/img/about_img/1.jpg",
                            alt: "Healthcare workers",
                        },
                        {
                            src: "/img/about_img/2.jpg",
                            alt: "Patient consultation",
                        },
                        {
                            src: "/img/about_img/3.jpg",
                            alt: "Community screening",
                        },
                        { src: "/img/about_img/4.jpg", alt: "Medical check" },
                    ].map((p, i) => (
                        <div key={i} className="photo-wrap">
                            <img src={p.src} alt={p.alt} />
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════ WORKFLOW ═══════════════ */}
            <section id="workflow" className="workflow-section">
                <div className="reveal">
                    <h2 className="workflow-h2">CareLink Workflow</h2>
                </div>
                <p className="workflow-sub reveal reveal-delay-1">
                    Our end-to-end digital solution tracks every step of the TB
                    management process.
                </p>
                <div className="steps-grid reveal reveal-delay-2">
                    {workflowSteps.map((s) => (
                        <div key={s.num} className="step">
                            <div className="step-num">{s.num}</div>
                            <div className="step-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    {s.icon}
                                </svg>
                            </div>
                            <h4>{s.title}</h4>
                            <p>{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════════ FOOTER ═══════════════ */}
            <footer className="footer-bar">
                <span className="footer-copy">© 2026 CareLink TB</span>
                <div className="footer-socials">
                    <a
                        href="https://www.facebook.com/internationalcareministries"
                        aria-label="Facebook"
                        className="footer-social"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                        </svg>
                    </a>
                    <a
                        href="https://www.instagram.com/intlcareministries"
                        aria-label="Instagram"
                        className="footer-social"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="2" y="2" width="20" height="20" rx="5" />
                            <circle cx="12" cy="12" r="4" />
                            <circle
                                cx="17.5"
                                cy="6.5"
                                r="1"
                                fill="currentColor"
                                stroke="none"
                            />
                        </svg>
                    </a>
                    <a
                        href="https://www.youtube.com/@InternationalCareMinistries"
                        aria-label="YouTube"
                        className="footer-social"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
                            <polygon
                                points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"
                                fill="white"
                            />
                        </svg>
                    </a>
                </div>
            </footer>

            {/* ═══════════════ LOGIN MODAL ═══════════════ */}
            <LoginModal
                isOpen={loginOpen}
                onClose={() => setLoginOpen(false)}
            />
        </>
    );
}
