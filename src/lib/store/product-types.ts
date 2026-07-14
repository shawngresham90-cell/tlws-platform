import type { StoreCategorySlug, StoreProductType } from './types';

/**
 * Metadata for each finer-grained product type. `category` ties the type back
 * to one of the 7 top-level browse categories.
 */
export type ProductTypeMeta = {
  type: StoreProductType;
  label: string;
  category: StoreCategorySlug;
  blurb: string;
};

export const PRODUCT_TYPES: Record<StoreProductType, ProductTypeMeta> = {
  'dash-cam': {
    type: 'dash-cam',
    label: 'Dash Cams',
    category: 'electronics',
    blurb: 'Road-and-cab footage that protects your CDL when a four-wheeler cuts you off.',
  },
  'cb-radio': {
    type: 'cb-radio',
    label: 'CB Radios',
    category: 'electronics',
    blurb: 'Still the fastest way to hear about the scale, the wreck, and the backup ahead.',
  },
  'bluetooth-headset': {
    type: 'bluetooth-headset',
    label: 'Bluetooth Headsets',
    category: 'electronics',
    blurb: 'All-day, hands-free, noise-fighting audio for dispatch and the family.',
  },
  gps: {
    type: 'gps',
    label: 'Truck GPS',
    category: 'electronics',
    blurb: 'Truck-legal routing by height, weight, and hazmat — not car directions.',
  },
  'power-inverter': {
    type: 'power-inverter',
    label: 'Power Inverters',
    category: 'electronics',
    blurb: 'Run the fridge, laptop, and CPAP overnight without idling.',
  },
  charger: {
    type: 'charger',
    label: 'Chargers & Power',
    category: 'electronics',
    blurb: 'Keep the phone, tablet, ELD, and headset topped off through the shift.',
  },
  organization: {
    type: 'organization',
    label: 'Cab Organization',
    category: 'electronics',
    blurb: 'A place for everything so the cab works like a proper office.',
  },
  fridge: {
    type: 'fridge',
    label: 'Trucking Fridges',
    category: 'cab-kitchen',
    blurb: 'Real compressor cooling for days of cold food — the key to eating cheap and healthy.',
  },
  'electric-skillet': {
    type: 'electric-skillet',
    label: 'Electric Skillets & Cookers',
    category: 'cab-kitchen',
    blurb: 'Hot, real meals in the cab for a fraction of the truck-stop grill.',
  },
  'cab-cooking': {
    type: 'cab-cooking',
    label: 'Cab Kitchen',
    category: 'cab-kitchen',
    blurb: 'Coffee, cookware, and the small stuff that makes cab cooking work.',
  },
  'seat-cushion': {
    type: 'seat-cushion',
    label: 'Seat Cushions & Support',
    category: 'comfort-sleep',
    blurb: 'Save your back and tailbone across a million miles in the seat.',
  },
  bedding: {
    type: 'bedding',
    label: 'Bunk & Bedding',
    category: 'comfort-sleep',
    blurb: 'Turn the factory bunk into sleep that actually resets you.',
  },
  'dot-gear': {
    type: 'dot-gear',
    label: 'DOT Gear',
    category: 'safety-emergency',
    blurb: 'The pre-trip and roadside kit that keeps you legal and out of trouble.',
  },
  flashlight: {
    type: 'flashlight',
    label: 'Flashlights & Work Lights',
    category: 'tools-maintenance',
    blurb: 'See the problem at 2 a.m. on the shoulder or under the trailer.',
  },
  tools: {
    type: 'tools',
    label: 'Tools & Maintenance',
    category: 'tools-maintenance',
    blurb: 'Catch the low tire and the loose fitting before they end your day.',
  },
  cleaning: {
    type: 'cleaning',
    label: 'Cleaning & Cab Care',
    category: 'tools-maintenance',
    blurb: 'Keep the office you live in from turning into a health hazard.',
  },
  cpap: {
    type: 'cpap',
    label: 'CPAP & Sleep Equipment',
    category: 'health-wellness',
    blurb: 'Run and maintain your CPAP over the road so you pass the physical and sleep right.',
  },
  health: {
    type: 'health',
    label: 'Health & Wellness',
    category: 'health-wellness',
    blurb: 'Movement, hydration, and recovery for staying right on the long haul.',
  },
  apparel: {
    type: 'apparel',
    label: 'Apparel & Everyday Gear',
    category: 'apparel-gear',
    blurb: 'Gloves, boots, hi-vis, and bags that hold up load after load.',
  },
};

export function productTypeMeta(type: StoreProductType): ProductTypeMeta {
  return PRODUCT_TYPES[type];
}

/**
 * Buying guide ("Best X") definition. A guide renders the honest editorial
 * picks for a product type as a comparison + ranked list. No price, rating, or
 * review count appears until the owner verifies it on the product itself.
 */
export type BuyingGuide = {
  slug: string;
  title: string;
  eyebrow: string;
  productType: StoreProductType;
  /** SEO / hero intro. */
  intro: string;
  /** What to weigh before buying — type-level, honest, no fabricated specs. */
  considerations: string[];
  faq: { question: string; answer: string }[];
};

