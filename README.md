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

## Six open questions

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
4. **Which prices are real?** Narrowed (8 Aug): replacing the OG Heat Duo block
   removed the only occurrence of $59.99 and $69.90, and the $10 "SAVE" badge
   went with it. The set now shows WasabiRub $29.95, Super Hot $39.95, Super
   Cold $39.95, consistently across the homepage selector, the range tabs and
   all three product pages.

   Found and fixed along the way: the homepage selector card priced Super Cold
   at $29.95 while its own product page said $39.95. Aligned to the product
   page, but **which of the two is correct is still unconfirmed** — this was a
   contradiction inside our own work, not a client decision.

   The duo bundle also needs a decision: it currently has nowhere to be sold.
5. **Which file is the hero image?** §4 calls for a real open-jar close-up.
6. **Where does lifestyle imagery and human connection now live?** Shelving the
   athlete hub removed the only place built for it, and the product-page cleanup
   removed what little remained. The set is now almost entirely product cutouts
   and specification:

   | Page | Photographs | Cutouts / marks |
   |---|---|---|
   | `wasabirub-home.html` | 7 | 11 |
   | `wasabirub.html` | **0** | 8 |
   | `wasabirub-super-hot.html` | **0** | 8 |
   | `wasabirub-super-cold.html` | **0** | 8 |
   | `wasabirub-shop.html` | **0** | 9 |
   | `how-it-works.html` | **0** | 8 |

   Two things make this worse than the table suggests. The brand homepage holds
   every photograph in the set, and it is also the page the rename left with the
   fewest ways in — the nav logo only. The ~83 inbound links now land on
   `wasabirub.html`, which has no photography at all. So the most-visited page is
   pure spec, and the page carrying the emotional register is the hardest to reach.

   The nav still shows **ATHLETE HUB**, but it points at `index.html?welcome` —
   the SportPharm everyday-athlete page. It leaves the WasabiRub brand entirely.

   Needs a decision: revive the athlete hub, fold lifestyle content into the
   product pages, give the brand homepage more entry points, or accept that
   WasabiRub reads as a clinical product line rather than a consumer brand.
   That last one is a legitimate choice, but it should be a choice.

## Assets

**On hold — the client does not have it (7 Aug):**
- **The open-jar hero close-up (§4).** A screenshot exists; the file does not. It was not among
  the eight images embedded in the mockup and is not on disk. The hero keeps using the transparent
  cutout `wr-wasabirub-hero.png` until a file arrives. Nothing else is blocked by this.

**Still missing:**
- UFC, USA Handball and Nexus Sports Medicine logos (§12) — also gated on written permission
- A real athlete or practitioner photograph, not staged stock (§9). This is now
  the binding constraint on open question 6, not a nice-to-have — five of the six
  pages carry no photography at all.
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

## Metadata and social cards

Every page carries a canonical, Open Graph and Twitter card tags, and a
purpose-built 1200x630 share image (`assets/og-*.jpg`, ~50KB each). The
product cutouts were not usable directly: they are square 1300x630 PNGs with
transparency, which social platforms composite unpredictably.

**These URLs are absolute and point at the sandbox:**
`https://kennadyscott.github.io/wasabirub-redesign/`. Every `canonical`,
`og:url` and `og:image` has to be rewritten at launch. They are absolute
rather than relative because Open Graph images must be absolute to resolve,
and pointing them at a domain that does not serve these pages yet would be
worse than pointing them here.

Still missing, and worth more than the FAQ markup for a shop:
- **`Product` / `Offer` schema** on the three product pages. This still
  produces rich results where FAQPage no longer does for consumer brands.
  Blocked on open question 4 (which prices are real) and question 1
  (`availability` is meaningless with no store behind the cart).
- Note on FAQ: the markup is valid and matches visible copy on all four
  pages, but Google restricted FAQ rich results to government and health
  sites in 2023, so rich results are unlikely here regardless. It still
  earns its place for AI answer engines and other search engines.

## Ground rules

- The live repo is the source of truth for anything already shipped.
- Nothing here goes near `sportpharm-site` until it is reviewed and approved.
- Claims, prices, percentages and partner references stay unverified until
  someone signs off. See §17 of the change list.
