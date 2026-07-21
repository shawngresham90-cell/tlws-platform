# Analytics setup — Plausible (owner guide)

The site ships a cookieless Plausible integration that is **off by default**.
Nothing loads and every `trackEvent()` call is a silent no-op until you set
one environment variable. There are no secrets involved — the only value the
browser sees is the site's own domain.

## Owner steps (about 15 minutes)

1. **Create the account.** Sign up at plausible.io and add the site with
   domain exactly: `truckinglifewithshawn.com`.
2. **Set the environment variable.** In Netlify → Site settings →
   Environment variables, add:

   ```
   NEXT_PUBLIC_PLAUSIBLE_DOMAIN=truckinglifewithshawn.com
   ```

   Redeploy. That's the entire integration switch — the loader
   (`src/components/analytics/PlausibleAnalytics.tsx`) renders the script
   only when this variable exists.
3. **Mark goals** in the Plausible dashboard (Site settings → Goals →
   Add goal → Custom event) so conversions chart out of the box. These
   events already fire in the code today:

   | Goal (custom event)            | What it measures                     |
   | ------------------------------ | ------------------------------------ |
   | `application_started`          | Academy funnel entry                 |
   | `application_submitted`        | Academy application completed        |
   | `claimSubmitted`               | CDL Pre-School founding claim        |
   | `practice_test_completed`      | Practice-test engagement             |
   | `store_amazon_cta_click`       | Store affiliate click-outs           |
   | `newsletter_lead_captured`     | Homepage newsletter signup           |

4. **UTM tracking works automatically.** Links tagged
   `?utm_source=youtube&utm_campaign=<video>` segment under Top Sources
   with no extra setup.

## Behavior guarantees

- **Env unset → zero analytics bytes** shipped; no console errors; every
  event call no-ops (the dispatcher in `src/lib/analytics.ts` is unchanged).
- **Env set → pageviews are automatic**; custom events flow through the
  existing `trackEvent(name, props)` — no event names or payloads changed.
- A queue shim defines `window.plausible` before the vendor script loads, so
  events fired during page start are queued, not lost.
- Cookieless: no consent banner required (GDPR/CCPA-safe by design).
- Preview deploys: leave the variable unset for deploy previews (Netlify
  lets you scope it to production only) so preview traffic never pollutes
  the dashboard.

## Verifying it works

After deploying with the variable set: open the site, then Plausible's
Realtime view — your visit appears within seconds. Submit the newsletter
form and the `newsletter_lead_captured` goal fires. `scripts/test-analytics.ts`
covers the dispatcher and loader contracts offline in CI.
