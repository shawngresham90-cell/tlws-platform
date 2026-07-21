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
      { source: '/directory/trip-planner', destination: '/trip-planner', permanent: true },
      { source: '/contact', destination: '/academy/faq', permanent: false },
      { source: '/sponsors', destination: '/', permanent: false },
      {
        source: '/videos',
        destination: 'https://www.youtube.com/@TruckingLifewithShawn',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
