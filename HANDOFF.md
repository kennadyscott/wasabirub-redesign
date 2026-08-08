# WasabiRub redesign — handoff

Everything needed to pick this up on another account. This file lives in the repo
so it travels with the code and does not depend on any Claude account.

Last updated: 8 August 2026.

---

## 1. Where the work lives

| | |
|---|---|
| Sandbox repo | `github.com/kennadyscott/wasabirub-redesign` |
| Sandbox site | https://kennadyscott.github.io/wasabirub-redesign/wasabirub-home.html |
| Live SportPharm repo | `github.com/kennadyscott/sportpharm-site` — **frozen, do not touch** |
| Second sandbox | `github.com/kennadyscott/sportpharm-redesign` (the 89-page SportPharm site) |
| Local working copy | `/tmp/wasabirub-redesign` (ephemeral — clone from GitHub instead) |

Forked from `sportpharm-site` at `fa9494a` with full history. 43 commits of redesign
work sit on top. Any fix made on the live site can still be cherry-picked across.

**Nothing in this project has been deployed to the live site.** The live site is
untouched. This is a sandbox for review.

### Local preview

```bash
git clone https://github.com/kennadyscott/wasabirub-redesign.git
cd wasabirub-redesign && python3 -m http.server 4207
```

---

## 2. Page inventory — the WasabiRub set

Eight pages. The other 81 files in the repo are the inherited SportPharm site.

| Page | Role |
|---|---|
| `wasabirub-home.html` | Brand homepage. The reference for the design language. |
| `wasabirub.html` | WasabiRub product page. **The template** the other two are built from. |
| `wasabirub-super-hot.html` | Super Hot product page |
| `wasabirub-super-cold.html` | Super Cold product page |
| `wasabirub-shop.html` | Shop-all page (nav "Shop" points here) |
| `how-it-works.html` | Why WasabiRub |
| `superhot.html`, `icetrarub.html` | Canonical redirects to the two variant pages |
| `products.html` | **Not part of this project** — a SportPharm page, correct as-is |

### Homepage section order

`hero → trustband → selector → testimonials → formula → quality → FAQ → featured range → final CTA → partners`

### Product page section order (all three, identical)

`hero → who it's for → benefits → how to use → quality → comparison → FAQ`

This order was specified by the client. `wasabirub.html` is the template — build any
new variant from it rather than from scratch, so nav, footer and CSS match by
construction.

---

## 3. Renames already done

| Was | Now |
|---|---|
| `wasabirub-product.html` | `wasabirub.html` |
| `wasabirub.html` (brand home) | `wasabirub-home.html` |
| `find-your-rub.html` | `wasabirub-shop.html` |
| `superhot-product.html` | `wasabirub-super-hot.html` |
| `icetrarub-product.html` | `wasabirub-super-cold.html` |
| `superhot.html`, `icetrarub.html` | kept as canonical redirects |

"IcetraRub" is retired from all visible copy in favour of "WasabiRub Super Cold".
15 asset *filenames* still read `icetrarub-*` / `superhot-*` — invisible to
visitors, deliberately left alone.

The ~83 site-wide links that pointed at `wasabirub.html` now land on the **product
page**, which was the intent. The nav logo points at `wasabirub-home.html` so the
brand page is not orphaned.

---

## 4. Metadata — one launch task

Every page has a canonical, Open Graph and Twitter card tags, and a built
1200×630 share image (`assets/og-*.jpg`).

**All of these URLs are absolute and point at the sandbox**
(`https://kennadyscott.github.io/wasabirub-redesign/`). Every `canonical`, `og:url`
and `og:image` must be rewritten at launch. It is a single base-URL find-and-replace.

They are absolute rather than relative because `og:image` must be absolute to
resolve, and pointing them at a domain that does not serve these pages yet would be
worse than pointing them here.

### FAQ / structured data status

- The four WasabiRub pages that carry an FAQ (`wasabirub-home`, `wasabirub`,
  `wasabirub-super-hot`, `wasabirub-super-cold`) all have valid `FAQPage` JSON-LD
  matching the visible copy exactly, with no duplicate blocks. Seven inherited
  SportPharm pages also carry `FAQPage` — untouched by this project and unverified.
- Every product page's FAQ is unique — zero shared questions between them.
- **Caveat worth knowing:** Google restricted FAQ rich results to government and
  health sites in 2023, so this markup is unlikely to produce rich results for a
  consumer brand however well it is built. It still earns its place for AI answer
  engines and other search engines. Verify current policy before promising anyone
  rich results.
- **Missing and more valuable:** `Product` / `Offer` schema on the three product
  pages. Blocked on confirmed prices and the store question (see §5).

---

## 5. Open questions — work stops without these

Full detail, with what unblocks each: see the blockers list in §7.

1. **There is no store.** No Shopify/Stripe/Snipcart/WooCommerce — just a counter
   reading `0`. Every Add to Cart goes nowhere.
2. **Separate site, or a section of sportpharm.com?** Sets the header logo, footer,
   persona toggle, and whether Athlete Hub belongs in the nav.
3. **Two prices, both unconfirmed.** WasabiRub $29.95, Super Hot $39.95, Super Cold
   $39.95 — consistent everywhere now, but chosen rather than confirmed. One of them
   was our own bug: the homepage priced Super Cold $10 lower than its product page.
   Also: the duo bundle has nowhere to be sold since the block carrying it was replaced.
