# Submission pack — Housebets sportsbook design

Everything the contest form asks for, in order.

## 1. Public link
**TODO after deploy:** paste the Vercel URL here and in the form.

Deploy in ~1 minute (static, no build):
1. vercel.com/new → Import `nothing010101/housebets`
2. Framework preset: **Other** · Build command: **(empty)** · Output directory: `.`
3. Deploy → copy the production URL (works without login).

Alternative: Netlify (drag the repo) or GitHub Pages (Settings → Pages → `main` / root).
GitHub Pages is currently blocked by a billing lock on the account, so Vercel is the safe path.

## 2. Pages — tick all five
- **Sports home** — `#/`
- **Live** — `#/live`
- **Football** — `#/football`
- **Match page** — `#/match/ars-bha`
- **Bet slip + My bets** — `#/bets`

## 3. Your big idea (80–800 characters)
> No silent changes. Housebets is a crypto book built on transparency — provably fair games, instant payouts, markets that never sleep. The sportsbook should behave the same way. Here every price move happens in the open, every paused market says so and counts down, and the slip refuses to place a bet on a number you did not agree to: accept the new odds or drop the selection. Placed bets land as readable receipts, not mystery rows. The result feels less like a betting catalogue and more like a live trading screen for football — the match, the price, the proof. Five pages, one continuous flow, no promos, no clutter.

Character count: 621 / 800.

## 4. Tools and templates used
> Custom HTML/CSS/JS design system written for this entry · State Lab, an in-prototype state simulator (odds pause/nudge, market suspension, forced bet success/failure) · inline SVG icon set and wave mark · Instrument Serif + Inter Tight via Google Fonts · Playwright for interaction QA · Claude as coding assistant. No Figma UI kit, no v0, no purchased template, no framework.

## 60-second review script (what to click)
1. Home → tap any 1X2 odds. The slip bar appears; the odds cell gets a ring.
2. Open the **Lab** pill (bottom-left) → `Next bet → Failure` → open the slip → **Place bet**.
   You get the failure path, no stake taken, selections preserved.
3. Lab → `Next bet → Success` → place again: balance drops, slip clears, the ticket animates into My bets.
4. Lab → `Pause a market → Total goals` → open **Arsenal v Brighton**.
   The goals market is striped with a live `Paused · 7s` countdown; clicking is rejected; the slip warns "Reopens in 7s".
5. Match page → watch a price move: flash + delta + the 60-second heartbeat line at the bottom of the button.
6. My bets → **Cash out** → confirm: the value drifts every 6s, then the bet settles as Cashed out.
7. `⌘K` / `Ctrl K` → type "brighton" → Enter (search covers teams, players, competitions, markets).
8. Resize to 390px: bottom tab bar, slip bar above it, slip opens as a 90vh sheet.

## Notes for the judges
- Front-end only, sample data, no login, no real money. State is local (`localStorage`) and can be reset from the Lab.
- The site shell, component set, SVG icon sprite, wave mark and all copy are original to this entry; no Housebets
  starter files or brand-pack assets were used (they were not publicly available).
