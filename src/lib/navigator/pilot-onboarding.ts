/**
 * Pilot onboarding (pilot-ops priority 1).
 *
 * A driver's first trip with this app should not be the trip where they
 * discover what it does not do. Eight cards, read once, before the truck
 * moves.
 *
 * The copy lives in a data module rather than in JSX for two reasons.
 * First, it can be tested: the harness pins that the truck-profile card
 * and the signs-govern card exist and are first, so a future edit cannot
 * quietly demote them. Second, it can be counted: onboarding is the one
 * place in this app where reading is the task, so its length is a budget,
 * checked like the glanceability budget on the driving surface.
 *
 * Copy discipline: these are operating instructions, not legal text. The
 * signs card tells a driver what to do when the app and a posted sign
 * disagree — follow the sign — which is a safety instruction. It makes no
 * warranty, disclaimer, or liability claim, and none should be added here
 * without the owner writing it.
 *
 * Pure data. No clock, no storage, no I/O.
 */

export type OnboardingCard = Readonly<{
  id: string;
  title: string;
  /** One or two short sentences. Kept under BODY_BUDGET_CHARS. */
  body: string;
}>;

/**
 * A card longer than this stops being read. Enforced by the harness, not
 * by truncation — a card that outgrows the budget should be rewritten or
 * split, not silently clipped.
 */
export const BODY_BUDGET_CHARS = 200;

export const PILOT_ONBOARDING: readonly OnboardingCard[] = Object.freeze([
  {
    id: 'pilot',
    title: 'This is a pilot',
    body: 'You are testing an early build. Expect rough edges, and tell us about them — a reported problem is the whole point of this phase.',
  },
  {
    id: 'signs',
    title: 'Signs win, always',
    body: 'Posted signs, posted restrictions, and road closures govern. If the app and a sign disagree, follow the sign and report it afterwards.',
  },
  {
    id: 'profile',
    title: 'Check your truck profile',
    body: 'Routes are only as legal as the numbers behind them. Confirm height, width, length, weight and axles before you plan a trip.',
  },
  {
    id: 'destination',
    title: 'Search, then start',
    body: 'Search an address, business, or truck stop and choose it from the list. Review the route, then press Start navigation.',
  },
  {
    id: 'voice',
    title: 'Mute and unmute',
    body: 'Voice starts muted. The voice button turns it on and off, and it works while you are moving — one touch, no menu.',
  },
  {
    id: 'recenter',
    title: 'Recenter',
    body: 'The map follows your truck. If you zoom out to look ahead, Recenter brings it straight back — also available while moving.',
  },
  {
    id: 'report',
    title: 'Report a problem',
    body: 'Pull over first. The report picks up what the app was doing at the time, so you only choose a category and add a line if you want.',
  },
  {
    id: 'wrong-route',
    title: 'If the route looks wrong',
    body: 'Do not take it. Stop somewhere safe, report it, and route again. A route that looks wrong for your truck usually is.',
  },
]);

/*
 * There is deliberately no "seen" marker here. Remembering a dismissal
 * would mean persisting it, and no file under `src/components/navigator/`
 * may touch storage — that rail exists so a safety-lock passenger
 * override can never survive a reload, and a briefing is not a good
 * enough reason to put the first storage call in that directory. The
 * briefing opens once per app load and collapses to a toggle.
 */
