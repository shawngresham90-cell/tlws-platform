import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

/**
 * Self-hosted fonts — no build-time Google fetch, no external request at runtime.
 * Faster, privacy-friendly, and the build never depends on a third party being up.
 */
const anton = localFont({
  src: '../../public/fonts/anton-400.woff2',
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

const inter = localFont({
  src: [
    { path: '../../public/fonts/inter-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/inter-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/inter-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/inter-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Trucking Life Academy — CDL Training in Dalton, GA',
    template: '%s · Trucking Life',
  },
  description:
    'Drivers helping drivers. CDL-A training built by a 17-year driver with zero violations. Dalton, GA off I-75.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://truckinglifewithshawn.com'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
