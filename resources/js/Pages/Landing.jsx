// resources/js/Pages/Landing.jsx
import { useState, useEffect, useRef } from 'react';
import { Head } from '@inertiajs/react';
import {
  Box, Typography, Button, IconButton, Container, AppBar, Toolbar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import Crop169OutlinedIcon from '@mui/icons-material/Crop169Outlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';

import HeroSlideshow from '@/Components/HeroSlideshow';
import LoginModal from '@/Components/LoginModal';

const SLIDES = [1, 2, 3, 4, 5].map((n) => ({
  src: `/img/slideshow_img/slideshow_${n}.jpg`,
  alt: `Slide ${n}`,
}));

const ABOUT_PHOTOS = [
  { src: '/img/about_img/1.jpg', alt: 'Healthcare workers', mt: 30 },
  { src: '/img/about_img/2.jpg', alt: 'Patient consultation', mt: 10 },
  { src: '/img/about_img/3.jpg', alt: 'Community screening', mt: 10 },
  { src: '/img/about_img/4.jpg', alt: 'Medical check', mt: -10 },
];

const WORKFLOW_STEPS = [
  { icon: SearchIcon, title: 'Community Screening', desc: 'Teams conduct door-to-door or community-based screenings.' },
  { icon: DescriptionOutlinedIcon, title: 'Patient Registration', desc: 'Digital registration of all screened individuals.' },
  { icon: ReportProblemOutlinedIcon, title: 'Suspicious Case Flagging', desc: 'Automated flagging of presumptive TB cases for follow-up.' },
  { icon: Crop169OutlinedIcon, title: 'Diagnostic Assessment', desc: 'RHU staff perform X-ray, Sputum, and GeneXpert tests.' },
  { icon: CheckCircleOutlineIcon, title: 'TB Confirmation', desc: 'Physician evaluation and final diagnostic confirmation.' },
  { icon: CalendarMonthOutlinedIcon, title: 'Treatment Monitoring', desc: 'Six-month structured medication and follow-up tracking.' },
  { icon: BarChartOutlinedIcon, title: 'Program Monitoring', desc: 'ICM coordinators track performance across municipalities.' },
];

const NAV_LINKS = [
  { href: '#about', label: 'About CareLink' },
  { href: '#workflow', label: 'CareLink Workflow' },
];

/** Fades/slides an element in the first time it enters the viewport. */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

function Reveal({ delay = 0, className = '', children, ...props }) {
  const [ref, visible] = useReveal();
  return (
    <Box
      ref={ref}
      className={className}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity .65s ease ${delay}s, transform .65s cubic-bezier(.22,.68,0,1.2) ${delay}s`,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

export default function Landing() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);

      let current = '';
      NAV_LINKS.forEach(({ href }) => {
        const el = document.querySelector(href);
        if (el && el.getBoundingClientRect().top <= 120) current = href;
      });
      setActiveSection(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToSection(e, href) {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <Head title="CareLink TB" />

      {/* ── NAVBAR ── */}
      <AppBar
        position="sticky"
        elevation={0}
        color="inherit"
        sx={{
          bgcolor: scrolled ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #eee',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.09)' : 'none',
          transition: 'background .3s, box-shadow .3s',
        }}
      >
        <Toolbar className="flex items-center justify-between px-6 md:px-12" sx={{ minHeight: 64 }}>
          <Box className="flex items-center gap-2.5" sx={{ fontWeight: 700 }}>
            <Box
              className="flex items-center justify-center"
              sx={{ width: 34, height: 34, bgcolor: 'primary.main', borderRadius: '8px' }}
            >
              <svg viewBox="0 0 36 36" width="20" height="20" fill="none">
                <polyline
                  points="2,18 8,18 12,8 16,26 20,14 24,22 28,18 34,18"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </Box>
            <Typography component="span" fontWeight={700}>CareLink TB</Typography>
          </Box>

          <Box className="hidden sm:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Typography
                key={link.href}
                component="a"
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                variant="body2"
                sx={{
                  textDecoration: 'none',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: activeSection === link.href ? 'primary.main' : 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                {link.label}
              </Typography>
            ))}
            <Button variant="contained" onClick={() => setLoginOpen(true)}>
              Log in
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── HERO ── */}
      <HeroSlideshow
        slides={SLIDES}
        eyebrow="Connecting People. Supporting Care. Saving Lives."
        title="CareLink TB"
        description="A centralized digital platform designed to support tuberculosis screening, diagnostic follow-ups, and six-month treatment monitoring for communities served by International Care Ministries, Rural Health Units, and partner X-ray service provider."
      />

      {/* ── ABOUT ── */}
      <Box
        component="section"
        id="about"
        className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 px-6 md:px-16"
        sx={{ bgcolor: 'primary.main', py: { xs: 7, md: 10 } }}
      >
        <Reveal>
          <Typography variant="h2" sx={{ color: 'white', fontSize: '2.4rem', mb: 2.5 }}>
            About CareLink
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.88)', lineHeight: 1.8, fontSize: '.97rem', mb: 3.5 }}>
            CareLink TB helps organize the entire TB management process, ensuring no patient falls through
            the cracks. By digitizing the workflow from community screening to treatment completion, we
            improve the efficiency and accuracy of the Active Case Finding program.
          </Typography>
          <Box component="ul" className="flex flex-col gap-3.5" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {[
              'Centralized patient registration',
              'Real-time flagging of suspicious cases',
              'Digital diagnostic assessment',
              'Tracking patient treatment progress',
            ].map((item) => (
              <Box component="li" key={item} className="flex items-center gap-3">
                <CheckCircleOutlineIcon sx={{ color: 'white', fontSize: 20 }} />
                <Typography sx={{ color: 'white', fontWeight: 500, fontSize: '.95rem' }}>{item}</Typography>
              </Box>
            ))}
          </Box>
        </Reveal>

        <Reveal delay={0.2} className="grid grid-cols-2 gap-4">
          {ABOUT_PHOTOS.map((photo) => (
            <Box
              key={photo.src}
              className="rounded-2xl overflow-hidden"
              sx={{ mt: `${photo.mt}px`, transition: 'box-shadow .3s ease', '&:hover': { boxShadow: '0 12px 32px rgba(0,0,0,.22)' } }}
            >
              <Box
                component="img"
                src={photo.src}
                alt={photo.alt}
                className="w-full block"
                sx={{ aspectRatio: '4/3', objectFit: 'cover', filter: 'brightness(.88)', transition: 'transform .5s ease, filter .35s ease', '&:hover': { transform: 'scale(1.07)', filter: 'brightness(1.02)' } }}
              />
            </Box>
          ))}
        </Reveal>
      </Box>

      {/* ── WORKFLOW ── */}
      <Box component="section" id="workflow" sx={{ py: { xs: 7, md: 11 }, px: { xs: 3, md: 8 } }}>
        <Reveal className="text-center">
          <Typography variant="h2" sx={{ fontSize: '2.4rem' }}>CareLink Workflow</Typography>
        </Reveal>
        <Reveal delay={0.1} className="text-center">
          <Typography color="text.secondary" sx={{ mb: 7, fontSize: '.97rem' }}>
            Our end-to-end digital solution tracks every step of the TB management process.
          </Typography>
        </Reveal>

        <Reveal delay={0.2} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WORKFLOW_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <Box
                key={step.title}
                className="flex flex-col items-center text-center gap-2.5 p-4"
                sx={{
                  borderRadius: '14px',
                  cursor: 'default',
                  transition: 'background .2s, transform .2s, box-shadow .2s',
                  '&:hover': { bgcolor: 'grey.100', transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,.07)' },
                }}
              >
                <Box
                  className="flex items-center justify-center"
                  sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', fontSize: '.75rem', fontWeight: 700 }}
                >
                  {i + 1}
                </Box>
                <Box
                  className="flex items-center justify-center"
                  sx={{ width: 60, height: 60, borderRadius: '50%', border: '1.5px solid #e8e8e8', bgcolor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}
                >
                  <Icon sx={{ color: 'primary.main', fontSize: 26 }} />
                </Box>
                <Typography variant="body2" fontWeight={600}>{step.title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {step.desc}
                </Typography>
              </Box>
            );
          })}
        </Reveal>
      </Box>

      {/* ── FOOTER ── */}
      <Box
        component="footer"
        className="flex items-center justify-between px-6 md:px-16"
        sx={{ bgcolor: 'text.primary', py: 3.5 }}
      >
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          © 2026 CareLink TB
        </Typography>
        <Box className="flex gap-3">
          {[FacebookIcon, InstagramIcon, YouTubeIcon].map((Icon, i) => (
            <IconButton
              key={i}
              aria-label="social link"
              sx={{
                width: 42, height: 42,
                border: '1.5px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.7)',
                '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'rgba(217,79,79,.1)' },
              }}
            >
              <Icon fontSize="small" />
            </IconButton>
          ))}
        </Box>
      </Box>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
