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
          '<p class="wr-drawer-note">Free shipping in the US. Taxes calculated at checkout if applicable.</p>' +
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
          '<p class="wr-drawer-note">Free shipping in the US.</p>' +
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
    var err =
      document.getElementById("wr-cart-err") ||
      document.getElementById("wr-cart-page-err");
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    if (btn) btn.disabled = true;
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items }),
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
