/* =============================================================================
   wheel.js — the prize wheel.

   THE ONE THING TO UNDERSTAND: the outcome is decided BEFORE the wheel moves.

   We draw a winner with a weighted random pick (skipping anything out of
   stock), and only then work out what angle would put that wedge under the
   pointer, and animate to it. The animation is theatre; the draw is the truth.

   Doing it the other way round — spin with random physics and read off
   wherever it stops — means the odds are whatever the animation happens to
   produce, stock limits can't be enforced, and you cannot answer "how likely
   was the wine?" That is not a wheel you want deciding real inventory.
============================================================================= */
(function () {
  'use strict';

  var CFG    = window.CHECKIN_CONFIG;
  var K_AWARD = 'spci-awarded-v1';        // {prizeId: countAwardedOnThisIpad}

  function awarded() {
    try { return JSON.parse(localStorage.getItem(K_AWARD)) || {}; }
    catch (e) { return {}; }
  }
  function recordAward(id) {
    var a = awarded();
    a[id] = (a[id] || 0) + 1;
    try { localStorage.setItem(K_AWARD, JSON.stringify(a)); } catch (e) {}
  }
  function remaining(p) {
    if (p.stock === null || p.stock === undefined) return Infinity;
    return Math.max(0, p.stock - (awarded()[p.id] || 0));
  }
  function inStock(p) { return remaining(p) > 0; }

  /* ---------------------------------------------------------------------- */
  /*  Build the visible wheel: one wedge per slot, prizes interleaved so the  */
  /*  losing wedges don't sit in a block.                                    */
  /* ---------------------------------------------------------------------- */
  function segments() {
    var singles = [], multi = [];
    CFG.wheel.prizes.forEach(function (p) {
      var n = p.slots || 1;
      if (n === 1) singles.push(p); else for (var i = 0; i < n; i++) multi.push(p);
    });
    // Deal the repeated prize (normally "better luck") between the singles.
    var out = [], gap = multi.length ? (singles.length + multi.length) / multi.length : 0;
    var si = 0, mi = 0;
    for (var k = 0; k < singles.length + multi.length; k++) {
      if (mi < multi.length && k >= Math.round(mi * gap) && si < singles.length) { out.push(multi[mi++]); }
      else if (si < singles.length) { out.push(singles[si++]); }
      else { out.push(multi[mi++]); }
    }
    return out;
  }

  var SEGS = segments();

  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function render(svg) {
    var n = SEGS.length, step = 360 / n, cx = 150, cy = 150, r = 148;
    var parts = [];
    SEGS.forEach(function (p, i) {
      var a0 = i * step, a1 = a0 + step;
      var s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1);
      var big = step > 180 ? 1 : 0;
      var cls = inStock(p) ? '' : ' class="seg-out"';
      parts.push('<path' + cls + ' d="M' + cx + ' ' + cy + ' L' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) +
                 ' A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2) +
                 ' Z" fill="' + p.color + '" stroke="#fff" stroke-width="2"/>');

      /* Label runs ALONG the radius. The radius at `mid` (measured clockwise
         from 12 o'clock) points at (mid - 90) degrees in SVG's coordinate
         system, so that — not `mid` — is the text's rotation. Getting this
         wrong tilts every label by 90 degrees and leaves half of them upside
         down. The extra 180 flips the ones on the left half back upright. */
      var mid = a0 + step / 2;
      var t = polar(cx, cy, r * 0.60, mid);
      var flip = mid > 180 ? 180 : 0;
      var words = p.label.split(' ');
      var lines = [];
      if (p.label.length > 13 && words.length > 1) {
        var halfw = Math.ceil(words.length / 2);
        lines = [words.slice(0, halfw).join(' '), words.slice(halfw).join(' ')];
      } else { lines = [p.label]; }
      var tspans = lines.map(function (l, li) {
        return '<tspan x="0" dy="' + (li === 0 ? (lines.length > 1 ? -5 : 0) : 11) + '">' +
               l.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</tspan>';
      }).join('');
      parts.push('<g' + cls + ' transform="translate(' + t[0].toFixed(2) + ' ' + t[1].toFixed(2) +
                 ') rotate(' + (mid - 90 + flip) + ')"><text text-anchor="middle">' + tspans + '</text></g>');
    });
    svg.innerHTML = parts.join('');
  }

  /* ---------------------------------------------------------------------- */
  /*  The draw. Weighted, stock-aware, cryptographically random.             */
  /* ---------------------------------------------------------------------- */
  function draw() {
    var pool = CFG.wheel.prizes.filter(function (p) { return inStock(p) && p.weight > 0; });

    /* Everything is gone — including, somehow, the losing option. Fall back to
       the first prize flagged unlimited rather than returning undefined and
       breaking the confirmation screen. */
    if (!pool.length) {
      return CFG.wheel.prizes.filter(function (p) { return p.stock === null; })[0] ||
             CFG.wheel.prizes[CFG.wheel.prizes.length - 1];
    }
    var total = pool.reduce(function (s, p) { return s + p.weight; }, 0);
    // crypto, not Math.random — this decides who gets the wine.
    var roll = (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /* Spin to a prize we have already chosen. Returns a promise for the reveal. */
  var turns = 0;
  function spinTo(svg, prize) {
    var idxs = [];
    SEGS.forEach(function (p, i) { if (p.id === prize.id) idxs.push(i); });
    // If a prize owns several wedges, land on a random one so repeat guests
    // don't see it stop in the same place every time.
    var seg = idxs[crypto.getRandomValues(new Uint32Array(1))[0] % idxs.length];

    var n = SEGS.length, step = 360 / n;
    var centre = seg * step + step / 2;
    // A little jitter inside the wedge so it never looks mechanically exact.
    var jitter = (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 - 0.5) * step * 0.55;
    turns += 5 + (crypto.getRandomValues(new Uint32Array(1))[0] % 3);
    var target = turns * 360 + (360 - centre) - jitter;

    var secs = CFG.wheel.spinSeconds || 5;
    svg.style.transition = 'transform ' + secs + 's cubic-bezier(.17,.67,.16,1)';
    // Force a reflow so a repeated spin actually re-runs the transition.
    void svg.offsetWidth;
    svg.style.transform = 'rotate(' + target.toFixed(2) + 'deg)';

    return new Promise(function (resolve) {
      var done = false;
      function finish() { if (done) return; done = true; resolve(prize); }
      svg.addEventListener('transitionend', finish, { once: true });
      // transitionend does not fire if the tab is backgrounded mid-spin, and a
      // guest must never be left staring at a wheel that stopped with no result.
      setTimeout(finish, secs * 1000 + 400);
    });
  }

  window.Wheel = {
    render: render, draw: draw, spinTo: spinTo,
    recordAward: recordAward, remaining: remaining, segments: function () { return SEGS; },
    awarded: awarded,
    reset: function () { try { localStorage.removeItem(K_AWARD); } catch (e) {} }
  };
})();