4. **`Product` schema** — blocked on 1 and 3 above.

### Assets still missing

- A genuine **Super Hot and Super Cold testimonial**. Every quote in the repo is
  brand-level WasabiRub or about another SportPharm service. The variant pages ship
  without a testimonial section rather than carry an invented or misattributed quote.
- **UFC, USA Handball, Nexus** partner logos — also gated on written permission.
- A real **athlete or practitioner photograph**, not staged stock.
- The **open-jar hero close-up** (§4 of the brief). Parked at the client's call.

### Claims needing sign-off

- Two claims are **baked into images** and cannot be fixed in code:
  `superhot-target-pain.png` ("reduce pain signal transmission … chronic or
  nerve-related pain") and `icetrarub-guidelines.png` ("third-party tested for over
  480 prohibited substances").
- Two drug claims were **removed from Super Hot's copy** during the rebuild —
  "long-lasting nerve desensitizer that reduces pain-signal transmission" and
  "deep-tissue anti-inflammatory action" — replaced with the monograph language
  already approved on the original page.
- "Clean", "independently tested", "banned-substance screened", "Made in USA" are
  all omitted pending substantiation.

---

## 6. The lifestyle-imagery problem

Worth reading before presenting this. Shelving the athlete hub removed the only
place built for lifestyle and human connection, and the product-page cleanup removed
what little was left.

| Page | Photographs | Cutouts / marks |
|---|---|---|
| `wasabirub-home.html` | 7 | 11 |
| every other page in the set | **0** | 8–9 |

Every photograph in the set is on one page — and after the rename, that page is the
hardest to reach (nav logo only), while the ~83 inbound links land on the product
page, which has none. The most-visited page is pure spec; the page carrying the
emotional register is the hardest to get to.

The nav still shows **ATHLETE HUB**, but it points at `index.html?welcome` — the
SportPharm everyday-athlete page. It leaves the WasabiRub brand entirely.

Four ways out: revive the hub, fold lifestyle content into the product pages, give
the brand homepage more entry points, or accept that WasabiRub reads as a clinical
product line. The last is legitimate, but it should be a decision rather than a side
effect.

---

## 7. Tracking documents

Both are Claude artifacts owned by the current account. **They will not transfer.**
Export before you lose access — see §8.

| Document | What it holds |
|---|---|
| Build checklist | 118 items across 18 sections of the client change list, tagged Ready / Asset / Approval / Decision |
| Blockers & open questions | 4 blocking · 3 missing assets · 6 needing sign-off · 4 resolved |

The source HTML for both is in this repo as `docs/build-checklist.html` and
`docs/open-questions.html`, so they survive the move even if the artifacts do not.
Open them straight from a local clone — they are self-contained.

`docs/` also holds inherited SportPharm material predating this project
(athlete-hub pitch, site map, UX audit, Supabase notes). Not part of the WasabiRub
redesign; left in place.

---

## 8. Moving the checklist to the new account

The checklist's ticks are stored in `localStorage` under `wasabirub-checklist-v1`,
scoped to claude.ai **in one browser**. They are not in the file and not in the
artifact. A new account sees an empty checklist.

**Do this before losing access to the old account:**

1. Open the checklist and press **Copy handoff link**.
2. Paste that link somewhere safe — it encodes every ticked item in the URL.
3. On the new account, open the checklist and either open that link directly, or
   press **Paste progress** and paste it in.

The same trick moves progress between browsers or machines.

---

## 9. Standing constraints — carry these forward

- **Never use "service inquiry"** as a CTA. Use CTAs that reflect the goal.
- **American spellings only** (no enquiry / centre / catalogue).
- **No criticism of the current live site** in client-facing material — its builder
  is a friend of the company president.
- **FAQ answers must be verbatim** from source where a source exists.
- The live `sportpharm-site` repo is **frozen**. Nothing goes near it without an
  explicit request.
- Do not invent testimonials, claims, prices, or partner relationships.

---

## 10. How this work was verified

Every change ran through the same pass. Worth keeping — it caught real bugs that
looked fine on screen:

- Tag balance via a real HTML parser (regex miscounts `<a` inside `href` strings).
- CSS brace balance by counting, since regex fails on nested media queries.
- `node --check` on every inline `<script>`.
- Missing-asset and dead-link checks across the repo.
- **Contrast measured in-browser against composited pixels**, walking the ancestor
  chain and compositing translucent layers — not assumed from the CSS.
- Overflow and layout checked at 1280 and 390, headings checked for wraps beyond
  their explicit `<br>` count and for single-word orphans.
- **Every inline script must appear after the element it resolves by id.** Added
  after a section reorder silently killed the testimonial carousel with no console
  error.

### Two environment quirks that cause false diagnoses

- **The preview pane has a frozen transition clock.** CSS transitions never
  complete, screenshots can come back blank, and the screenshot compositor ignores
  `opacity`, so cross-fading elements appear stacked on top of each other. Verify by
  reading computed styles, not by looking.
- **`loading="lazy"` images that start hidden or far below the fold may never
  decode** even when scrolled into view, while fetching fine over the network. This
  bit twice — dropdown thumbnails and the range-section cutouts.
