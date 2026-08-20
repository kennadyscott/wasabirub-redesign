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
    // Expand each prize into its wedges, then deal them round-robin so the two
    // wedges of a product land on opposite sides of the wheel instead of side
    // by side, and the two rationed prizes sit well apart.
    var queues = CFG.wheel.prizes.map(function (p) {
      var q = []; for (var i = 0; i < (p.slots || 1); i++) q.push(p); return q;
    });
    var out = [], moved = true;
    while (moved) {
      moved = false;
      for (var i = 0; i < queues.length; i++) {
        if (queues[i].length) { out.push(queues[i].shift()); moved = true; }
      }
    }
    return out;
  }

  var SEGS = segments();

  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  var CX = 200, CY = 200;   // viewBox is 0 0 400 400
  /* 179 is where the flat wedge face ends on the artwork (measured at 511 of a
     570px radius). Labels must stay inside it or they run onto the rim. */
  var R_FACE = 179;

  /* The artwork's wedges alternate light, red, light, dark... so the label ink
     only has to alternate too. Sampled from the image rather than guessed:
     even wedges are white/grey, odd wedges are red/black. */
  function ink(i) { return (i % 2 === 0) ? '#141A21' : '#FFFFFF'; }

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function render(svg) {
    var n = SEGS.length, step = 360 / n, parts = [];

    SEGS.forEach(function (p, i) {
      var out = !inStock(p);
      var a0 = i * step, a1 = a0 + step;

      /* A prize that has run out is visibly out of play — a guest watching the
         wheel should be able to see the wine has gone rather than wonder why it
         never comes up. */
      if (out) {
        var s0 = polar(CX, CY, R_FACE, a0), s1 = polar(CX, CY, R_FACE, a1);
        parts.push('<path d="M' + CX + ' ' + CY + ' L' + s0[0].toFixed(2) + ' ' + s0[1].toFixed(2) +
                   ' A' + R_FACE + ' ' + R_FACE + ' 0 0 1 ' + s1[0].toFixed(2) + ' ' + s1[1].toFixed(2) +
                   ' Z" fill="rgba(6,14,28,.72)"/>');
      }

      var mid = a0 + step / 2;
      var t = polar(CX, CY, R_FACE * 0.62, mid);
      /* Text runs ALONG the radius. The radius at `mid` (clockwise from 12
         o'clock) points at (mid - 90) in SVG coordinates — using `mid` itself
         tilts every label 90 degrees. The extra 180 flips the left half
         upright. */
      var flip = mid > 180 ? 180 : 0;

      var words = p.label.split(' ');
      var lines = (p.label.length > 12 && words.length > 1)
        ? [words.slice(0, Math.ceil(words.length / 2)).join(' '),
           words.slice(Math.ceil(words.length / 2)).join(' ')]
        : [p.label];
      var tspans = lines.map(function (l, li) {
        return '<tspan x="0" dy="' + (li === 0 ? (lines.length > 1 ? -6 : 0) : 13) + '">' +
               esc(l) + '</tspan>';
      }).join('');

      parts.push('<g' + (out ? ' opacity=".45"' : '') +
                 ' transform="translate(' + t[0].toFixed(2) + ' ' + t[1].toFixed(2) +
                 ') rotate(' + (mid - 90 + flip) + ')"><text text-anchor="middle" fill="' +
                 (out ? '#FFFFFF' : ink(i)) + '">' + tspans + '</text></g>');
    });

    svg.innerHTML = parts.join('');
  }

  /* ---------------------------------------------------------------------- */
  /*  The draw. Every guest wins; two prizes are rationed across the night.   */
  /* ---------------------------------------------------------------------- */

  function totalAwarded() {
    var a = awarded(), n = 0;
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) n += a[k];
    return n;
  }

  function rand() { return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; }

  /* A rationed prize's chance this spin is `remaining / guests still to come`.
     That is what spreads five gift cards across a whole evening instead of
     handing them all out to the first arrivals — a flat weight would happily
     give away all five in the opening twenty minutes.

     The clamp matters too: once actual attendance passes `expectedGuests` the
     divisor would collapse and the remaining prizes would dump on the next few
     guests. Capping the per-spin chance keeps them trickling out instead. */
  function rationedChance(p) {
    var left = remaining(p);
    if (left <= 0) return 0;
    var expected = CFG.wheel.expectedGuests || 150;
    var toCome   = Math.max(left, expected - totalAwarded());
    var cap      = CFG.wheel.maxRationedChance || 0.25;
    return Math.min(left / toCome, cap);
  }

  function draw() {
    var prizes = CFG.wheel.prizes;

    // 1. Roll for the rationed prizes first, each against its own chance.
    var roll = rand(), acc = 0;
    for (var i = 0; i < prizes.length; i++) {
      var p = prizes[i];
      if (!p.rationed) continue;
      acc += rationedChance(p);
      if (roll < acc) return p;
    }

    // 2. Otherwise a product, by weight. These are unlimited, so this branch
    //    can always be satisfied and nobody ever leaves empty-handed.
    var pool = prizes.filter(function (q) {
      return !q.rationed && q.weight > 0 && inStock(q);
    });
    if (!pool.length) {
      // Every product somehow capped out. Fall back to whatever still has
      // stock rather than returning undefined and breaking the reveal.
      pool = prizes.filter(inStock);
      if (!pool.length) return prizes[0];
      return pool[Math.floor(rand() * pool.length)];
    }
    var total = pool.reduce(function (sum, q) { return sum + q.weight; }, 0);
    var r = rand() * total;
    for (var j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) return pool[j];
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
    var seg = idxs[Math.floor(rand() * idxs.length) % idxs.length];

    var n = SEGS.length, step = 360 / n;
    var centre = seg * step + step / 2;
    // A little jitter inside the wedge so it never looks mechanically exact.
    var jitter = (rand() - 0.5) * step * 0.55;
    turns += 5 + Math.floor(rand() * 3);
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
    totalAwarded: totalAwarded, rationedChance: rationedChance,
    awarded: awarded,
    reset: function () { try { localStorage.removeItem(K_AWARD); } catch (e) {} }
  };
})();
