import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';

/**
 * Web app manifest (Next file convention — served at /manifest.webmanifest
 * with the correct content type, no custom headers needed).
 *
 * This is the installability half of the PWA foundation: with this file plus
 * the registered service worker in public/sw.js, Chromium browsers offer
 * "Install app" and iOS Safari's Add to Home Screen produces a real
 * standalone app instead of a bookmark.
 *
 * Colors are the design-system tokens (tailwind.config.ts): asphalt #141414
 * for both theme and background so the installed app's splash and title bar
 * match the site's dark surface. The icons scale the existing approved
 * favicon mark (src/app/icon.tsx — "TL." with the thumbnail-yellow period);
 * no new branding was invented for this. See scripts/generate-pwa-icons.mjs
 * for how the PNGs were produced.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.brand,
    short_name: 'TLWS',
    description: SITE.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#141414',
    theme_color: '#141414',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
