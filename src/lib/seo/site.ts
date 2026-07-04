/** Single source of truth for site-wide identity. Feeds metadata + schema + AI. */
export const SITE = {
  name: 'Trucking Life Academy',
  brand: 'Trucking Life with Shawn',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://truckinglifewithshawn.com',
  tagline: 'Drivers helping drivers.',
  description:
    'CDL-A training and trucking resources built by Shawn — a driver with 17 years on the road and zero violations. Academy enrollment, DOT guides, practice tests, and truck parking, based in Dalton, GA off I-75.',
  city: 'Dalton',
  region: 'GA',
  founder: {
    name: 'Shawn Gresham',
    role: 'CDL-A driver, instructor, and founder',
    credential: '17 years driving, zero violations',
  },
  social: {
    youtube: 'https://www.youtube.com/@TruckingLifewithShawn',
    facebook: 'https://www.facebook.com/TruckingLifewithShawn',
    tiktok: 'https://www.tiktok.com/@truckinglifewithshawn',
  },
} as const;
