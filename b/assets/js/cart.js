/* A/B test: report this session's variant to GA4 (reads the wr_ab cookie the
   Edge middleware sets). Harmless no-op when the test isn't running / no gtag. */
(function () {
  try {
    var m = (document.cookie.match(/(?:^|;\s*)wr_ab=(a|b)/) || [])[1];
    var v = m === "b" ? "b_2027" : "a_control";
    function tag() {
      try { if (window.gtag) { window.gtag("set", "user_properties", { ab_variant: v }); window.gtag("event", "ab_variant", { ab_variant: v }); } } catch (e) {}
      try { (window.dataLayer = window.dataLayer || []).push({ event: "ab_variant", ab_variant: v }); } catch (e) {}
    }
    tag(); setTimeout(tag, 1500);
    /* Count one exposure per session per variant so HQ can show conversion rate. */
    try {
      if (m && !sessionStorage.getItem("wr_ab_beacon")) {
        sessionStorage.setItem("wr_ab_beacon", "1");
        var url = "https://hq.sportpharm.com/api/ab", payload = JSON.stringify({ variant: v });
        if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([payload], { type: "text/plain" }));
        else fetch(url, { method: "POST", body: payload, keepalive: true, mode: "no-cors" });
      }
    } catch (e) {}
  } catch (e) {}
})();

