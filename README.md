# WasabiRub Redesign — working copy

This repo is a **sandbox**. Nothing here affects the live SportPharm site.

| | Live site | This repo |
|---|---|---|
| Repo | `kennadyscott/sportpharm-site` | `kennadyscott/wasabirub-redesign` |
| URL | https://kennadyscott.github.io/sportpharm-site/ | https://kennadyscott.github.io/wasabirub-redesign/ |
| Local preview | port 4188 | port 4207 (`wasabirub-redesign` in launch.json) |
| Status | **Do not break.** Client-facing. | Free to experiment. |

## What this is for

Implementing `WasabiRub_Developer_Change_List.md` — the masterbrand redesign of
`wasabirub.html` and `wasabirub-product.html`, with AG1 as the visual reference.

Progress is tracked on the build checklist: 118 items across 18 sections,
tagged by what blocks each one.

## Where it came from

Forked from `sportpharm-site` at commit `fa9494a`, with full history intact —
`git log` here goes all the way back through the original build. That means any
fix made on the live site can be cherry-picked across, and vice versa.

## Five open questions

The redesign cannot be finished until these are answered. They are listed at
the top of the checklist and repeated here because they gate real work:

1. **There is no store.** The brief assumes Cart / Shop Now / Add to Cart. No
   Shopify, Stripe, Snipcart or WooCommerce exists — only a counter reading 0.
2. **Separate site, or a section of sportpharm.com?** This sets the nav, the
   footer, the persona toggle, and whether the SportPharm logo goes.
3. **Rename scope.** "IcetraRub" appears in 53 files with its own pages and
   ~12 assets. Do URLs change? Do old ones redirect?
4. **Which prices are real?** Five different figures currently appear across
   the two pages: $10, $29.95, $39.95, $59.99, $69.90.
5. **Which file is the hero image?** §4 calls for a real open-jar close-up.

## Assets the brief needs that do not exist yet

- Chili pepper, mint sprig and wintergreen photography (§7)
- UFC, USA Handball and Nexus Sports Medicine logos (§12)
- A real athlete or practitioner photograph, not staged stock (§9)
- A WasabiRub wordmark — the brand is currently set as type, not artwork

## Ground rules

- The live repo is the source of truth for anything already shipped.
- Nothing here goes near `sportpharm-site` until it is reviewed and approved.
- Claims, prices, percentages and partner references stay unverified until
  someone signs off. See §17 of the change list.
