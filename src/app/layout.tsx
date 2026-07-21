import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PlausibleAnalytics } from '@/components/analytics/PlausibleAnalytics';
import { JsonLd, organizationSchema, personSchema, websiteSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import './globals.css';

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

export const metadata: Metadata = buildMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable}`}>
      <head>
        {/* Site-wide structured data — Organization, Person, WebSite */}
        <JsonLd schema={[organizationSchema(), personSchema(), websiteSchema()]} />
        {/* Cookieless analytics — renders nothing unless the env var is set */}
        <PlausibleAnalytics />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-card focus:bg-signal focus:px-4 focus:py-2 focus:font-semibold focus:text-asphalt"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