export const STORE_GUIDES: BuyingGuide[] = [
  {
    slug: 'best-dash-cams',
    title: 'Best Dash Cams for Truckers',
    eyebrow: 'Buying guide',
    productType: 'dash-cam',
    intro:
      'A dash cam is the cheapest insurance in the cab. When a four-wheeler brake-checks you or claims you hit them, the footage is the difference between an at-fault mark and a clean record. Here is how Shawn sorts the field for over-the-road drivers.',
    considerations: [
      'Front-and-interior (dual channel) matters more than raw resolution — you want the road and the cab.',
      'Look for a real parking mode and reliable loop recording with incident lock.',
      'Heat kills cheap cams; a supercapacitor model survives a hot cab better than a battery one.',
      'Make sure the card capacity and format are enough for your run before you rely on it.',
    ],
    faq: [
      {
        question: 'Are dash cams legal in a commercial truck?',
        answer:
          'Dash cams are legal in a commercial vehicle. Mount it so it does not block your view, and check your carrier policy on inward-facing cameras before you install one.',
      },
      {
        question: 'Do I need front and interior, or just front?',
        answer:
          'Most drivers are best served by a dual-channel cam. The interior view protects you on disputes and staged incidents, and the front view covers the road ahead.',
      },
    ],
  },
  {
    slug: 'best-bluetooth-headsets',
    title: 'Best Bluetooth Headsets for Truckers',
    eyebrow: 'Buying guide',
    productType: 'bluetooth-headset',
    intro:
      'You live on the phone with dispatch, brokers, and home. A trucking headset has to survive a loud cab, last a full shift, and stay comfortable over the ear for hours. Here is what Shawn looks for.',
    considerations: [
      'All-day battery and a quick-charge option beat fancy features you will not use.',
      'Noise-reducing or dual-mic designs are what make you understandable to dispatch in a loud cab.',
      'Over-ear comfort matters more than you think across a 14-hour day.',
      'A physical mute and volume you can find by feel keeps your eyes on the road.',
    ],
    faq: [
      {
        question: 'One earpiece or two?',
        answer:
          'For driving, a single-ear boom headset keeps you aware of the truck and legal in most states, while a dual-ear set is better for parked calls and music on your break.',
      },
    ],
  },
  {
    slug: 'best-truck-gps',
    title: 'Best Truck GPS for Truckers',
    eyebrow: 'Buying guide',
    productType: 'gps',
    intro:
      'A car GPS will route you under a low bridge or down a restricted road. A truck GPS routes by your height, weight, length, and hazmat so you stay legal and avoid the tickets and the tow. Here is how Shawn picks one.',
    considerations: [
      'Confirm it routes by truck profile — height, weight, length, and hazmat — not just car directions.',
      'A bigger screen you can read at a glance is safer than a tiny cheap unit.',
      'Live traffic and weather are worth it on high-mileage runs.',
      'Free lifetime map updates save you real money over the life of the unit.',
    ],
    faq: [
      {
        question: 'Is a dedicated truck GPS better than a phone app?',
        answer:
          'A dedicated unit keeps your phone free, has a bigger screen, and is built around truck routing. Many drivers run both and cross-check the route before they commit to it.',
      },
    ],
  },
  {
    slug: 'best-trucking-fridges',
    title: 'Best Trucking Fridges',
    eyebrow: 'Buying guide',
    productType: 'fridge',
    intro:
      'A real 12V compressor fridge is the cornerstone of eating cheap and healthy over the road. It keeps meat, dairy, and water cold for days so you skip the truck-stop grill. Here is what separates a fridge from a glorified cooler.',
    considerations: [
      'A compressor fridge actually gets cold in a hot cab; a thermoelectric cooler only drops a few degrees below ambient.',
      'Match the liter size to your bunk space and how many days you run.',
      'Low power draw matters if you run it off the battery overnight — pair it with a proper inverter or battery setup.',
      'A sturdy latch and a defined 12V plug that fits your truck save headaches.',
    ],
    faq: [
      {
        question: 'Compressor or thermoelectric?',
        answer:
          'A compressor fridge is the one worth owning. It holds a true refrigerator temperature regardless of cab heat, which a thermoelectric cooler cannot do on a hot day.',
      },
    ],
  },
  {
    slug: 'best-seat-cushions',
    title: 'Best Seat Cushions for Truckers',
    eyebrow: 'Buying guide',
    productType: 'seat-cushion',
    intro:
      'The seat is your office for eleven hours a day. The right cushion or lumbar support is how veteran drivers keep their backs and tailbones working into decade two of the job. Here is how Shawn sorts them.',
    considerations: [
      'Memory foam and gel each have fans — gel runs cooler, foam contours more.',
      'A dedicated lumbar support and a seat cushion solve different problems; some drivers run both.',
      'A non-slip base and a breathable cover matter over a long, hot shift.',
      'Make sure it fits your seat without pushing you too high into the headliner.',
    ],
    faq: [
      {
        question: 'Seat cushion or lumbar support?',
        answer:
          'A seat cushion targets tailbone and hip pressure; a lumbar support targets the low back. If you have both problems, running both is common and cheap insurance for your spine.',
      },
    ],
  },
  {
    slug: 'best-electric-skillets',
    title: 'Best Electric Skillets for Truckers',
    eyebrow: 'Buying guide',
    productType: 'electric-skillet',
    intro:
      'A plug-in skillet or cooker lets you eat like a person on the road — cheaper than the grill, better for staying right on a long run. Here is what to weigh before you buy one for the cab.',
    considerations: [
      'Decide between 12V (runs off the truck) and 120V (needs an inverter or shore power) based on your setup.',
      'A non-stick surface and a removable, washable pan make cleanup realistic in a cab.',
      'Watt draw has to match your inverter if you go the 120V route.',
      'A defined temperature control beats a single on/off element for real cooking.',
    ],
    faq: [
      {
        question: 'Do I need an inverter for an electric skillet?',
        answer:
          'A 120V skillet needs an inverter sized above its wattage, or truck-stop shore power. A 12V cooker plugs straight into the truck but heats slower and smaller.',
      },
    ],
  },
  {
    slug: 'best-flashlights',
    title: 'Best Flashlights for Truckers',
    eyebrow: 'Buying guide',
    productType: 'flashlight',
    intro:
      'A bright, dependable light turns a dark trailer, engine bay, or shoulder into something you can actually work on. Here is how Shawn picks a light that lives in the door pocket and never lets him down.',
    considerations: [
      'Rechargeable saves money, but a model that also takes standard batteries never leaves you dark.',
      'A magnetic base and a hang hook free up your hands on a repair.',
      'Flood plus spot beats a single beam for pre-trips and roadside work.',
      'Water and drop resistance matter for a tool that lives in the truck.',
    ],
    faq: [
      {
        question: 'Headlamp or handheld?',
        answer:
          'A headlamp keeps both hands free for a repair; a handheld throws a stronger beam down the trailer or road. Many drivers keep one of each in the cab.',
      },
    ],
  },
  {
    slug: 'best-power-inverters',
    title: 'Best Power Inverters for Truckers',
    eyebrow: 'Buying guide',
    productType: 'power-inverter',
    intro:
      'A proper inverter turns the truck into a home base — appliances, electronics, and medical gear run clean without idling all night. Here is how Shawn sizes and picks one.',
    considerations: [
      'Pure sine wave is what keeps sensitive electronics and CPAP machines safe; modified sine is cheaper but riskier.',
      'Size the continuous wattage above everything you plan to run at once, with headroom for startup surge.',
      'A hardwired install to the battery is safer for big loads than a cigarette-socket plug.',
      'Look for low-voltage and overload protection so you do not kill the starting battery.',
    ],
    faq: [
      {
        question: 'What size inverter do I need for a CPAP?',
        answer:
          'A CPAP runs on modest wattage, but you want a pure sine wave inverter to protect the machine. Add up your other loads and size the inverter above the total with room to spare.',
      },
    ],
  },
  {
    slug: 'best-cb-radios',
    title: 'Best CB Radios for Truckers',
    eyebrow: 'Buying guide',
    productType: 'cb-radio',
    intro:
      'The CB is still the fastest way to hear about the scale, the wreck, and the backup a mile before you reach it. A good radio and a properly tuned antenna make the difference. Here is how Shawn picks.',
    considerations: [
      'The antenna and its tuning matter as much as the radio itself — budget for both.',
      'Weather channels and a clear, front-facing display are worth having.',
      'A noise-blanking or talk-back feature helps in a loud cab.',
      'A compact or under-dash model saves space if your cab is tight.',
    ],
    faq: [
      {
        question: 'Do truckers still use CB radios?',
        answer:
          'Plenty do. It is the fastest real-time heads-up on scales, wrecks, and road conditions from the drivers right around you — information an app cannot give you in the moment.',
      },
    ],
  },
  {
    slug: 'best-dot-gear',
    title: 'Best DOT Gear for Truckers',
    eyebrow: 'Buying guide',
    productType: 'dot-gear',
    intro:
      'DOT wants your warning devices, your extinguisher, and your paperwork in order. The right kit keeps you legal on the pre-trip and covered on the breakdown you did not plan for. Here is Shawn on the essentials.',
    considerations: [
      'Warning triangles and a rated fire extinguisher are pre-trip requirements — do not run without them.',
      'A mounted, ABC-rated extinguisher within reach beats one buried in a side box.',
      'Keep your reflective gear and gloves where you can grab them fast on the shoulder.',
      'An organized kit means you can prove compliance in seconds at an inspection.',
    ],
    faq: [
      {
        question: 'What DOT-required safety gear do I need in the truck?',
        answer:
          'At minimum you need warning devices (reflective triangles), a properly rated and secured fire extinguisher, and spare fuses where applicable. Check the current FMCSA requirements for your operation.',
      },
    ],
  },
];

export function storeGuide(slug: string): BuyingGuide | undefined {
  return STORE_GUIDES.find((g) => g.slug === slug);
}

export function guideHref(slug: string): string {
  return `/store/guides/${slug}`;
}
