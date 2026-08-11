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
        // Road Flare — the SECONDARY accent beside Sodium Amber. Added for the
        // approved Supply the Classroom manifest design, which pairs a yellow
        // primary with an orange secondary. Same shape as diesel/marker:
        // DEFAULT for fills and borders, 300 for text on dark surfaces.
        flare: {
          // #FF5A1F is the owner-approved reference orange for the campaign.
          DEFAULT: '#FF5A1F',
          // Lighter tint for the small uppercase manifest labels, where the
          // DEFAULT's weight starts to fight the amber primary at 10px.
          300: '#FF8A5C',
        },
        // Marker Green — success/verified/DOT-compliant states only.
        marker: {
          DEFAULT: '#3E7C4F', // fills/borders
          300: '#7FC993', // text-safe on dark (≥6:1)
        },
        // Guide-Sign Green — interstate guide-sign panels ONLY (Night Haul
        // master blueprint §1.3): wayfinding surfaces styled like the highway
        // signs drivers read all day. Deliberately distinct from `marker`
        // (success/verified STATUS): a sign panel is navigation, not a status
        // light, and the two greens must never blur into one meaning.
        // ink (#F2F0EB) on DEFAULT measures ~5.7:1 — AA for the panel text.
        guide: {
          DEFAULT: '#1B6B3A', // panel fill
          700: '#14522C', // exit-tab / pressed edge
          300: '#6FBF8A', // text-safe green accents on dark (≥8:1 on asphalt)
        },
        // Deadline Red — the Night Haul blueprint's "brake-red": scarcity and
        // deadline moments ONLY (a real price bump, real spots remaining).
        // Distinct from `diesel` (errors/violations) so a deadline never
        // dresses like a failure state — and never decorative, same house
        // rule as every other red. Named `deadline`, not `brake`, because the
        // token guard reads any `-brake-` suffix as this family and the
        // road-ahead scene slugs legitimately contain air-brake-check.
        // DEFAULT is fills/large-display only (~3.7:1 on asphalt); 300 is the
        // text-safe shade (≥6:1 on asphalt and cab).
        deadline: {
          DEFAULT: '#D7263D',
          300: '#F2778A',
        },
        line: '#2A2A2E', // hairline dividers + placard borders
        ink: '#F2F0EB', // Reflective White — warm primary text
        muted: '#A3A39B', // secondary text (warmed to match ink)
        // Navigator cockpit tokens (Navigator Design Blueprint §12). Values
        // live in src/app/(navigator)/navigator-design.css so night/day is a
        // CSS-variable flip; these aliases only make them addressable as
        // Tailwind classes inside Navigator components. Semantic, never
        // decorative: route/good/warn/danger each mean exactly one thing,
        // and nav-brand (TLWS yellow) is parked-screen branding only —
        // never on the active Drive Mode map or its chrome.
        nav: {
          // DEFAULT exists for the token guard, which reads any `-nav`
          // suffix in source (including prose like "skip-nav" in comments)
          // as this family; it aliases the background like `bg` below.
          DEFAULT: 'var(--nav-bg)',
          bg: 'var(--nav-bg)',
          surface: 'var(--nav-surface)',
          'surface-2': 'var(--nav-surface-2)',
          text: 'var(--nav-text)',
          'text-dim': 'var(--nav-text-dim)',
          route: 'var(--nav-route)',
          'route-alt': 'var(--nav-route-alt)',
          good: 'var(--nav-good)',
          warn: 'var(--nav-warn)',
          danger: 'var(--nav-danger)',
          brand: 'var(--nav-brand)',
        },
      },
      fontFamily: {
        display: ['var(--font-anton)', 'Impact', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // Navigator data face (blueprint §4): numerals only. Resolves to
        // Inter until the owner takes the Barlow Semi Condensed font-file
        // decision; pair with .num-data for tabular figures.
        data: ['var(--font-data)'],
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
        // Navigator cockpit radius (Navigator Design Blueprint §12) — 16px
        // cards on the driving surface, value owned by navigator-design.css.
        // Named `cockpit`, not `nav-card`: the design-tokens harness reads
        // any `-nav-` utility as the nav COLOUR family, so the radius key
        // must not contain the colour family's name.
        cockpit: 'var(--radius-card)',
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
