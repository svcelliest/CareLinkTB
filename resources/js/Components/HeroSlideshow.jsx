// resources/js/Components/HeroSlideshow.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const INTERVAL_MS = 5000;

const kenBurns = keyframes`
  from { transform: scale(1) translate(0, 0); }
  to   { transform: scale(1.06) translate(-1%, -1%); }
`;

/**
 * Full-bleed hero slideshow with autoplay, dot indicators, prev/next
 * arrows, and a linear progress bar. Pauses on hover.
 *
 * @param {{src: string, alt: string}[]} slides
 * @param {string} eyebrow
 * @param {string} title
 * @param {string} description
 */
export default function HeroSlideshow({ slides, eyebrow, title, description }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (index) => setCurrent(((index % slides.length) + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused) return undefined;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [paused, slides.length, current]);

  return (
    <Box
      component="section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative h-[94vh] max-h-[900px] flex items-center overflow-hidden px-8 md:px-16"
      sx={{ bgcolor: '#1a1a1a' }}
    >
      {/* Slides */}
      <Box className="absolute inset-0" sx={{ zIndex: 0 }}>
        {slides.map((slide, i) => (
          <Box
            key={slide.src}
            className="absolute inset-0"
            sx={{
              opacity: i === current ? 1 : 0,
              transition: 'opacity 1s ease-in-out',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.66)',
              },
            }}
          >
            <Box
              component="img"
              src={slide.src}
              alt={slide.alt}
              className="absolute inset-0 w-full h-full"
              sx={{
                objectFit: 'cover',
                animation: i === current ? `${kenBurns} 8s ease-in-out infinite alternate` : 'none',
              }}
            />
          </Box>
        ))}
      </Box>

      {/* Prev / Next arrows */}
      <IconButton
        aria-label="Previous slide"
        onClick={() => goTo(current - 1)}
        sx={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
          color: 'white', bgcolor: 'rgba(255,255,255,0.12)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
        }}
      >
        <ArrowBackIosNewIcon fontSize="small" />
      </IconButton>
      <IconButton
        aria-label="Next slide"
        onClick={() => goTo(current + 1)}
        sx={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
          color: 'white', bgcolor: 'rgba(255,255,255,0.12)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
        }}
      >
        <ArrowForwardIosIcon fontSize="small" />
      </IconButton>

      {/* Progress bar (restarts on every slide change) */}
      <Box
        key={current}
        className="absolute bottom-0 left-0 h-[3px]"
        sx={{
          bgcolor: 'primary.main',
          zIndex: 3,
          width: paused ? 0 : '100%',
          transition: paused ? 'none' : `width ${INTERVAL_MS}ms linear`,
        }}
      />

      {/* Dot indicators */}
      <Box className="absolute bottom-6 left-1/2 flex gap-2" sx={{ transform: 'translateX(-50%)', zIndex: 2 }}>
        {slides.map((slide, i) => (
          <Box
            key={slide.src}
            component="button"
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            className="rounded-full"
            sx={{
              width: 8,
              height: 8,
              border: 'none',
              cursor: 'pointer',
              bgcolor: i === current ? 'common.white' : 'rgba(255,255,255,0.45)',
              transform: i === current ? 'scale(1.25)' : 'scale(1)',
              transition: 'background .3s, transform .3s',
            }}
          />
        ))}
      </Box>

      {/* Hero copy */}
      <Box className="relative max-w-2xl" sx={{ zIndex: 1, mt: { xs: 6, md: 12 } }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.75)', mb: 1.5 }}>{eyebrow}</Typography>
        <Typography
          variant="h1"
          sx={{ color: 'white', fontSize: { xs: '2.6rem', sm: '3.6rem', md: '5rem' }, lineHeight: 1.08, mb: 3 }}
        >
          {title}
        </Typography>
        <Box sx={{ width: 60, height: 3, bgcolor: 'primary.main', mb: 3 }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.15rem', lineHeight: 1.75, maxWidth: 580 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
