# Housebets Sportsbook — contest prototype

**Live:** https://nothing010101.github.io/housebets/

![Sports home preview](preview.jpg)

Clickable prototype for the [Housebets · sportsbook design](https://www.housebets.com/id/contests/sportsbook-design) contest.
Five pages, one shell, sample data. No login, no backend, no real money.

> Note: the starter files (site shell + brand pack) were not available to this account, so the shell, palette and
> typography were derived directly from housebets.com — the wave wordmark, deep marine surfaces and the sea-glass aqua accent.

---

## Run

```bash
# just open index.html, or:
python3 -m http.server 8080
# then http://localhost:8080
```

No build step, no dependencies, no network requests except Google Fonts.
All state (slip, demo balance, bets, follows) lives in `localStorage`.

---

## The five pages

| Page | Route | What is there |
| --- | --- | --- |
| Sports home | `#/` | Live spotlight, Live now, Starting soon, Top competitions, sports nav, search |
| Live | `#/live` | Every match in play, sport + competition filters, live score & clock, empty state → Starting soon |
| Football | `#/football` | 5 leagues, match-result odds on every row, follow a team or competition, "For you" section |
| Match | `#/match/ars-bha` | Arsenal v Brighton live, scoreboard, 6 market groups, odds moving, markets suspended |
| Slip + My bets | `#/bets` | Singles, USDT stakes, odds changed, selection suspended, bet placed / bet failed, cash out |

Every page is linked through the left nav, cards, fixture rows, breadcrumb and the slip.

---

## What actually works

**Living markets.** 1X2 odds on every live match drift every 3.2 seconds with a green/red flash and a delta arrow.
Market groups on the match page move too. "Total goals", "Total cards" and "Both teams to score" take turns
being suspended for 10 seconds — the odds turn striped, taps are rejected and the slip shows a warning.

**Scores & clocks.** Match minutes advance on their own, goals can land, and matches that have not started show a
real countdown that ticks down and flips the fixture to live.

**Bet slip.**
- Tap odds → add to slip. Tap again → remove. Singles only, no multis.
- Per-selection stake (input + 10/25/50/Max chips), potential return updates as you type.
- If odds move by 0.03 or more after you pick, the item shows `Odds moved 1.74 → 1.66` and **Place bet** stays
  locked until you press **Accept** (or **Decline**).
- A suspended selection blocks placement with a clear reason.
- **Place bet** processes for ~1 second. 12% of attempts fail (market closed / odds moved) with an error and no stake deducted.
- On success the demo balance drops, the slip clears and the new ticket animates into My bets.

**My bets.** Open / Settled tabs, cash-out value drifts every 6 seconds, inline cash-out confirmation,
then the status becomes Cashed out and the balance increases.

**Search** (`⌘K` / `Ctrl K` / `/`): teams, players, competitions, markets, matches — deterministic, not AI,
with keyboard navigation and grouped results.

**Follow** a team or competition → their fixtures move into the "For you" section and the "Following only" filter works.

**Responsive.** 1440px: top bar + left nav + side panel + right slip drawer.
390px: bottom tab bar, slip bar above it, 90vh slip sheet with a drag handle, and a Slip / My bets segmented control.

---

## "Tidal" design system

- **Surfaces:** marine ink `#050F14` → `#0B222A`, hairlines `rgba(163,214,219,.10)`, 3.5% grain so it never feels flat.
- **Accents:** aqua `#4BE3C8` (actions, selection), coral `#FF7A63` (live), amber `#F2B45C` (suspended), sand `#E8D9C2` (editorial).
- **Type:** Instrument Serif for headlines and scores (an editorial touch, not a generic dashboard),
  Inter Tight for data with tabular figures, wide-tracked uppercase micro labels.
- **Form:** 8–22px radii, two-level fixture rows, one hairline, no stacked card soup.
- **Motion:** 160–380ms with custom easing; everything is removed under `prefers-reduced-motion`.

---

## Structure

```
index.html            shell: top bar, rail, side panel, bottom bar, drawer, palette, icon sprite
assets/app.css        design system + all components + 1320/1120/900/420 breakpoints
assets/data.js        teams, competitions, 26 matches, 6 market groups, players, sample bets
assets/app.js         hash router, localStorage store, odds/clock engine, slip, cash out, search
```

---

## Contest scope

- [x] 5 pages, linked, one shell (top bar, left nav, side panel)
- [x] 390px and 1440px
- [x] Slip on phones: a bar at the bottom
- [x] Front end only, sample data, no login, no real money
- [x] Odds moving, markets suspended, odds changed must be accepted, selection suspended
- [x] Bet placed & bet failed, cash out, open/settled history
- [x] No multis/accumulators, boosts, promos, outrights, stats widgets or AI search
