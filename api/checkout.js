const Stripe = require("stripe");

const CATALOG = {
  original: {
    name: "WasabiRub™",
    description: "4 oz OTC topical gel",
    cents: 2995,
    env: "STRIPE_PRICE_ORIGINAL",
  },
  "super-hot": {
    name: "WasabiRub™ Super Hot",
    description: "4 oz OTC topical gel",
    cents: 3995,
    env: "STRIPE_PRICE_SUPER_HOT",
  },
  "super-cold": {
    name: "WasabiRub™ Super Cold",
    description: "4 oz OTC topical cream",
    cents: 3995,
    env: "STRIPE_PRICE_SUPER_COLD",
  },
};

const MAX_QTY = 20;

function siteOrigin(req) {
  const fromEnv = process.env.SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return proto + "://" + host;
  return "https://wasabirub.com";
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

/* Human-friendly order reference: WR-YYMMDD-XXXX (date + 4 chars, no 0/O/1/I).
   Stored in the session + payment metadata so it shows in Stripe, both emails,
   and can carry into HQ fulfillment. */
function makeOrderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return "WR-" + ymd + "-" + s;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: "Checkout is not configured yet." });
    return;
  }

  const body = parseBody(req);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) {
    res.status(400).json({ error: "Your cart is empty." });
    return;
  }

  const merged = {};
  for (const row of rawItems) {
    const id = row && typeof row.id === "string" ? row.id : "";
    const qty = Math.floor(Number(row && row.qty));
    if (!CATALOG[id]) {
      res.status(400).json({ error: "Unknown product." });
      return;
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY) {
      res.status(400).json({ error: "Invalid quantity." });
      return;
    }
    merged[id] = (merged[id] || 0) + qty;
    if (merged[id] > MAX_QTY) {
      res.status(400).json({ error: "Quantity is too high." });
      return;
    }
  }

  const line_items = Object.keys(merged).map(function (id) {
    const product = CATALOG[id];
    const priceId = process.env[product.env];
    const quantity = merged[id];
    if (priceId) {
      return { price: priceId, quantity: quantity };
    }
    return {
      quantity: quantity,
      price_data: {
        currency: "usd",
        unit_amount: product.cents,
        product_data: {
          name: product.name,
          description: product.description,
        },
      },
    };
  });

  const origin = siteOrigin(req);
  const orderNo = makeOrderNumber();
  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      line_items: line_items,
      success_url: origin + "/order-confirmation.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/cart.html",
      client_reference_id: "wasabirub",
      metadata: { source: "wasabirub.com", order_number: orderNo },
      payment_intent_data: {
        description: `WasabiRub order ${orderNo}`,
        metadata: { source: "wasabirub.com", order_number: orderNo },
      },
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: "Free shipping",
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
          },
        },
      ],
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start checkout. Try again." });
  }
};
