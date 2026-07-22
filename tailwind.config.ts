import type { Config } from 'tailwindcss';

/**
 * TLWS Design System — "Steel & Sodium" (design blueprint §2).
 * The brand feel: the inside of a well-kept Peterbilt at night — dark, warm,
 * instrument-lit, nothing decorative. Anton display + Inter body stay locked.
 *
 * Color doctrine:
 *  - Sodium Amber = money or action. Nothing else gets amber. One amber
 *    element per viewport.
 *  - Thumbnail yellow #FFEB00 remains the YouTube identity; on-platform amber
 *    is deepened for dark-surface contrast (8.4:1 on Asphalt).
 *  - Marker Green = success/verified only. Diesel red = errors/warnings only.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx,mdx}',
    './src/components/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sodium Amber — THE accent. Primary CTAs, active states, money path.
        signal: {
          DEFAULT: '#F5A623',
          600: '#D98C1A', // hover/pressed
        },
        // Asphalt — page + surface ramp. Never pure black (11pm sleeper-cab rule).
        asphalt: {
          DEFAULT: '#141414', // page background
          800: '#1A1A1C', // alternate section band
          700: '#1F1F22', // Cab Panel — card/panel surface
          600: '#2A2A2E', // raised/hover surface
        },
        // Cab Panel alias — placard/card surface (same value as asphalt-700).
        cab: '#1F1F22',
        diesel: {
          DEFAULT: '#B91C1C', // brake red — errors, violations, warnings only
          700: '#991B1B',
          // Readable red for TEXT on dark surfaces: DEFAULT measures ~2.7:1
          // there (WCAG AA fail); 300 clears 6:1 on every dark background.
          300: '#F87171',
        },
        // Marker Green — success/verified/DOT-compliant states only.
        marker: {
          DEFAULT: '#3E7C4F', // fills/borders
          300: '#7FC993', // text-safe on dark (≥6:1)
        },
        line: '#2A2A2E', // hairline dividers + placard borders
        ink: '#F2F0EB', // Reflective White — warm primary text
        muted: '#A3A39B', // secondary text (warmed to match ink)
      },
      fontFamily: {
        display: ['var(--font-anton)', 'Impact', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Deliberate scale — display is heavy and tight, body is readable
        eyebrow: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.15em' }],
        hero: ['clamp(2.75rem, 8vw, 6rem)', { lineHeight: '0.92', letterSpacing: '-0.01em' }],
        section: ['clamp(1.75rem, 4vw, 3rem)', { lineHeight: '1', letterSpacing: '-0.01em' }],
      },
      maxWidth: {
        content: '72rem',
      },
      borderRadius: {
        // Placard radius — 8px: industrial, not consumer-soft (blueprint §2.4)
        card: '8px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // Section-entry moment — 180ms, once, motion-safe only (blueprint §2.7)
        'fade-up': 'fade-up 180ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
