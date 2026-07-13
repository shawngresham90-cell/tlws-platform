# Accessibility Audit — Public Directory Surfaces

**Repo:** /workspace/tlws-platform · branch `feat/search-revenue-optimization`
**Scope:** `src/app/(directory)/**`, `src/components/directory/**`, `src/components/ui/**`, plus the shared root layout (`src/app/layout.tsx`), `src/components/layout/Header.tsx` / `Footer.tsx`, `src/components/kc/Breadcrumbs.tsx`, and the client islands those pages mount (`src/components/community/*`, `src/components/map/*`, `src/components/apply/Fields.tsx`, `TurnstileWidget.tsx`).
**Method:** static source review (live site not reachable from this environment). Contrast ratios computed from the hex values in `tailwind.config.ts` using the WCAG relative-luminance formula.
**Severity scale:** Critical / Serious / Moderate / Minor.

---

## What's already good (verified, not assumed)

- **Skip link** present and correctly implemented (`src/app/layout.tsx:37-42`), targeting `<main id="main">` (`layout.tsx:44`). Landmarks are solid: `header`, labeled `nav`s (`Header.tsx:35`, `74`; `Footer.tsx:59`; `Breadcrumbs.tsx:8` with `aria-current="page"` at `:17`), `main`, `footer`.
- **Every input/select in scope has a programmatic label.** Verified individually: `DirectoryBrowser.tsx:84/100/123/145` (sr-only), `MultiCategoryBrowser.tsx:135` (sr-only), `MapExplorer.tsx:238/265/283/301/319/337` (sr-only + visible), all `TextField`/`SelectField`/`TextAreaField`/`TriStateField`/`CheckboxField` wrappers (`apply/Fields.tsx`, `community/Fields.tsx`), `LocationPicker.tsx:50`.
- **Live regions**: result counts announce via `aria-live="polite"` (`DirectoryBrowser.tsx:163`, `MultiCategoryBrowser.tsx:181`), map status via `role="status"` (`MapExplorer.tsx:387`), form errors via `aria-live="assertive"` wrappers + `role="alert"` on field errors.
- Filter chips correctly use `aria-pressed` (`MultiCategoryBrowser.tsx:154/168`, `MapExplorer.tsx:364/375`).
- Form fields wire `aria-invalid` / `aria-describedby` / `role="alert"`; honeypot is `aria-hidden` + `tabIndex={-1}` (`community/Fields.tsx:113-134`).
- Leaflet markers are created with `keyboard: true` + `title`/`alt` (`LeafletMap.tsx:179-184`, `MapPreview.tsx:61`); map containers have `role="region"` + `aria-label` (`LeafletMap.tsx:277-279`, `MapPreview.tsx:87-91`).
- Core text contrast passes comfortably (see table in §3).

---

## 1. Findings

### F1 — SERIOUS · Error/red text fails contrast everywhere it appears (2.80:1)
**WCAG:** 1.4.3 Contrast (Minimum)
`diesel` = `#B91C1C` (`tailwind.config.ts:28`) used as *text* on dark backgrounds:
- `src/components/community/Fields.tsx:62` and `src/components/apply/Fields.tsx:26` — field error messages (`text-diesel` on form card `bg-asphalt-800`): **2.80:1** (needs 4.5:1)
- `src/components/community/SubmitLocationForm.tsx:246` and `ReviewForm.tsx:136` — form-level error banner (`text-diesel` on `bg-diesel/10` over `asphalt-800` ≈ **2.67:1**)
- `src/components/apply/TurnstileWidget.tsx:183` — config-error alert
- `src/components/map/MapExplorer.tsx:394` — "The map failed to load" notice
- Required-field asterisks (`text-diesel`, e.g. `apply/Fields.tsx:14`) — these are `aria-hidden`, but still sighted-user signal at 2.8:1.

This is the worst possible place to fail contrast: the text users must read to recover from an error.
**Fix:** add a light error tone to the palette, e.g. `diesel: { DEFAULT: '#B91C1C', 300: '#F87171', 700: '#991B1B' }` — `#F87171` on `asphalt-800` = **6.54:1**. Use `text-diesel-300` for all error *text* on dark; keep `#B91C1C` for borders/backgrounds only. (`#EF4444` = 4.81:1 also passes if the brand wants it darker.)

