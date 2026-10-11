/* Product reviews widget for wasabirub.com.
 * Reads/writes the shared HQ reviews API (same reviews as sportpharm.com).
 * The section carries data-reviews + data-sku; the rating-row under the
 * product title carries data-review-summary. No framework, no build step. */
(function () {
  "use strict";

  var API = "https://hq.sportpharm.com";
  var sec = document.querySelector("[data-reviews]");
  if (!sec) return;
  var SKU = sec.getAttribute("data-sku") || "";
  var summaryRow = document.querySelector("[data-review-summary]"); // rating-row under the title
  var openedAt = Date.now();
  var offset = 0, loading = false, selectedRating = 0;
  var listEl, moreBtn, errEl, formEl, starBtns = [];

  function starStr(n) {
    n = Math.max(0, Math.min(5, Math.round(n)));
    return "★".repeat(n) + "☆".repeat(5 - n);
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return ""; }
  }

  /* ---------- summary under the product title (real average, or hidden) ---------- */
  function renderSummaryRow(summary) {
    if (!summaryRow) return;
    if (!summary || !summary.count) { summaryRow.hidden = true; return; }
    var avg = Number(summary.average) || 0;
    summaryRow.textContent = "";
    var stars = document.createElement("span");
    stars.className = "stars";
    stars.setAttribute("aria-hidden", "true");
    stars.textContent = starStr(avg);
    var label = document.createElement("span");
    label.className = "rlabel";
    label.textContent = avg.toFixed(1) + " · " + summary.count + " review" + (summary.count === 1 ? "" : "s");
    summaryRow.appendChild(stars);
    summaryRow.appendChild(label);
    summaryRow.setAttribute("aria-label", avg.toFixed(1) + " out of 5 stars from " + summary.count + " reviews");
    summaryRow.hidden = false;
  }

  function injectJsonLd(summary, productName) {
    if (!summary || !summary.count) return;
    try {
      var s = document.createElement("script");
      s.type = "application/ld+json";
      s.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": productName || (document.querySelector("h1") && document.querySelector("h1").textContent) || document.title,
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": Number(summary.average).toFixed(1),
          "reviewCount": summary.count,
          "bestRating": 5, "worstRating": 1
        }
      });
      document.head.appendChild(s);
    } catch (e) {}
  }

  /* ---------- in-section summary bar (average + histogram) ---------- */
  function renderSummaryBar(summary) {
    var wrap = sec.querySelector(".rv-summary");
    if (!wrap) return;
    if (!summary || !summary.count) { wrap.hidden = true; return; }
    wrap.hidden = false;
    var avg = Number(summary.average) || 0;
    var bars = (summary.histogram || []).map(function (h) {
      var pct = summary.count ? Math.round((h.count / summary.count) * 100) : 0;
      return '<div class="rv-bar"><span class="rv-bar-k">' + h.stars + " star</span>" +
        '<span class="rv-bar-track"><span class="rv-bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="rv-bar-n">' + h.count + "</span></div>";
    }).join("");
    wrap.innerHTML =
      '<div><div class="rv-avg">' + avg.toFixed(1) + '</div>' +
      '<div class="stars rv-stars-static" aria-hidden="true">' + starStr(avg) + "</div>" +
      '<div class="rv-count">' + summary.count + " review" + (summary.count === 1 ? "" : "s") + "</div></div>" +
      '<div class="rv-bars">' + bars + "</div>";
  }

  /* ---------- a single review card (all text via textContent) ---------- */
  function reviewCard(r) {
    var card = document.createElement("article");
    card.className = "rv-item";

    var head = document.createElement("div");
    head.className = "rv-head";
    var st = document.createElement("span");
    st.className = "rv-stars";
    st.setAttribute("aria-label", r.rating + " out of 5 stars");
    st.textContent = starStr(r.rating);
    head.appendChild(st);
    if (r.verified) {
      var vb = document.createElement("span");
      vb.className = "rv-verified";
      vb.textContent = "Verified buyer";
      head.appendChild(vb);
    }
    card.appendChild(head);

    if (r.title) {
      var h = document.createElement("h3");
      h.className = "rv-title";
      h.textContent = r.title;
      card.appendChild(h);
    }
    var body = document.createElement("p");
    body.className = "rv-body";
    body.textContent = r.body || "";
    card.appendChild(body);

    var meta = document.createElement("p");
    meta.className = "rv-meta";
    meta.textContent = (r.name || "Anonymous") + " · " + fmtDate(r.date);
    card.appendChild(meta);

    if (r.reply) {
      var rep = document.createElement("div");
      rep.className = "rv-reply";
      var rl = document.createElement("b"); rl.textContent = "SportPharm replied";
      var rb = document.createElement("p"); rb.textContent = r.reply;
      rep.appendChild(rl); rep.appendChild(rb);
      if (r.reply_date) { var rd = document.createElement("small"); rd.textContent = fmtDate(r.reply_date); rep.appendChild(rd); }
      card.appendChild(rep);
    }
    return card;
  }

  /* ---------- fetch + render ---------- */
  function load(initial) {
    if (loading) return;
    loading = true;
    if (moreBtn) moreBtn.disabled = true;
    fetch(API + "/api/reviews?sku=" + encodeURIComponent(SKU) + "&limit=10&offset=" + offset, {
      headers: { "Accept": "application/json" }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        loading = false;
        if (moreBtn) moreBtn.disabled = false;
        if (!d || !d.ok) { if (initial) showEmpty(); return; }
        if (initial) {
          renderSummaryRow(d.summary);
          renderSummaryBar(d.summary);
          injectJsonLd(d.summary, d.product && d.product.name);
        }
        var items = d.reviews || [];
        if (initial && !items.length) { showEmpty(); }
        else { items.forEach(function (rv) { listEl.appendChild(reviewCard(rv)); }); }
        if (d.next_offset == null) { if (moreBtn) moreBtn.hidden = true; }
        else { offset = d.next_offset; if (moreBtn) moreBtn.hidden = false; }
      })
      .catch(function () {
        loading = false;
        if (moreBtn) moreBtn.disabled = false;
        if (initial) showEmpty();
      });
  }

  function showEmpty() {
    listEl.textContent = "";
    var p = document.createElement("p");
    p.className = "rv-empty";
    p.textContent = "No reviews yet — be the first to share yours.";
    listEl.appendChild(p);
    if (moreBtn) moreBtn.hidden = true;
  }

  /* ---------- write-a-review form ---------- */
  function setRating(n) {
    selectedRating = Math.max(0, Math.min(5, n | 0));
    starBtns.forEach(function (b, i) { b.classList.toggle("on", i < selectedRating); });
    var pick = sec.querySelector(".rv-pick");
    if (pick) pick.setAttribute("aria-label", selectedRating ? (selectedRating + " of 5 stars selected") : "Select a rating");
  }

  function buildForm() {
    formEl = document.createElement("form");
    formEl.className = "rv-form";
    formEl.setAttribute("novalidate", "");
    formEl.innerHTML =
      '<h3 class="rv-form-h">Write a review</h3>' +
      '<div class="rv-field"><label>Your rating</label>' +
      '<div class="rv-pick" role="group" aria-label="Select a rating"></div></div>' +
      '<div class="rv-field"><label for="rv-title">Headline <span style="text-transform:none;font-weight:600;color:#8a938f">(optional)</span></label><input id="rv-title" name="title" type="text" maxlength="120"></div>' +
      '<div class="rv-field"><label for="rv-body">Your review</label><textarea id="rv-body" name="body" required minlength="10" placeholder="What did you think? (at least 10 characters)"></textarea></div>' +
      '<div class="rv-field"><label for="rv-name">Name as you&rsquo;d like it shown (first name and last initial)</label><input id="rv-name" name="name" type="text" autocomplete="name" required maxlength="80"></div>' +
      '<div class="rv-field"><label for="rv-email">Email (not published)</label><input id="rv-email" name="email" type="email" autocomplete="email" required></div>' +
      '<div class="rv-hp" aria-hidden="true"><label>Leave this field empty<input tabindex="-1" autocomplete="off" name="website" type="text"></label></div>' +
      '<button class="rv-submit" type="submit">Submit review <span aria-hidden="true">&rarr;</span></button>' +
      '<p class="rv-err" hidden></p>';

    var pick = formEl.querySelector(".rv-pick");
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "rv-star";
        b.setAttribute("aria-label", n + " star" + (n === 1 ? "" : "s"));
        b.textContent = "★";
        b.addEventListener("click", function () { setRating(n); });
        pick.appendChild(b);
        starBtns.push(b);
      })(i);
    }
    errEl = formEl.querySelector(".rv-err");
    formEl.addEventListener("submit", onSubmit);
    return formEl;
  }

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.hidden = false;
  }

  function onSubmit(e) {
    e.preventDefault();
    errEl.hidden = true;
    var d = Object.fromEntries(new FormData(formEl).entries());
    var body = (d.body || "").trim();
    var name = (d.name || "").trim();
    var email = (d.email || "").trim();
    if (!selectedRating) { showError("Please choose a star rating."); return; }
    if (body.length < 10) { showError("Please write at least 10 characters."); return; }
    if (!name) { showError("Please add your name."); return; }
    if (!email) { showError("Please add your email (it won’t be shown)."); return; }

    var payload = {
      sku: SKU,
      rating: selectedRating,
      title: (d.title || "").trim(),
      body: body,
      name: name,
      email: email,
      site: "wasabirub",
      page: location.pathname,
      website: d.website || "",
      elapsed_ms: Date.now() - openedAt
    };

    var btn = formEl.querySelector(".rv-submit");
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = "Sending&hellip;"; }

    fetch(API + "/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (out) {
        if (out.status >= 200 && out.status < 300 && out.body && out.body.ok) { showThanks(); return; }
        if (out.status === 409 && out.body && out.body.already) { showError("You’ve already reviewed this product — thank you!"); }
        else { showError((out.body && out.body.error) || "Something went wrong. Please try again."); }
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label || "Submit review"; }
      })
      .catch(function () {
        showError("We couldn’t send that just now. Please try again in a moment.");
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label || "Submit review"; }
      });
  }

  function showThanks() {
    var ok = document.createElement("div");
    ok.className = "rv-form rv-ok";
    ok.innerHTML =
      '<div class="rv-ok-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg></div>' +
      "<h3>Thanks!</h3><p>Your review will appear once it’s checked.</p>";
    formEl.replaceWith(ok);
  }

  /* ---------- build the section + deep link ---------- */
  function init() {
    var mount = sec.querySelector(".reviews-mount");
    if (!mount) return;

    var bar = document.createElement("div");
    bar.className = "rv-summary";
    bar.hidden = true;
    mount.appendChild(bar);

    mount.appendChild(buildForm());

    listEl = document.createElement("div");
    listEl.className = "rv-list";
    mount.appendChild(listEl);

    moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "rv-more";
    moreBtn.hidden = true;
    moreBtn.textContent = "Show more reviews";
    moreBtn.addEventListener("click", function () { load(false); });
    mount.appendChild(moreBtn);

    load(true);

    /* Deep link from the review-request email: ?review=1&stars=N */
    try {
      var p = new URLSearchParams(location.search);
      if (p.get("review") === "1") {
        var stars = parseInt(p.get("stars"), 10);
        if (stars >= 1 && stars <= 5) setRating(stars);
        setTimeout(function () {
          sec.scrollIntoView({ behavior: "smooth", block: "start" });
          var ta = formEl && formEl.querySelector("#rv-body");
          if (ta) ta.focus({ preventScroll: true });
        }, 300);
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
