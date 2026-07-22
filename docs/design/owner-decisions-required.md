# Owner Decisions Required — Design Foundation + School Front Door

Everything below was deliberately **not** decided by the implementation. Each
item is reversible; none block the PR.

## Decisions made for you (revert = small edit, flag if wrong)

1. **On-platform accent deepened `#FFEB00` → `#F5A623`** (Sodium Amber, blueprint
   §2.1). Thumbnails keep `#FFEB00`. Revert = two lines in `tailwind.config.ts`.
2. **Homepage hero headline** now the blueprint's "17 years. Zero violations.
   Now I'm training the next generation." with the school as primary CTA. The
   previous hero (Pre-School price CTA first) is preserved in git history.
3. **Secondary buttons are now outlined** (blueprint hierarchy), no longer red
   fill — red is reserved for warnings/errors. All six call sites reviewed.
4. **`LatestArticles` removed from the homepage** — it rendered three
   placeholder titles with no destinations. The component file remains; wire
   it to real `kc_articles` data to bring it back.
5. **Desktop nav trimmed to six destinations** + Apply + grouped "More" menu
   (blueprint §2.9). Nothing was removed from the site; everything nests.

## Decisions only you can make

1. **Opening date.** "October 18" appears in the blueprint but nowhere in the
   repo, so no date is displayed anywhere. When you confirm a date (and a
   licensing status to state alongside it), the hero sub-line, academy
   transparency block, and CTA copy ("Reserve your seat — opens …") are ready
   for it.
2. **"Reserve Your Seat" CTA language.** Held back until seat reservation is
   mechanically true (dated cohort + a reservation record). Current honest
   copy: "Apply — join the list."
3. **Tuition + schedule display** on `/academy` ("Where the school stands"
   block) — currently "Being finalized," per the honest-unavailable-states
   rule. Supply numbers and they drop in.
4. **GA licensing checklist page.** The transparency block promises "we
   publish our own licensing checklist." Publishing the actual 12-phase
   checklist needs your input — until then the block states details are
   published when finalized (no status is claimed).
5. **Footer legal identifiers.** LLC name renders (verified in repo). GA
   Control No. / registration identifiers were NOT added — supply the real
   numbers if you want them shown.
6. **Founder photo & night-lot hero photography** (blueprint §2.6 shoot list).
   Type-led hero ships until real photos exist; no stock, no AI images.
7. **Emoji in UI chrome.** Blueprint bans them; existing usages (academy
   pillars, store category icons) were left untouched to keep this PR's
   regression surface small. Approve a follow-up sweep to line icons.
8. **Proof-bar numbers.** Renders only repo-verified/live figures: 84K+
   YouTube, 10 practice tests, live guide count, live founder count. The
   blueprint's "1,252 truck stops" was NOT used — repo documents conflict
   (139 vs 670 vs 1,252). Confirm the real listing count and it can join the
   bar (ideally as a live query).
9. **Trip Planner nav placement.** Blueprint nests it under Directory; PR #161
   added it to the top bar. Compromise shipped: grouped under "Drive" in the
   menu + linked from the Four Doors and footer. Say the word to elevate it
   back to the top bar.