### F2 — SERIOUS · StarRatingInput claims radio semantics it doesn't implement
**WCAG:** 4.1.2 Name, Role, Value; 2.1.1 Keyboard
`src/components/community/StarRatingInput.tsx:31-52` — `role="radiogroup"` containing five `<button role="radio">`. The comment (line 6-7) says keyboard users "pick with arrow keys / space like native radios," but no arrow-key handling or roving `tabindex` exists. A screen-reader user is told "radio button, 1 of 5" and expects arrow keys to change selection; they don't. All five stops are also in the tab order, which contradicts the radio pattern.
**Fix (pick one):**
- Simplest: drop `role="radio"`/`role="radiogroup"`, keep them as toggle buttons with `aria-pressed={value === star}` and a `role="group" aria-label="Star rating"` wrapper (the group announcement text at `:53-57` already gives the current value); or
- Use five visually-hidden native `<input type="radio" name="rating">` styled via their labels (free arrow-key behavior); or
- Implement the full APG radio pattern (roving tabindex + ArrowLeft/Right/Up/Down handlers).
Also: when `error` is set (`:59-63`), nothing links it to the group — add `aria-describedby` on the group container.

### F3 — SERIOUS · LocationPicker misuses listbox/option roles and drops focus on selection
**WCAG:** 4.1.2 Name, Role, Value; 2.4.3 Focus Order
`src/components/community/LocationPicker.tsx:92-112` (used by both `/directory/submit` and `/directory/reviews`):
- `role="listbox"` is on the `<ul>`, but its children are plain `<li>` (implicit `listitem` — invalid inside a listbox) wrapping `<button role="option">`. Options must be owned by the listbox; this structure is broken for AT.
- `aria-selected={false}` is hard-coded (`:104`) — never true, even for the match about to be chosen.
- The text input (`:76-90`) drives the list but has no `role="combobox"`, `aria-expanded`, or `aria-controls`, and arrow keys don't move through results — so the ARIA promises a pattern the keyboard can't deliver.
- **Focus loss:** clicking/pressing a result removes the entire input+list subtree (the component re-renders into the "selected" panel, `:60-73`), so keyboard focus falls to `<body>`. Same when "Change" (`:63-71`) is pressed in reverse.
- Result appearance/count is not announced (no live region on the matches list).
**Fix:** (a) remove `role="listbox"`/`role="option"`/`aria-selected` — a labeled group of plain buttons is honest and fully operable via Tab; (b) add a polite live region announcing "`N` matches shown"; (c) after selection, move focus to the "Change" button (`ref` + `useEffect`), and after "Change," focus the search input. Full APG combobox is the deluxe option but not required.

### F4 — MODERATE · Directory search/filter controls remove the focus outline and replace it with a 1px border tint
**WCAG:** 2.4.7 Focus Visible (weak indicator); 2.4.11 Focus Appearance (fails area requirement)
`src/components/directory/DirectoryBrowser.tsx:16-18` and `MultiCategoryBrowser.tsx:19-21`:
```
'focus:border-signal focus:outline-none'
```
`focus:outline-none` suppresses the UA outline; the only indicator is the existing 1px border changing `#333`→`#FFEB00`. Visible, but a 1px color swap is far weaker than the site's own convention — `ui/Button.tsx:8-9` and both `Fields.tsx` files use `focus(-visible):ring-2 ring-signal ring-offset-2`. There **is** a focus-ring convention; these two components just don't follow it.
**Fix:** change the shared `inputClasses` string in both files to `focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt` (identical to `community/Fields.tsx:12-13`). Same for `selectClasses` in `MapExplorer.tsx:44-46` (it has `focus:ring-2` already — fine) — only the two browser components are the gap.

