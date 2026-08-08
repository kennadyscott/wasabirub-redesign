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
3. ~~**Rename scope.**~~ **Decided (8 Aug):** product pages are renamed to
   match the product names and the old URLs redirect.

   | Was | Now |
   |---|---|
   | `superhot-product.html` | `wasabirub-super-hot.html` |
   | `icetrarub-product.html` | `wasabirub-super-cold.html` |
   | `superhot.html` | canonical redirect to Super Hot |
   | `icetrarub.html` | canonical redirect to Super Cold |

   Settled fully (8 Aug): the product page took `wasabirub.html` and the
   brand homepage moved to `wasabirub-home.html`. The ~83 links that already
   pointed at `wasabirub.html` now land on the product page, which is the
   intent. The nav logo points at the brand home so it is not orphaned.

   ~12 assets still carry `icetrarub-*` / `superhot-*` filenames; those are
   invisible to visitors, so they were left alone.
4. **Which prices are real?** Five different figures currently appear across
   the two pages: $10, $29.95, $39.95, $59.99, $69.90.
5. **Which file is the hero image?** §4 calls for a real open-jar close-up.

## Assets

**On hold — the client does not have it (7 Aug):**
- **The open-jar hero close-up (§4).** A screenshot exists; the file does not. It was not among
  the eight images embedded in the mockup and is not on disk. The hero keeps using the transparent
  cutout `wr-wasabirub-hero.png` until a file arrives. Nothing else is blocked by this.

**Still missing:**
- UFC, USA Handball and Nexus Sports Medicine logos (§12) — also gated on written permission
- A real athlete or practitioner photograph, not staged stock (§9)
- **A genuine Super Hot and Super Cold testimonial.** Every quote in the repo is
  either brand-level WasabiRub or about another SportPharm service. The variant
  pages ship without a testimonial section rather than carry an invented or
  misattributed quote.

## Page status

| Page | State |
|---|---|
| `wasabirub-home.html` | Brand homepage — the reference |
| `wasabirub.html` | WasabiRub product page — the template |
| `wasabirub-super-hot.html` | Rebuilt on the template |
| `wasabirub-super-cold.html` | Rebuilt on the template |
| `how-it-works.html` | Redesigned |
| `wasabirub-shop.html` | Redesigned (Shop) |
| `superhot.html`, `icetrarub.html` | Redirects |
| `products.html` | **Not ours** — a SportPharm page, correct as-is |

**Resolved:**
- Ingredient photography (§7) — chili, mint and wintergreen were embedded in the client's mockup;
  saved as `ing-capsaicin`, `ing-menthol`, `ing-wintergreen`, plus a better `trushield-logo`
- A WasabiRub wordmark — moot for now; the nav follows the mockup and carries no logo at all

## Ground rules

- The live repo is the source of truth for anything already shipped.
- Nothing here goes near `sportpharm-site` until it is reviewed and approved.
- Claims, prices, percentages and partner references stay unverified until
  someone signs off. See §17 of the change list.
