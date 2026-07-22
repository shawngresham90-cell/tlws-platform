# DOT Tools — Attorney Review Packet

Everything requiring counsel review before its surface ships, compiled
verbatim from the standalone application source (audited July 22, 2026).
Covers gates AT-1…AT-5 in `../../dot-tools/review-gates.md`. Questions for
counsel are listed with each section; outcomes are recorded in
`../../dot-tools/decision-log.md`.

Owner rulings that frame this review: Fix-It Letters remain **blocked from
public launch** until this packet clears (Decision 6). The official FMCSA
DataQs site (dataqs.fmcsa.dot.gov) must be the **primary** DataQ link in
all shipped content; the TLWS DataQ Tracker app may appear only as a
clearly secondary helper.

---

## Part 1 — Fix-It Letter templates (AT-1)

Five user-signed documents generated from driver inputs (name, carrier,
unit, inspection #, violation text, narrative, correction). Placeholders in
braces. Questions for counsel after the templates.

### 1.1 Driver statement

> DRIVER STATEMENT — {inspection # · date · state}
>
> On the date above, unit {unit} was inspected and the following was noted:
> "{violation as written}"
>
> Statement of facts:
> {what actually happened}
>
> Correction made: {repair/correction}
>
> This statement was written the same day while details were fresh.
> Attached: photos of the equipment, the inspection report, and the repair
> receipt / supporting records.
>
> Signed, {name}

### 1.2 Shop repair note request

> TO: Shop / Maintenance Manager
> RE: Repair documentation needed — {inspection}
>
> During a DOT inspection, the following was written against unit {unit}:
> "{violation}"
>
> Please provide, on shop letterhead:
> 1. A work order for the repair ({repair performed}), with date and time
>    completed.
> 2. The mechanic's note of what was found (root cause), and whether the
>    defect would have been visible on a standard pre-trip inspection.
> 3. Copies of the parts invoice.
>
> I need these for the carrier's file and a possible FMCSA DataQ review,
> so exact dates and times matter.
>
> Thank you, {name}

### 1.3 Company explanation memo

> TO: Safety Department, {carrier}
> RE: Explanation of violation — {inspection}
>
> Violation as recorded: "{violation}"
>
> What happened:
> {narrative}
>
> Corrective action already taken: {correction}
>
> What I am doing so this does not repeat:
> - Added this item to my documented pre-trip/en-route checks.
> - Keeping the repair and inspection paperwork in the truck for 30 days.
> - Requesting a DataQ review if the facts support one.
>
> I take the record seriously — 24 months of CSA exposure is 24 months of
> my name on it too.
>
> {name}

### 1.4 DataQ dispute draft (highest-risk template)

> DRAFT — FMCSA DataQs REQUEST FOR DATA REVIEW (RDR)
> Inspection: {inspection}
> Challenged violation: "{violation}"
>
> Requested action: Review and removal (or correction) of the violation
> above.
>
> Grounds:
> {narrative}
>
> Supporting correction: {correction}
> Supporting documents attached:
> - Inspection report (all pages)
> - Photographs taken at the scene
> - Repair order / receipts
> - Pre-trip inspection record (DVIR) for the same day
>
> The recorded violation does not accurately reflect the facts above. I
> respectfully request the record be corrected so the carrier's SMS data
> and my PSP remain accurate.
>
> Respectfully submitted, {name}, {carrier}
>
> >> File this at dataqs.fmcsa.dot.gov — and track it with the free DataQ
> Tracker: godatq.netlify.app

*(Per the owner ruling, the shipped version must lead with
dataqs.fmcsa.dot.gov as the primary link; the tracker mention is
secondary or removed — counsel's preference requested.)*

### 1.5 Preventive action letter

> PREVENTIVE ACTION PLAN — following {inspection}
>
> Issue identified: "{violation}"
>
> Root cause (plain facts):
> {narrative}
>
> Actions taken:
> 1. {correction / immediate correction completed}
> 2. Item added to my written pre-trip routine, checked every duty day.
> 3. 30-day self-audit: I will photo-log this item weekly for 4 weeks.
> 4. Reviewed the governing regulation (see citation on the inspection) so
>    the standard is clear.
>
> Requested of the carrier:
> - Please attach this plan to the violation in my driver file as evidence
>   of proactive correction.
>
> {name}

**Questions for counsel (letters):** (a) Are generated, user-signed
templates like these unauthorized-practice-of-law exposure for TLWS, and
what disclaimer/framing cures it? (b) The DataQ draft asserts factual and
quasi-legal conclusions on the driver's behalf — acceptable as a draft
with "review before sending"? (c) Should any template be removed or
gated behind stronger warnings? (d) Approve the surrounding UI text:
"Templates — review before sending · Not legal advice."

## Part 2 — The 23 "what to say" scripts (AT-2)

Verbatim officer/auditor response scripts the Violation Checker displays.
Parenthetical stage directions are part of the content.

1. **Beyond 11-hr:** "Officer, I understand. My ELD records are complete and I'm not disputing the log — I'd like to note the conditions on the record."
2. **Beyond 14-hr:** "Yes ma'am, here are my logs. The shipper held me six hours — I have the detention record if it helps the report."
3. **30-min break:** "Understood. My ELD shows the full day — I'll take the 30 before I roll."
4. **No log / ELD down:** "Officer, the ELD malfunctioned at [time]. I reported it to my carrier and I'm running paper logs per 395.34 — here they are."
5. **False log:** "I'd like to annotate the record — the duty status was logged wrong and here's the correction. (Say nothing more. Never explain a false log at roadside.)"
6. **Log not current:** "One moment officer — updating my status to current before I show you."
7. **Hand-held phone:** "Officer, my phone is mounted and paired — I use voice only. (If untrue, say nothing and sign.)"
8. **Texting:** "I understand. I'd like the report to note the phone was mounted."
9. **Seat belt:** "Yes sir. It won't happen again."
10. **Speeding 6–10:** "Respectfully, I'd like to review the posted limit at that mile marker. (Then sign, don't argue.)"
11. **Speeding 11–14:** "Yes officer. (Sign it, fight it in court, then DataQ the inspection with the dismissal.)"
12. **Speeding 15+:** "Yes officer. (Nothing else. Lawyer for the citation.)"
13. **Lamp:** "That lamp was working on my pre-trip at [time] — I'll have it repaired before I continue."
14. **Flat tire:** "I inspected at my last stop — this developed en route. I'm calling road service now."
15. **Tread:** "I'd like the measurement location noted on the report. (Tread is measured in a major groove — spot-low measurements are disputable.)"
16. **Brake adjustment:** "These have automatic slack adjusters — I'm requesting the shop inspect rather than manually re-adjust, per manufacturer guidance."
17. **Brake hose:** "Calling road service — I'd like the exact location of the defect noted for the repair order."
18. **Mud flap:** "It was intact on my pre-trip — I'll replace it at the next stop."
19. **Emergency equipment:** "Correcting it today, officer."
20. **Securement:** "I'll re-secure now and I'd like to show the corrected securement before the report is finalized."
21. **No med card on person:** "My certificate is current — it's on file with my state licensing agency. I can have a copy sent right now."
22. **Expired med card:** "Understood, officer. I'm parking and scheduling the exam immediately."
23. **No valid CDL:** "(Say nothing beyond identifying yourself. This one needs the license fixed, not words.)"

**Questions for counsel (scripts):** (a) Several scripts coach selective
silence or strategic statements to law enforcement (items 5, 7, 12, 23) —
acceptable as published guidance, and with what framing? (b) Items 5 and 7
implicitly address situations where the driver may have violated the law —
any lines to cut or rewrite? (c) Blanket caveat wording to attach to the
script feature.

## Part 3 — Roadside coaching (AT-3)

**What to SAY list:** "Yes sir / Yes ma'am" · "My CDL and medical card are
right here" · "My logs are on my ELD — let me pull them up" · "I completed
my pre-trip this morning at [time]" · "Thank you officer".

**What NOT to say list:** "I don't know" (admits lack of knowledge) · "My
dispatcher told me to..." (no excuse) · "I always do it this way" (admits
pattern) · "Am I in trouble?" (don't ask) · Anything sarcastic. Anything. ·
Don't argue the regulation on the road.

**Cheat-sheet variants:** "I'm in a hurry." · "Why am I being stopped?
(Already lost.)" · "My company / dispatcher told me…" (You're responsible —
not them.) · "I don't know." · Any cussing. Any sarcasm. Any attitude.

**Question for counsel:** same as Part 2 — the "admits pattern / admits
lack of knowledge" annotations frame ordinary statements as admissions;
approve, rewrite, or cut.

## Part 4 — Signing/arrest claims (AT-4)

From the cheat sheet, shown to a driver who has just received a violation:

> 1. **Sign it.** Refusing = arrest in some states. Signing is NOT
>    admitting guilt.
> 2. Read it before you leave the scale. Officer wrote the wrong thing?
>    Address it NOW.
> 3. Photograph every page of the inspection report.
> 4. Don't argue at the scale. Fight it in court or DataQ if you need to.
> 5. Write down everything within 30 minutes: officer name, badge #, time,
>    location, weather, what was said.

**Question for counsel:** the arrest claim and the "signing is not an
admission" claim are state-variable legal assertions — approve with
qualifier language, or cut to neutral ("refusing to sign can have serious
consequences in some states — sign, then dispute through proper channels")?

## Part 5 — Disclaimer set (AT-5)

Current disclaimers to standardize across all DOT Tools (drawn from the
legacy footers):

- "Reference aid — not legal advice."
- "Confirm against the official source (eCFR.gov / 49 CFR 350–399) before
  any compliance decision."
- "Severity/time weights follow FMCSA SMS methodology — values approximate,
  confirm at the official FMCSA site." *(to be updated to the R-SMS-08
  wording: "estimate based on public SMS methodology — not your official
  score")*
- "OOS criteria are CVSA's — officers have discretion."
- "Your answers/entries never leave this device."
- "Templates — review before sending · Not legal advice."

**Question for counsel:** approve a single master disclaimer + short
per-tool variants; confirm placement requirements (visible without
scrolling? per-result?).

## Part 6 — Document Wallet disclosure (AT-5 adjunct)

Planned user-facing disclosure for the device-local wallet (from
`../../dot-tools/wallet-model-a-spec.md`):

> Your documents are stored only on this device, in this browser. Nothing
> uploads to TLWS or anyone else. Protect them the way you protect your
> phone: use a device passcode, don't use shared or public computers, and
> export a backup after you add documents. **Clearing this site's data
> deletes your documents.** Digital copies don't satisfy every carry
> requirement — keep paper originals where the regulation requires them.

**Question for counsel:** adequate as a storage/loss-of-data disclosure?
Any liability language to add for document loss or for a driver relying on
a digital copy where paper is required?

---

## Outcome recording

| Gate | Sections | Counsel | Date | Outcome |
|---|---|---|---|---|
| AT-1 | Part 1 | | | |
| AT-2 | Part 2 | | | |
| AT-3 | Part 3 | | | |
| AT-4 | Part 4 | | | |
| AT-5 | Parts 5–6 | | | |