### F5 — MODERATE · Hover-only affordances with no focus parity on custom buttons/links
**WCAG:** 2.4.7 Focus Visible (best-practice/consistency — UA default outline is not suppressed, so this is not a hard fail)
These interactive elements style `hover:` but define no `focus`/`focus-visible` classes, relying on the browser default outline (inconsistent with the Button convention and easy to lose against the dark theme):
- "Load more" — `DirectoryBrowser.tsx:191-197`
- Category chips and "Show all/Show fewer" — `MultiCategoryBrowser.tsx:151-177`, `:61-68`
- `browseChip` links — `(directory)/directory/page.tsx:30-32`; exit chips — `[category]/page.tsx:310-318`; related-link chips — `RelatedLinks.tsx:15-17`
- Header/footer nav links (`Header.tsx:40`, `Footer.tsx:66`), EntryCard links (`EntryCard.tsx:21-24`)
**Fix:** add a shared `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt` utility (e.g. a `.focus-ring` component class in `globals.css`) and apply it to these. Low risk, purely additive.

### F6 — MODERATE · Input boundaries fail non-text contrast
**WCAG:** 1.4.11 Non-text Contrast
`line` = `#333333` borders on `bg-asphalt-800` (`#161616`) = **1.43:1** (needs 3:1 for the component boundary), and the field background itself vs. the page background (`#161616` vs `#0E0E0E`) is ~1.19:1, so the border is the only boundary cue. Affects every text input/select in `DirectoryBrowser`, `MultiCategoryBrowser`, `MapExplorer`, and the two community forms.
**Fix:** introduce `line-strong: '#6B6B6B'` (**3.40:1** on `asphalt-800`) and use it for form-control borders (`border-line-strong`); keep `#333` for purely decorative hairlines/card edges (decorative dividers are exempt from 1.4.11).

### F7 — MODERATE · Placeholder text fails contrast
**WCAG:** 1.4.3 Contrast (Minimum)
`placeholder:text-muted/60` = `#A3A3A3` at 60% over `#161616` ≈ **3.40:1** (needs 4.5:1). Locations: `DirectoryBrowser.tsx:17`, `MultiCategoryBrowser.tsx:20`, `apply/Fields.tsx:6`, `community/Fields.tsx:12`, `LocationPicker.tsx:86`.
**Fix:** use `placeholder:text-muted` un-diluted (**7.17:1**). If a visual step-down from real input text is wanted, `muted/80` ≈ 5.4:1 also passes.

