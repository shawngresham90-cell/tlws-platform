import type { Config } from 'tailwindcss';

/**
 * TLWS Design System — codifies the existing "Trucking Life with Shawn" brand:
 * Anton display, yellow #FFEB00 on dark, trucker-direct. Not invented — locked.
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
        // Core brand
        signal: {
          DEFAULT: '#FFEB00', // brand yellow — CTAs, headlines on dark
          600: '#E6D400',
        },
        asphalt: {
          DEFAULT: '#0E0E0E', // near-black base
          800: '#161616',
          700: '#1F1F1F',
          600: '#2A2A2A',
        },
        diesel: {
          DEFAULT: '#B91C1C', // plaid red — warnings, secondary accents
          700: '#991B1B',
          300: '#F87171', // error text on dark surfaces (6.5:1 on asphalt-800)
        },
        line: '#333333', // hairline dividers
        ink: '#F5F5F5', // primary text on dark
        muted: '#A3A3A3', // secondary text
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
        // Minimal radius — this brand is rugged, not soft
        card: '4px',
      },
    },
  },
  plugins: [],
};

export default config;
