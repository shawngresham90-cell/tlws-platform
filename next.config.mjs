/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
   * Pilot build identification. Netlify already injects COMMIT_REF and
   * CONTEXT into the build environment; this only forwards them under
   * NEXT_PUBLIC_ names so the client bundle can name the build a driver
   * is running. No Netlify configuration changes, and the list is a
   * whitelist of three non-sensitive values — never a spread of env.
   *
   * These are inputs, not output: `resolveBuildId` re-derives everything
   * shown on screen through its own shape checks, so a mis-set variable
   * renders as 'unknown' rather than being printed.
   */
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: process.env.COMMIT_REF ?? '',
    NEXT_PUBLIC_BUILD_CONTEXT: process.env.CONTEXT ?? '',
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
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