### F8 — MODERATE · Heading level skips (h1 → h3) on four page types
**WCAG:** 1.3.1 Info and Relationships (skips are best-practice; the audit criterion here is consistent structure for SR navigation)
`EntryCard` hard-codes `<h3>` for the listing name (`EntryCard.tsx:19`). That's correct when nested under an `h2` (MultiCategoryBrowser sections, truck-parking corridor state sections), but these surfaces render EntryCards with **no h2 ancestor**:
- **Category pages** (`/directory/truck-stops` etc.): `DirectoryHero` h1 (`DirectoryHero.tsx:26`) → `DirectoryBrowser` results grid → EntryCard `h3` (`[category]/page.tsx:164`). Skip. (RelatedLinks' h2 "Keep exploring" comes *after* the h3s.)
- **`/directory/parking`**: OK — cards sit under the "Find a spot" h2 (`parking/page.tsx:175`). Not affected.
- **Top-truck-stops** (`[category]/top-truck-stops/page.tsx:110-116`): h1 → `<ol>` of EntryCard h3s. Skip.
- **New-locations** (`new-locations/page.tsx:80-94`) and **recently-updated** (`recently-updated/page.tsx:68-82`): h1 → EntryCard h3s. Skip.
- **Submit page success state** (`SubmitLocationForm.tsx:227`): `<h3>Thanks, driver</h3>` on a page whose only other heading is the h1 — skip. (`ReviewForm.tsx:117` is fine because the reviews page puts the form under an h2, `reviews/page.tsx:53`.)
**Fix:** give `EntryCard` a `headingLevel?: 'h2' | 'h3'` prop exactly like `CategoryCardGrid.tsx:16` already does, and pass `h2` from DirectoryBrowser/top-truck-stops/new-locations/recently-updated (or add a visible/sr-only `h2` like "Results" above each grid). Change `SubmitLocationForm.tsx:227` `h3`→`h2`.
Multiple-h1 check: every page type in scope renders exactly one h1 (via `DirectoryHero` or the page hero). No violations found.

### F9 — MODERATE · Expand/collapse toggle lacks `aria-expanded`
**WCAG:** 4.1.2 Name, Role, Value
`MultiCategoryBrowser.tsx:61-68` — "Show all N / Show fewer" toggles an expanded region with no `aria-expanded` and no announcement of the newly revealed content.
**Fix:** add `aria-expanded={expanded}` (the label change already helps; the attribute makes state programmatic). Optionally `aria-controls` pointing at the grid wrapper. The "Load more" button (`DirectoryBrowser.tsx:191`) is append-only, so `aria-expanded` doesn't apply there — but the aria-live count at `:163` already reflects the total, not the *shown* count; consider announcing "Showing X of Y" so Load more has an audible effect.

### F10 — MODERATE · `Stars` rating conveys its value via `aria-label` on a bare `<span>`
**WCAG:** 1.3.1 / 4.1.2
`src/components/community/ReviewList.tsx:8-15` — `aria-label` on a generic `<span>` has no role, so many AT combinations ignore it and read the raw `★★★★★` characters (or nothing). Also the empty stars are `text-line` (`#333`) on `asphalt-800` = **1.43:1** — sighted low-vision users can't see how many stars are *unfilled*.
**Fix:** `<span role="img" aria-label={`${rating} out of 5 stars`}>` with the star glyphs wrapped in `aria-hidden="true"`; lighten empty stars to `text-asphalt-600`+ or `#6B6B6B`.

### F11 — MINOR · Header mobile menu: stale accessible name, menu never closes
**WCAG:** 4.1.2 (name/state), usability
`src/components/layout/Header.tsx:55-88` — the native `<details>` disclosure is a good zero-JS pattern (expanded state is exposed natively), but:
- `aria-label="Open menu"` (`:58`) overrides any state-sensitive naming and stays "Open menu" while the menu is open.
- Next.js client-side navigation leaves the `<details>` open after a link is chosen; no Esc handling. A keyboard/SR user lands on the new page with the old menu still expanded over the content.
**Fix:** rename to `aria-label="Menu"` (state comes from the disclosure itself). Closing-on-navigate needs a tiny client wrapper (or `onClick` on the links that removes the `open` attribute) — worth it, but it's a behavior change, not a one-liner.

### F12 — MINOR · Generic repeated "Website" links; new-tab links unannounced
**WCAG:** 2.4.4 Link Purpose (In Context) — technically passes via surrounding card text, but the card grid produces dozens of identical "Website" links in the SR links list; 3.2.5/G201 advisory for new windows.
- `EntryCard.tsx:61-69` "Website", `MapExplorer.tsx:499-508` "Website" — no per-entry accessible name, `target="_blank"` with no warning.
- The codebase already has the right convention: `location/[slug]/page.tsx:259` and `MapExplorer.tsx:514` use `aria-label={"Get directions to X (opens in new tab)"}`.
**Fix:** `aria-label={`${entry.name} website (opens in new tab)`}` on both Website links; same treatment for `tpcUrl` "Reserve a spot" (`EntryCard.tsx:84-93`, `MapResultCard`, `SponsorSlot.tsx:30-41`).

### F13 — MINOR · `bg-asphalt-900` doesn't exist in the Tailwind palette
`src/components/directory/SponsorSlot.tsx:34` uses `bg-asphalt-900`, but `tailwind.config.ts:21-26` only defines `asphalt` DEFAULT/800/700/600. The class silently generates nothing, so sponsor tiles render on the translucent `asphalt-800/60` aside — contrast still passes today (`muted` on that blend ≈ 7.4:1) but the intended surface is missing and future changes could break contrast unpredictably. (Also used at `admin/(dashboard)/directory/sponsors/page.tsx:41`, out of scope.)
**Fix:** change to `bg-asphalt` or add `900: '#0A0A0A'` to the palette.

### F14 — MINOR · Decorative emoji exposed to screen readers in link/button names
**WCAG:** 1.1.1 / verbosity
Emoji inside accessible names get announced ("world map", "national park"…): `🗺️ View on map` (`(directory)/directory/page.tsx:87`, `location/[slug]/page.tsx:269`), `🆕/🔄` chips (`page.tsx:98-103`), `🏆` (`[category]/page.tsx:230`), `🅿️` (`:300`), `📍 Use my location` (`MapExplorer.tsx:235`), `📍/⭐` hub cards are **correctly** `aria-hidden` (`page.tsx:112/125`) — as are CategoryCardGrid icons (`CategoryCardGrid.tsx:27-32`). Category chips interpolate `{c.icon}` into the button text (`MultiCategoryBrowser.tsx:175`) and MapResultCard does `{cat.icon} {cat.title}` (`MapExplorer.tsx:475`).
**Fix:** wrap emoji in `<span aria-hidden="true">` (the established in-repo pattern).

### F15 — MINOR · Validation errors don't move focus; motion effects ignore reduced-motion
- On submit with errors, `SubmitLocationForm.tsx:166-169` / `ReviewForm.tsx:71-74` set error state (announced via `role="alert"`) but leave focus on the submit button; keyboard users must hunt backwards. Fix: focus the first `[aria-invalid="true"]` field after `setErrors`. (WCAG 3.3.1 is met; this is the recommended enhancement.)
- `prefers-reduced-motion` is handled only for `scroll-behavior` (`globals.css`); the FAQ chevron rotation (`FaqSection.tsx:20`) and star `hover:scale-110` (`StarRatingInput.tsx:46`) are small enough to be low risk, but a global `motion-reduce:transition-none` on these would finish the job (2.3.3 AAA).

### F16 — MINOR (latent) · Clickable SVG `<g>` without keyboard support
`src/components/map/MapMarker.tsx:24-29` and `:54-59` attach `onClick` to `<g>` elements with no `tabIndex`/key handling (2.1.1). **Currently unreferenced by any page** (grep found no importers outside `components/map`; the live map path is Leaflet). Flagging so it isn't wired in as-is; add `tabIndex={0}` + Enter/Space handling or `<a>`/`<button>` wrappers before use, or delete.

### Keyboard-nav checks that came back clean
- No `onClick`-on-`div`/non-interactive elements anywhere in the audited public surfaces (MapResultCard's whole-card select is a real `<button>`, `MapExplorer.tsx:460-483`; hub tiles are `<Link>`s).
- No focus traps: no custom modals/dialogs in scope; Leaflet popups and `<details>` menus are natively escapable; honeypot is `tabIndex={-1}`.
- Skip link present (see top).

---

## 3. Color contrast reference (computed from `tailwind.config.ts`)

| Pair (usage) | Ratio | 4.5:1 body | 3:1 large/UI |
|---|---|---|---|
| `ink #F5F5F5` on `asphalt #0E0E0E` (body text) | **17.71:1** | PASS | PASS |
| `ink` on `asphalt-800 #161616` (cards) | **16.60:1** | PASS | PASS |
| `muted #A3A3A3` on `asphalt` (intros, footer) | **7.65:1** | PASS | PASS |
| `muted` on `asphalt-800` (card meta, EntryCard) | **7.17:1** | PASS | PASS |
| `muted` on `asphalt-700 #1F1F1F` | **6.53:1** | PASS | PASS |
| `signal #FFEB00` on `asphalt` (links/eyebrows) | **15.75:1** | PASS | PASS |
| `signal` on `asphalt-800` | **14.77:1** | PASS | PASS |
| `asphalt` on `signal` (primary CTA) | **15.75:1** | PASS | PASS |
| `asphalt` on `signal-600 #E6D400` (CTA hover) | **12.67:1** | PASS | PASS |
| `signal` on `signal/10`-over-`a800` (amenity chips) | **11.68:1** | PASS | PASS |
| `ink` on `diesel #B91C1C` (secondary Button) | **5.93:1** | PASS | PASS |
| **`diesel` text on `asphalt`** (errors) | **2.98:1** | **FAIL** | FAIL for body / pass only ≥24px |
| **`diesel` text on `asphalt-800`** (form errors) | **2.80:1** | **FAIL** | **FAIL** |
| **`diesel` on `diesel/10`-over-`a800`** (error banner) | **2.67:1** | **FAIL** | **FAIL** |
| **`muted/60` placeholder on `asphalt-800`** | **3.40:1** | **FAIL** | — |
| **`line #333` border on `asphalt-800`** (input boundary) | **1.43:1** | — | **FAIL (1.4.11)** |
| **`line` empty stars on `asphalt-800`** | **1.43:1** | — | **FAIL** |
| Fix candidates: `#F87171` on `a800` = 6.54:1 · `#EF4444` on `a800` = 4.81:1 · `#6B6B6B` border on `a800` = 3.40:1 | | | |

## 4. Heading hierarchy by page type (traced)

| Page | Structure | Verdict |
|---|---|---|
| Hub `/directory` | h1 → h2 (category cards via `CategoryCardGrid` default, Submit/Reviews tiles, Browse by state/interstate) | OK |
| Category (engine + `/parking` browser section) | h1 → **h3 EntryCards (no h2)** → h2 Keep exploring → h3 groups | **Skip (F8)**; also h2 appears *after* h3s |
| `/directory/parking` (custom) | h1 → h2 ×4 → h3 (types, cards under "Find a spot" h2) | OK |
| State `/directory/georgia` | h1 → h2 (Featured/category sections, Around X, FAQ, Keep exploring) → h3 | OK |
| Interstate `/directory/i75` | h1 → h2 (Jump to an exit, state sections, Around, FAQ) → h3 | OK |
| Exit `/directory/i75/exit-201` | h1 → h2 (state groups, Around, FAQ, Keep exploring) → h3 | OK |
| `truck-parking` corridor | h1 → h2 (state names) → h3 (EntryCards) | OK |
| `top-truck-stops` | h1 → **h3 EntryCards** | **Skip (F8)** |
| Detail `/directory/location/[slug]` | h1 → h2 (At a glance, What drivers should know, Amenities, Where it sits, Driver reviews, Nearby) → h3 | OK |
| Map `/directory/map` | h1 → h2 ("N locations") | OK |
| `new-locations` / `recently-updated` | h1 → **h3 EntryCards** | **Skip (F8)** |
| Submit | h1 → (no h2) → **h3 success state** | **Skip (F8)** |
| Reviews | h1 → h2 ×2 → h3 (review titles) | OK |

Single h1 per page everywhere. Footer/Header use `<p>` for column labels (not headings) — acceptable.

---

## SAFE TO APPLY NOW (mechanical, low-risk, no behavior change)

1. **Error color token** (F1): add `diesel-300: '#F87171'` to `tailwind.config.ts`; swap `text-diesel` → `text-diesel-300` in `apply/Fields.tsx:26`, `community/Fields.tsx:41,62,118`, `StarRatingInput.tsx:26,60`, `SubmitLocationForm.tsx:246,255`, `ReviewForm.tsx:136`, `TurnstileWidget.tsx:183`, `MapExplorer.tsx:394`.
2. **Focus ring on browser inputs** (F4): in `DirectoryBrowser.tsx:16-18` and `MultiCategoryBrowser.tsx:19-21`, replace `focus:border-signal focus:outline-none` with the ring recipe already used in `community/Fields.tsx:12-13`.
3. **Placeholder contrast** (F7): `placeholder:text-muted/60` → `placeholder:text-muted` in the 5 files listed.
4. **`Stars` role** (F10): `role="img"` + `aria-hidden` star glyphs in `ReviewList.tsx:8-15`; empty stars `#333` → `asphalt-600`/`#6B6B6B`.
5. **`aria-expanded`** (F9): add `aria-expanded={expanded}` at `MultiCategoryBrowser.tsx:63`.
6. **`bg-asphalt-900` fix** (F13): `SponsorSlot.tsx:34` → `bg-asphalt`.
7. **Website link names** (F12): `aria-label={`${entry.name} website (opens in new tab)`}` at `EntryCard.tsx:63`, `MapExplorer.tsx:501`.
8. **Emoji `aria-hidden` wrappers** (F14) at the listed call sites (follow the existing `page.tsx:112` pattern).
9. **EntryCard heading prop** (F8): copy the `headingLevel` prop pattern from `CategoryCardGrid.tsx:16`; pass `"h2"` from `DirectoryBrowser`, `top-truck-stops`, `new-locations`, `recently-updated`; change `SubmitLocationForm.tsx:227` h3→h2.
10. **Input border token** (F6): add `line-strong: '#6B6B6B'` and use `border-line-strong` on form controls only.

Needs design/behavior discussion before applying: F2 (star rating pattern), F3 (LocationPicker rework + focus management), F5 (site-wide focus-visible utility), F11 (mobile menu close-on-navigate), F15 (focus-first-error).
