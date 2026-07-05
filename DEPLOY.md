# DEPLOY TO NETLIFY — 10 MINUTES

Your site is a Next.js app. Netlify has to BUILD it (you can't just drag-drop a zip).
Two ways. Pick ONE. GitHub is the better long-term move.

============================================================
## FASTEST: Netlify CLI (no GitHub needed)
============================================================
On your computer, unzip this folder, then in a terminal INSIDE the folder:

1. Install Netlify CLI (one time):
   npm install -g netlify-cli

2. Log in:
   netlify login

3. Deploy:
   netlify deploy --build --prod

   - When it asks, choose "Create & configure a new site"
   - Pick your team, name it: truckinglifewithshawn

4. Set the 2 env vars (REQUIRED — site errors without them):
   netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://cgvxwvymkembftznhcdl.supabase.co"
   netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "sb_publishable_3JMot8BxqlpCz9ZJvg0UuA_krd3xQ_O"

5. Redeploy so the keys take effect:
   netlify deploy --build --prod

DONE. It prints your live URL.

============================================================
## BETTER LONG-TERM: GitHub → Netlify (auto-deploys on every change)
============================================================
1. Make a new EMPTY repo on github.com (e.g. tlws-platform). Don't add a README.

2. In this folder, in a terminal:
   git remote add origin https://github.com/YOURNAME/tlws-platform.git
   git push -u origin main

   (This folder is ALREADY a git repo with all your commits. Just push.)

3. On netlify.com → Add new site → Import an existing project → pick GitHub → pick the repo.
   - Build command:  npm run build   (auto-detected)
   - Publish dir:    .next           (auto-detected)
   - Click Deploy.

4. Netlify → Site → Settings → Environment variables → add these 2:
   NEXT_PUBLIC_SUPABASE_URL   = https://cgvxwvymkembftznhcdl.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_3JMot8BxqlpCz9ZJvg0UuA_krd3xQ_O

5. Netlify → Deploys → Trigger deploy → Deploy site (so the keys load).

DONE. Every future "git push" auto-deploys.

============================================================
## WHAT WORKS RIGHT NOW (after deploy)
============================================================
- Homepage (all 13 sections)
- Knowledge Center (/knowledge) + the 2 sample articles + search
- Founders thermometer (reads live from your DB)
- SEO: /sitemap.xml, /robots.txt, /llms.txt

## WHAT'S OFF UNTIL THE EIN CLEARS (on purpose)
- Payments (Stripe) — dormant until you have the business bank account
- Email/SMS sending — dormant behind env flags

## LATER (optional env vars — leave blank for now)
See .env.example for the full list. You do NOT need them to launch.
The 2 Supabase keys above are the ONLY ones required.

============================================================
## POINT YOUR DOMAIN (truckinglifewithshawn.com)
============================================================
Netlify → Domain settings → Add custom domain → follow the DNS steps.
Do this AFTER the site is live and you've confirmed it works.
