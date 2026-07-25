/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.netlify.app' },
    ],
  },
  async redirects() {
    // Routes that shipped in early navigation but never became pages. Keep
    // old bookmarks/history working by sending each to its real home.
    return [
      { source: '/dot-guide', destination: '/knowledge/dot-compliance', permanent: true },
      // /login was the original Supabase email+password admin sign-in. The
      // dashboard moved to the shared-password gate in lib/admin/auth.ts, so a
      // successful sign-in there landed on /admin, which immediately bounced to
      // /admin/login and asked for a different credential — a dead end. Send it
      // to the sign-in that actually opens the dashboard.
      { source: '/login', destination: '/admin/login', permanent: true },
      { source: '/directory/trip-planner', destination: '/trip-planner', permanent: true },
      { source: '/contact', destination: '/academy/faq', permanent: false },
      {
        source: '/videos',
        destination: 'https://www.youtube.com/@TruckingLifewithShawn',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
