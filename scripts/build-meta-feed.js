#!/usr/bin/env node
/*
 * Builds meta-feed.csv (Meta / Facebook & Instagram commerce catalog feed)
 * from the product list below, and writes it to the site root so it is served
 * at https://wasabirub.com/meta-feed.csv for a scheduled Data Feed pull in
 * Meta Commerce Manager.
 *
 * When products change, edit PRODUCTS and run:  node scripts/build-meta-feed.js
 * Keep prices in sync with assets/js/cart.js and api/checkout.js.
 */
const fs = require("fs");
const path = require("path");

const SITE = "https://wasabirub.com";
const BRAND = "WasabiRub";
const CATEGORY = "Health & Beauty > Health Care"; // Google product taxonomy

const PRODUCTS = [
  {
    id: "original",
    title: "WasabiRub Original — 4 oz OTC Topical Pain-Relief Gel",
    description:
      "WasabiRub Original is a 4 oz over-the-counter topical gel that delivers balanced cooling and warming relief for minor muscle and joint aches. Formulated by sports pharmacists.",
    price: 29.95,
    link: "wasabirub.html",
    image: "assets/wr-wasabirub.png",
  },
  {
    id: "super-hot",
    title: "WasabiRub Super Hot — 4 oz OTC Warming Pain-Relief Gel",
    description:
      "WasabiRub Super Hot is a 4 oz over-the-counter topical gel with extra warming intensity for deep muscle and joint relief. For external use only; use as directed.",
    price: 39.95,
    link: "wasabirub-super-hot.html",
    image: "assets/wr-superhot.png",
  },
  {
    id: "super-cold",
    title: "WasabiRub Super Cold — 4 oz OTC Cooling Pain-Relief Cream",
    description:
      "WasabiRub Super Cold is a 4 oz over-the-counter topical cream that delivers pure cooling relief for minor muscle and joint pain. For external use only; use as directed.",
    price: 39.95,
    link: "wasabirub-super-cold.html",
    image: "assets/wr-icetrarub.png",
  },
  {
    id: "fire-ice-duo",
    title: "Fire & Ice Duo — WasabiRub Super Hot + Super Cold (4 oz each)",
    description:
      "The Fire & Ice Duo pairs WasabiRub Super Hot and Super Cold (4 oz each) — warming relief for tight muscles and cooling relief for fresh aches, in one bundle. Ships free.",
    price: 64.99,
    link: "wasabirub-shop.html#bundles",
    image: "assets/bundle-fire-ice.png",
  },
  {
    id: "og-heat-duo",
    title: "OG Heat Duo — WasabiRub Original + Super Hot (4 oz each)",
    description:
      "The OG Heat Duo pairs WasabiRub Original and Super Hot (4 oz each) — everyday balanced relief plus extra warming intensity. Ships free.",
    price: 59.99,
    link: "wasabirub-shop.html#bundles",
    image: "assets/bundle-og-heat.png",
  },
  {
    id: "recovery-duo",
    title: "Recovery Duo — WasabiRub Original + Super Cold (4 oz each)",
    description:
      "The Recovery Duo pairs WasabiRub Original and Super Cold (4 oz each) — balanced everyday relief plus pure cooling for post-activity recovery. Ships free.",
    price: 64.99,
    link: "wasabirub-shop.html#bundles",
    image: "assets/bundle-recovery.png",
  },
  {
    id: "team-trifecta",
    title: "Team Trifecta Bundle — 3 Original + 3 Super Hot + 3 Super Cold",
    description:
      "The Team Trifecta Bundle stocks the training room with three each of WasabiRub Original, Super Hot, and Super Cold (4 oz each, nine jars total). Ships free.",
    price: 269.95,
    link: "wasabirub-shop.html#bundles",
    image: "assets/bundle-trifecta.png",
  },
];

// Meta commerce feed columns.
const COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "google_product_category",
  "quantity_to_sell_on_facebook",
  "mpn",
];

function csvCell(value) {
  const s = String(value == null ? "" : value);
  // Always quote; escape embedded quotes by doubling them.
  return '"' + s.replace(/"/g, '""') + '"';
}

function row(p) {
  const abs = (rel) => `${SITE}/${rel.replace(/^\//, "")}`;
  const cells = {
    id: p.id,
    title: p.title,
    description: p.description,
    availability: "in stock",
    condition: "new",
    price: `${p.price.toFixed(2)} USD`,
    link: abs(p.link),
    image_link: abs(p.image),
    brand: BRAND,
    google_product_category: CATEGORY,
    quantity_to_sell_on_facebook: 100,
    mpn: p.id,
  };
  return COLUMNS.map((c) => csvCell(cells[c])).join(",");
}

const lines = [COLUMNS.join(","), ...PRODUCTS.map(row)];
const out = lines.join("\n") + "\n";
const dest = path.join(__dirname, "..", "meta-feed.csv");
fs.writeFileSync(dest, out, "utf8");
console.log(`Wrote ${PRODUCTS.length} products to ${dest}`);
