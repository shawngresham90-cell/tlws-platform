import type { DirectoryEntry } from './types';
import { groupByCategory } from './related';

/**
 * Data-driven FAQ generation (Milestone 18 SEO). Questions are only emitted
 * when the page's own listing data can answer them truthfully — an FAQ never
 * claims coverage the directory doesn't have. Answers name real listings, so
 * every FAQ block is unique per page (no boilerplate duplication penalty).
 */

export type Faq = { question: string; answer: string };

export type FaqScope = {
  kind: 'state' | 'interstate' | 'exit';
  /** Human label: "Georgia", "I-75", "I-75 Exit 60". */
  label: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  'truck-stops': 'truck stops',
  parking: 'truck parking locations',
  'cat-scales': 'CAT scales',
  'truck-washes': 'truck washes',
  'tire-repair': 'tire and repair shops',
  'weigh-stations': 'weigh stations',
  'hotels-truck-parking': 'hotels with truck parking',
  'cdl-schools': 'CDL schools',
  'roadside-service': 'roadside services',
};

const preposition = (scope: FaqScope) => (scope.kind === 'state' ? 'in' : 'on');

function nameFew(entries: DirectoryEntry[], max = 3): string {
  return entries
    .slice(0, max)
    .map((e) => `${e.name} (${e.city}, ${e.state})`)
    .join(', ');
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildFaqs(entries: DirectoryEntry[], scope: FaqScope): Faq[] {
  if (entries.length === 0) return [];
  const faqs: Faq[] = [];
  const at = `${preposition(scope)} ${scope.label}`;
  const byCategory = groupByCategory(entries);

  // Parking: dedicated lots + overnight-friendly stops.
  const dedicated = byCategory['parking'] ?? [];
  const overnight = entries.filter(
    (e) => e.category === 'truck-stops' && (e.amenities ?? []).includes('Overnight OK'),
  );
  if (dedicated.length + overnight.length > 0) {
    const parts: string[] = [];
    if (overnight.length > 0) {
      parts.push(
        `${plural(overnight.length, 'verified truck stop')} ${at} allow overnight parking, ` +
          `including ${nameFew(overnight)}`,
      );
    }
    if (dedicated.length > 0) {
      parts.push(
        `${plural(dedicated.length, 'dedicated truck parking location')} ` +
          `(free, paid, or reservable), including ${nameFew(dedicated)}`,
      );
    }
    faqs.push({
      question: `Where can I park a semi ${at}?`,
      answer: `The directory lists ${parts.join(', plus ')}.`,
    });
  }

  // CAT scales.
  const scales = byCategory['cat-scales'] ?? [];
  if (scales.length > 0) {
    faqs.push({
      question: `Are there CAT scales ${at}?`,
      answer:
        `Yes — ${plural(scales.length, 'certified CAT scale')} ${at} ` +
        `${scope.kind === 'exit' ? 'is' : 'are'} in the directory, including ${nameFew(scales)}.`,
    });
  }

  // Showers.
  const showers = entries.filter((e) => (e.amenities ?? []).includes('Showers'));
  if (showers.length > 0) {
    faqs.push({
      question: `Which truck stops ${at} have showers?`,
      answer: `${plural(showers.length, 'listing')} ${at} ${
        showers.length === 1 ? 'has' : 'have'
      } showers, including ${nameFew(showers)}.`,
    });
  }

  // Coverage overview.
  const categorySummary = Object.entries(byCategory)
    .filter(([slug]) => CATEGORY_LABELS[slug])
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([slug, list]) => `${list.length} ${CATEGORY_LABELS[slug]}`)
    .join(', ');
  if (categorySummary) {
    faqs.push({
      question:
        scope.kind === 'exit'
          ? `What services are at ${scope.label} for truck drivers?`
          : `What driver services does the directory cover ${at}?`,
      answer:
        `${plural(entries.length, 'verified location')} ${at}: ${categorySummary}. ` +
        'Every listing is human-verified before it appears.',
    });
  }

  // Repair / breakdown.
  const repair = [...(byCategory['tire-repair'] ?? []), ...(byCategory['roadside-service'] ?? [])];
  if (repair.length > 0) {
    faqs.push({
      question: `Where can I get truck repairs or roadside help ${at}?`,
      answer:
        `${plural(repair.length, 'tire, repair, or roadside listing')} ${at}, ` +
        `including ${nameFew(repair)}.`,
    });
  }

  return faqs.slice(0, 5);
}
