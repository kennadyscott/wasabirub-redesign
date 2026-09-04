/* WasabiRub first-purchase popup — 10% off (RELIEF10), captures email to Resend.
   Shows once per visitor (localStorage). Add ?popup to any URL to force-show. */
(function () {
  var KEY = "wr_popup_v1";
  var CODE = "RELIEF10";
  var DELAY = 6000; // ms before it appears on a first visit
  var force = /[?&]popup\b/.test(location.search);

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  if (!force && stored()) return;

  var scrim, card, shown = false, timer;

  function build() {
    scrim = document.createElement("div");
    scrim.className = "wrp-scrim";
    scrim.setAttribute("role", "dialog");
    scrim.setAttribute("aria-modal", "true");
    scrim.setAttribute("aria-label", "10% off your first order");
    scrim.innerHTML =
      '<div class="wrp-card">' +
        '<button class="wrp-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="wrp-top"><p class="wrp-eyebrow">New here?</p><h2>Enjoy <em>10% off</em><br>your first order</h2></div>' +
        '<div class="wrp-body">' +
          '<div class="wrp-offer">' +
            '<p class="wrp-sub">Drop your email and we&rsquo;ll set you up with your code &mdash; plus first word on new drops.</p>' +
            '<form class="wrp-form" novalidate>' +
              '<input type="email" name="email" autocomplete="email" placeholder="you@email.com" aria-label="Email address" required>' +
              '<button class="wrp-btn" type="submit">Get my 10% off</button>' +
              '<p class="wrp-err" role="alert"></p>' +
            '</form>' +
            '<p class="wrp-alt">Or just use code <b>' + CODE + '</b> at checkout.</p>' +
            '<p class="wrp-fine">First purchase only. One code per order.</p>' +
          '</div>' +
          '<div class="wrp-done" hidden>' +
            '<div class="wrp-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
            '<p class="wrp-sub" style="margin-bottom:10px">You&rsquo;re in! Here&rsquo;s your code &mdash; 10% off your first order:</p>' +
            '<div class="wrp-code"><b>' + CODE + '</b><button class="wrp-copy" type="button">Copy</button></div>' +
            '<button class="wrp-btn" type="button" data-shop style="margin-top:16px;width:100%">Shop WasabiRub</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(scrim);

    scrim.querySelector(".wrp-close").addEventListener("click", function () { close("dismissed"); });
    scrim.addEventListener("click", function (e) { if (e.target === scrim) close("dismissed"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && scrim.classList.contains("wrp-open")) close("dismissed"); });
    scrim.querySelector(".wrp-form").addEventListener("submit", submit);
    var shopBtn = scrim.querySelector("[data-shop]");
    if (shopBtn) shopBtn.addEventListener("click", function () { location.href = "wasabirub-shop.html"; });
    var copyBtn = scrim.querySelector(".wrp-copy");
    if (copyBtn) copyBtn.addEventListener("click", function () {
      try { navigator.clipboard.writeText(CODE); copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500); } catch (e) {}
    });
  }

  function open() {
    if (shown) return; shown = true;
    if (!scrim) build();
    requestAnimationFrame(function () { scrim.classList.add("wrp-open"); });
    var input = scrim.querySelector("input[type=email]");
    setTimeout(function () { if (input) input.focus(); }, 300);
  }

  function close(reason) {
    if (scrim) scrim.classList.remove("wrp-open");
    remember(reason || "closed");
  }

  function submit(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var input = form.querySelector("input[type=email]");
    var btn = form.querySelector("button[type=submit]");
    var err = form.querySelector(".wrp-err");
    var email = (input.value || "").trim();
    err.textContent = "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "Please enter a valid email."; input.focus(); return; }
    btn.disabled = true; var label = btn.textContent; btn.textContent = "Signing you up…";
    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, source: "popup" })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { err.textContent = (res.d && res.d.error) || "Could not sign you up. Try again."; btn.disabled = false; btn.textContent = label; return; }
        remember("subscribed");
        scrim.querySelector(".wrp-offer").hidden = true;
        scrim.querySelector(".wrp-done").hidden = false;
      })
      .catch(function () { err.textContent = "Could not sign you up. Try again."; btn.disabled = false; btn.textContent = label; });
  }

  function arm() {
    timer = setTimeout(open, DELAY);
    // exit-intent (desktop): mouse leaves toward the top
    document.addEventListener("mouseout", function onOut(e) {
      if (!e.relatedTarget && e.clientY <= 0) { document.removeEventListener("mouseout", onOut); open(); }
    });
  }

  if (force) { if (document.readyState !== "loading") open(); else document.addEventListener("DOMContentLoaded", open); }
  else if (document.readyState !== "loading") arm();
  else document.addEventListener("DOMContentLoaded", arm);
})();