(function () {
  var KEY = "wr_cart";
  var MAX = 20;
  var CATALOG = {
    original: {
      name: "WasabiRub™",
      price: 29.95,
      thumb: "assets/wr-wasabirub-thumb.png",
      href: "wasabirub.html",
    },
    "super-hot": {
      name: "WasabiRub™ Super Hot",
      price: 39.95,
      thumb: "assets/wr-superhot-thumb.png?v=4",
      href: "wasabirub-super-hot.html",
    },
    "super-cold": {
      name: "WasabiRub™ Super Cold",
      price: 39.95,
      thumb: "assets/wr-supercold-thumb.png",
      href: "wasabirub-super-cold.html",
    },
    "fire-ice-duo": {
      name: "Fire & Ice Duo",
      price: 64.99,
      thumb: "assets/bundle-fire-ice-thumb.webp",
      href: "wasabirub-shop.html#bundles",
    },
    "og-heat-duo": {
      name: "OG Heat Duo",
      price: 59.99,
      thumb: "assets/bundle-og-heat-thumb.webp",
      href: "wasabirub-shop.html#bundles",
    },
    "recovery-duo": {
      name: "Recovery Duo",
      price: 64.99,
      thumb: "assets/bundle-recovery-thumb.webp",
      href: "wasabirub-shop.html#bundles",
    },
    "team-trifecta": {
      name: "Team Trifecta Bundle",
      price: 269.95,
      thumb: "assets/bundle-trifecta-thumb.webp",
      href: "wasabirub-shop.html#bundles",
    },
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function save(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    render();
  }

  function count(cart) {
    cart = cart || load();
    var n = 0;
    Object.keys(cart).forEach(function (id) {
      n += cart[id] || 0;
    });
    return n;
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  function add(id, qty) {
    if (!CATALOG[id]) return;
    qty = Math.floor(Number(qty) || 1);
    if (qty < 1) qty = 1;
    var cart = load();
    cart[id] = Math.min(MAX, (cart[id] || 0) + qty);
    save(cart);
    openDrawer();
    /* Meta Pixel: the add, valued at what was added. Pixel not loaded = no-op. */
    if (window.fbq) {
      try { fbq("track", "AddToCart", { content_ids: [id], content_name: String(CATALOG[id].name).replace(/\u2122/g, ""), content_type: "product", value: Math.round(CATALOG[id].price * qty * 100) / 100, currency: "USD" }); } catch (e) {}
    }
  }

  function setQty(id, qty) {
    var cart = load();
    qty = Math.floor(Number(qty) || 0);
    if (qty < 1) delete cart[id];
    else cart[id] = Math.min(MAX, qty);
    save(cart);
  }

  function linesHtml(cart) {
    var ids = Object.keys(cart).filter(function (id) {
      return cart[id] > 0 && CATALOG[id];
    });
    if (!ids.length) {
      return (
        '<div class="wr-drawer-empty">Your cart is empty.<br><a href="wasabirub-shop.html">Shop the three rubs</a></div>'
      );
    }
    return ids
      .map(function (id) {
        var p = CATALOG[id];
        var qty = cart[id];
        return (
          '<div class="wr-line" data-id="' +
          id +
          '">' +
          '<a href="' +
          p.href +
          '"><img src="' +
          p.thumb +
          '" alt=""></a>' +
          "<div>" +
          "<b>" +
          p.name +
          "</b>" +
          "<small>" +
          money(p.price) +
          " · 4 oz</small>" +
          '<div class="wr-line-qty">' +
          '<button type="button" data-cart-minus="' +
          id +
          '" aria-label="Decrease">−</button>' +
          "<span>" +
          qty +
          "</span>" +
          '<button type="button" data-cart-plus="' +
          id +
          '" aria-label="Increase">+</button>' +
          "</div></div>" +
          '<div class="wr-line-side"><div class="wr-line-price">' +
          money(p.price * qty) +
          "</div>" +
          '<button class="wr-line-remove" type="button" data-cart-remove="' +
          id +
          '">Remove</button></div></div>'
        );
      })
      .join("");
  }

  function subtotal(cart) {
    var n = 0;
    Object.keys(cart).forEach(function (id) {
      if (CATALOG[id]) n += CATALOG[id].price * cart[id];
    });
    return n;
  }

  /* Shipping: $7.99 flat, free on orders over $75 -- but never on bundles. */
  var BUNDLE_IDS = { "fire-ice-duo": 1, "og-heat-duo": 1, "recovery-duo": 1, "team-trifecta": 1 };
  var FREE_SHIP_OVER = 75;

  function hasBundle(cart) {
    return Object.keys(cart).some(function (id) { return cart[id] > 0 && BUNDLE_IDS[id]; });
  }

  function shipNote(cart) {
    if (hasBundle(cart)) return "$7.99 flat-rate shipping, added at checkout.";
    var sub = subtotal(cart);
    if (sub > FREE_SHIP_OVER) return "Free shipping unlocked — your order is over $75.";
    return "$7.99 shipping — you’re " + money(FREE_SHIP_OVER - sub) + " from free shipping.";
  }

  function ensureUi() {
    if (!document.querySelector(".wr-cart-btn")) {
      var host = document.querySelector(".nav-right") || document.querySelector("header.nav");
      if (host) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wr-cart-btn";
        btn.setAttribute("aria-label", "Open cart");
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M6 6L5 3H3"/></svg><span class="wr-cart-count">0</span>';
        var mnav = host.querySelector(".mnav-btn");
        if (mnav) host.insertBefore(btn, mnav);
        else host.appendChild(btn);
      }
    }
    if (!document.getElementById("wr-drawer")) {
      var wrap = document.createElement("div");
      wrap.id = "wr-drawer";
      wrap.className = "wr-drawer";
      wrap.innerHTML =
        '<div class="wr-drawer-scrim" data-cart-close></div>' +
        '<aside class="wr-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="wr-cart-title">' +
        '<div class="wr-drawer-head"><h2 id="wr-cart-title">Your cart</h2>' +
        '<button class="wr-drawer-x" type="button" aria-label="Close cart" data-cart-close>&times;</button></div>' +
        '<div class="wr-drawer-body" id="wr-drawer-body"></div>' +
        '<div class="wr-drawer-foot" id="wr-drawer-foot"></div></aside>';
      document.body.appendChild(wrap);
    }
  }

  /* Email before Stripe (26 Oct 2026). Every shopper who left a checkout so far
     did it on Stripe's page before typing an email, so no reminder could ever
     reach them. Asking here first means a shopper who leaves Stripe's page can
     still get the cart reminders -- only if the box stays ticked -- and Stripe
     opens with the email already filled in. Prefilled from the 10% signup or
     the last checkout on this browser. */
  function savedEmail() {
    try { return localStorage.getItem("wr_co_email") || localStorage.getItem("wr_email") || ""; } catch (e) { return ""; }
  }
  function optedOut() {
    try { return localStorage.getItem("wr_co_optout") === "1"; } catch (e) { return false; }
  }
  /* The cart redraws on every quantity change; keep what was typed and ticked. */
  document.addEventListener("input", function (e) {
    if (e.target && e.target.matches && e.target.matches("[data-co-email]")) {
      try { localStorage.setItem("wr_co_email", String(e.target.value || "").trim().toLowerCase()); } catch (x) {}
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target && e.target.matches && e.target.matches("[data-co-optin]")) {
      try { localStorage.setItem("wr_co_optout", e.target.checked ? "0" : "1"); } catch (x) {}
    }
  });
  function emailHtml(where) {
    var v = savedEmail().replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return '<div class="wr-co-email">' +
      '<label class="wr-co-label" for="wr-co-email-' + where + '">Email for your order</label>' +
      '<input class="wr-co-input" id="wr-co-email-' + where + '" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" value="' + v + '" data-co-email>' +
      '<label class="wr-co-optin"><input type="checkbox"' + (optedOut() ? "" : " checked") + ' data-co-optin> Email me about my order and occasional offers. Unsubscribe anytime.</label>' +
      "</div>";
  }

  function render() {
    ensureUi();
    var cart = load();
    var n = count(cart);
    document.querySelectorAll(".wr-cart-count").forEach(function (el) {
      el.textContent = String(n);
      el.classList.toggle("is-on", n > 0);
    });
    var body = document.getElementById("wr-drawer-body");
    var foot = document.getElementById("wr-drawer-foot");
    if (body) body.innerHTML = linesHtml(cart);
    if (foot) {
      if (n) {
        foot.hidden = false;
        foot.innerHTML =
          '<p class="wr-drawer-err" id="wr-cart-err" hidden></p>' +
          '<div class="wr-drawer-sub"><span>Subtotal</span><span>' +
          money(subtotal(cart)) +
          "</span></div>" +
          '<p class="wr-drawer-note">' + shipNote(load()) + ' Taxes calculated if applicable.</p>' +
          emailHtml("drawer") +
          '<button class="wr-drawer-checkout" type="button" data-cart-checkout>Checkout</button>' +
          '<a class="wr-drawer-shop" href="wasabirub-shop.html">Continue shopping</a>';
      } else {
        foot.hidden = true;
        foot.innerHTML = "";
      }
    }
    var page = document.getElementById("wr-cart-page");
    if (page) {
      page.innerHTML = n
        ? linesHtml(cart) +
          '<div class="cart-page-foot">' +
          '<p class="wr-drawer-err" id="wr-cart-page-err" hidden></p>' +
          '<div class="wr-drawer-sub"><span>Subtotal</span><span>' +
          money(subtotal(cart)) +
          "</span></div>" +
          '<p class="wr-drawer-note">' + shipNote(load()) + '</p>' +
          emailHtml("page") +
          '<button class="wr-drawer-checkout" type="button" data-cart-checkout>Checkout</button></div>'
        : '<div class="cart-page-empty">Your cart is empty. <a href="wasabirub-shop.html">Shop WasabiRub</a></div>';
    }
  }

  function openDrawer() {
    var d = document.getElementById("wr-drawer");
    if (!d) return;
    d.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    var d = document.getElementById("wr-drawer");
    if (!d) return;
    d.classList.remove("open");
    document.body.style.overflow = "";
  }

  function payload() {
    var cart = load();
    return {
      items: Object.keys(cart)
        .filter(function (id) {
          return cart[id] > 0 && CATALOG[id];
        })
        .map(function (id) {
          return { id: id, qty: cart[id] };
        }),
    };
  }

  function checkout(btn) {
    var items = payload().items;
    if (!items.length) return;
    /* Meta Pixel: checkout started, valued at the cart. */
    if (window.fbq) {
      try {
        var cartNow = load(), ids = Object.keys(cartNow), sum = 0, count = 0;
        ids.forEach(function (k) { if (CATALOG[k]) { sum += CATALOG[k].price * cartNow[k]; count += cartNow[k]; } });
        fbq("track", "InitiateCheckout", { content_ids: ids, content_type: "product", num_items: count, value: Math.round(sum * 100) / 100, currency: "USD" });
      } catch (e) {}
    }
    var err =
      document.getElementById("wr-cart-err") ||
      document.getElementById("wr-cart-page-err");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    /* The email field and box beside the button that was clicked. */
    var box = btn && btn.parentElement ? btn.parentElement.querySelector(".wr-co-email") : null;
    var input = box && box.querySelector("[data-co-email]");
    var optin = box && box.querySelector("[data-co-optin]");
    var email = input ? String(input.value || "").trim().toLowerCase() : "";
    if (input && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      if (err) { err.hidden = false; err.textContent = "Enter your email to continue to checkout."; }
      input.focus();
      return;
    }
    try { if (email) localStorage.setItem("wr_co_email", email); } catch (e) {}
    var signedUp = (function () { try { return !!email && localStorage.getItem("wr_email") === email; } catch (e) { return false; } })();
    if (btn) btn.disabled = true;
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      /* The email from the field above (prefilled from the 10% signup); opted in
         if the box stayed ticked, or if this is the email they signed up with. */
      body: JSON.stringify({ items: items, email: email, marketing_opt_in: optin && optin.checked ? "cart" : "", signed_up: signedUp, ab_variant: (function () { try { var m = (document.cookie.match(/(?:^|;\s*)wr_ab=(a|b)/) || [])[1]; return m === "b" ? "b_2027" : "a_control"; } catch (e) { return "a_control"; } })() }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (out) {
        if (out.ok && out.data && out.data.url) {
          window.location.href = out.data.url;
          return;
        }
        var msg = (out.data && out.data.error) || "Could not start checkout.";
        if (err) {
          err.hidden = false;
          err.textContent = msg;
        } else {
          window.alert(msg);
        }
        if (btn) btn.disabled = false;
      })
      .catch(function () {
        if (err) {
          err.hidden = false;
          err.textContent = "Could not reach checkout. Try again.";
        }
        if (btn) btn.disabled = false;
      });
  }

  function qtyFrom(el) {
    var wrap = el.closest("[data-qty]") || el.parentElement;
    var span = wrap && wrap.querySelector("[data-qty-value]");
    var n = span ? parseInt(span.textContent, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-add-to-cart]");
    if (t) {
      e.preventDefault();
      add(t.getAttribute("data-add-to-cart"), qtyFrom(t));
      return;
    }
    if (e.target.closest(".wr-cart-btn")) {
      e.preventDefault();
      openDrawer();
      return;
    }
    if (e.target.closest("[data-cart-close]")) {
      closeDrawer();
      return;
    }
    var minus = e.target.closest("[data-cart-minus]");
    if (minus) {
      var id = minus.getAttribute("data-cart-minus");
      setQty(id, (load()[id] || 1) - 1);
      return;
    }
    var plus = e.target.closest("[data-cart-plus]");
    if (plus) {
      var pid = plus.getAttribute("data-cart-plus");
      setQty(pid, (load()[pid] || 0) + 1);
      return;
    }
    var rm = e.target.closest("[data-cart-remove]");
    if (rm) {
      setQty(rm.getAttribute("data-cart-remove"), 0);
      return;
    }
    if (e.target.closest("[data-qty-minus]")) {
      var box = e.target.closest("[data-qty]");
      var val = box && box.querySelector("[data-qty-value]");
      if (val) val.textContent = String(Math.max(1, parseInt(val.textContent, 10) - 1 || 1));
      return;
    }
    if (e.target.closest("[data-qty-plus]")) {
      var box2 = e.target.closest("[data-qty]");
      var val2 = box2 && box2.querySelector("[data-qty-value]");
      if (val2)
        val2.textContent = String(Math.min(MAX, (parseInt(val2.textContent, 10) || 1) + 1));
      return;
    }
    var co = e.target.closest("[data-cart-checkout]");
    if (co) {
      e.preventDefault();
      checkout(co);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  window.WasabiCart = { add: add, open: openDrawer, count: count };
})();

/* Mobile buy bar: slide it up only once the main "Add to cart" button has
   scrolled off the TOP of the screen -- i.e. the shopper has passed it and can
   no longer reach it. It stays tucked away at the very top (before you have
   reached the button) and while the button itself is on screen. Guarded, so
   pages without the bar do nothing. */
(function () {
  function init() {
    var bar = document.querySelector(".mobile-buy");
    if (!bar || !("IntersectionObserver" in window)) return;
    var btn = Array.prototype.slice
      .call(document.querySelectorAll("[data-add-to-cart]"))
      .filter(function (el) { return !el.closest(".mobile-buy"); })[0];
    if (!btn) return;

    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      var rootTop = e.rootBounds ? e.rootBounds.top : 0;
      // scrolled past = not visible AND sitting above the viewport's top edge
      var scrolledPast = !e.isIntersecting && e.boundingClientRect.bottom <= rootTop;
      bar.classList.toggle("show", scrolledPast);
    }, { threshold: 0 });
    io.observe(btn);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
