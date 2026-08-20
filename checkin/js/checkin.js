/* =============================================================================
   checkin.js — the kiosk itself.

   Two screens: the check-in form, and the confirmation with the prize wheel.
   There is no attract screen — the EMPTY FORM is the resting state, which is
   why the idle wipe matters. A part-filled form left on a kiosk is somebody's
   home address sitting in public.
============================================================================= */
(function () {
  'use strict';

  var CFG = window.CHECKIN_CONFIG;
  var $   = function (s, r) { return (r || document).querySelector(s); };
  var $$  = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var STATES = ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO ' +
                'MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY').split(' ');

  var idleTimer = null, idleCountdown = null, doneCountdown = null;
  var pendingRec = null;          // saved record awaiting its spin

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function show(id) { $$('.screen').forEach(function (s) { s.classList.toggle('is-active', s.id === id); }); }
  function veil(id, on) { $(id).classList.toggle('is-active', on !== false); }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }
  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '><use href="#i-' + name + '"/></svg>';
  }

  /* ---------------------------------------------------------------------- */
  /*  Build the page from config                                             */
  /* ---------------------------------------------------------------------- */
  function build() {
    var loc = CFG.event.location || '';
    document.title = 'Check In — ' + CFG.event.brand + ' ' + CFG.event.name;

    if (CFG.hero.image) $('#lk-img').src = CFG.hero.image;
    $('#lk-img').alt = CFG.hero.alt || 'Grand Opening!';
    $('#h-line1').textContent  = CFG.hero.line1;
    $('#h-line2').textContent  = CFG.hero.line2;
    $('#excited').textContent  = CFG.hero.excited;
    $('#done-sub').textContent = CFG.event.prizeLine;
    $('#closing').textContent  = CFG.event.closingLine;
    $('#wheel-note').textContent = CFG.event.spinHint;

    // State dropdown, defaulted to the state the event is in.
    var sel = $('#in-state');
    sel.innerHTML = '<option value="">—</option>' +
      STATES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
    var home = (loc.match(/\b([A-Z]{2})\b\s*$/) || [])[1];
    sel.value = STATES.indexOf(home) > -1 ? home : 'FL';

    var role = $('#in-role');
    role.innerHTML = '<option value="">Role (optional)</option>' +
      CFG.roles.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('');

    // A select showing its empty option should look like a placeholder, not
    // like an answer the guest already gave.
    $$('#in-role, #in-state').forEach(function (el) {
      var mark = function () { el.classList.toggle('is-empty', !el.value); };
      el.addEventListener('change', mark); mark();
    });

    $('#wrap-phone').hidden = !CFG.fields.phone;
    $('#wrap-role').hidden  = !CFG.fields.role;

    $('#perks').innerHTML = (CFG.perks || []).map(function (p) {
      return '<div class="perk">' + icon(p.icon) + '<h3>' + esc(p.title) + '</h3><p>' + esc(p.body) + '</p></div>';
    }).join('');

    var TRUST_ICONS = ['shield', 'flask', 'scope', 'check'];
    $('#trust-row').innerHTML = (CFG.trust || []).map(function (t, i) {
      return '<li>' + icon(TRUST_ICONS[i % TRUST_ICONS.length]) + '<span>' + esc(t) + '</span></li>';
    }).join('');

    var meta = [];
    if (CFG.venue.address) meta.push('<span>' + icon('pin') + esc(CFG.venue.address) + '</span>');
    if (CFG.venue.hours)   meta.push('<span>' + icon('clock') + esc(CFG.venue.hours) + '</span>');
    $('#trust-meta').innerHTML = meta.join('');

    $('#chips-letter').innerHTML = ['A', 'B', 'C', 'D'].map(function (l, i) {
      return '<button type="button" class="chip" aria-pressed="' + (i === 0) + '" data-v="' + l + '">iPad ' + l + '</button>';
    }).join('');
    $('#chips-letter').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $$('.chip', this).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
    });

    if (CFG.wheel.enabled) Wheel.render($('#wheel-labels'));
  }

  /* ---------------------------------------------------------------------- */
  /*  Idle wipe                                                              */
  /* ---------------------------------------------------------------------- */
  function isDirty() {
    return ['in-name','in-company','in-email','in-phone','in-street','in-city','in-zip','in-role']
      .some(function (id) { var e = $('#' + id); return e && e.value.trim(); });
  }
  function armIdle() {
    disarmIdle();
    idleTimer = setTimeout(function () {
      if (!isDirty()) { armIdle(); return; }      // empty form is already safe
      var left = CFG.kiosk.idleWarnSeconds;
      $('#idle-timer').textContent = left;
      veil('#veil-idle', true);
      idleCountdown = setInterval(function () {
        left--; $('#idle-timer').textContent = left;
        if (left <= 0) { clearInterval(idleCountdown); reset(); }
      }, 1000);
    }, CFG.kiosk.idleSeconds * 1000);
  }
  function disarmIdle() {
    clearTimeout(idleTimer); clearInterval(idleCountdown); veil('#veil-idle', false);
  }

  /* ---------------------------------------------------------------------- */
  /*  Validation                                                             */
  /* ---------------------------------------------------------------------- */
  function setErr(id, on) {
    var el = $('#' + id);
    if (el) {
      var field = el.closest('.field');
      if (field) field.classList.toggle('is-bad', !!on);
      else el.classList.toggle('is-bad', !!on);
    }
    var e = $('.err[data-for="' + id + '"]');
    if (e) e.classList.toggle('is-on', !!on);
  }
  function digits(s) { return String(s).replace(/\D/g, ''); }

  function validate() {
    var v = {
      full_name: $('#in-name').value.trim(),
      company:   $('#in-company').value.trim(),
      email:     $('#in-email').value.trim(),
      phone:     CFG.fields.phone ? $('#in-phone').value.trim() : '',
      street:    $('#in-street').value.trim(),
      city:      $('#in-city').value.trim(),
      state:     $('#in-state').value,
      zip:       $('#in-zip').value.trim(),
      role:      CFG.fields.role ? $('#in-role').value : ''
    };
    var bad = [];
    if (v.full_name.length < 2)                         { setErr('in-name', 1);   bad.push('in-name'); }   else setErr('in-name', 0);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.email)) { setErr('in-email', 1);  bad.push('in-email'); }  else setErr('in-email', 0);
    if (v.street.length < 3)                            { setErr('in-street', 1); bad.push('in-street'); } else setErr('in-street', 0);
    if (v.city.length < 2)                              { setErr('in-city', 1);   bad.push('in-city'); }   else setErr('in-city', 0);
    if (!v.state)                                       { setErr('in-state', 1);  bad.push('in-state'); }  else setErr('in-state', 0);
    if (!/^\d{5}(-\d{4})?$/.test(v.zip))                { setErr('in-zip', 1);    bad.push('in-zip'); }    else setErr('in-zip', 0);
    if (v.phone && digits(v.phone).length !== 10)       { setErr('in-phone', 1);  bad.push('in-phone'); }  else setErr('in-phone', 0);

    if (bad.length) {
      var first = $('#' + bad[0]);
      first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      first.focus({ preventScroll: true });
      return null;
    }
    if (v.phone) v.phone = digits(v.phone);
    return v;
  }

  /* ---------------------------------------------------------------------- */
  /*  Reset                                                                  */
  /* ---------------------------------------------------------------------- */
  function reset() {
    disarmIdle();
    clearTimeout(doneCountdown);
    pendingRec = null;
    $('#checkin-form').reset();
    ['in-name','in-company','in-email','in-phone','in-street','in-city','in-state','in-zip','in-role']
      .forEach(function (id) { setErr(id, 0); });
    $('#in-state').value = 'FL';
    $$('#in-role, #in-state').forEach(function (el) { el.classList.toggle('is-empty', !el.value); });
    $('#btn-submit').disabled = false;
    $('#btn-submit').querySelector('span').textContent = 'Check in';

    // Put the wheel back to its unspun state for the next guest.
    var w = $('#wheel');
    w.style.transition = 'none';
    w.style.transform = 'rotate(0deg)';
    Wheel.render($('#wheel-labels'));
    $('#wheel-stage').hidden = false;
    $('#prize-stage').hidden = true;
    spinning = false;
    $('#wheel-tap').classList.remove('is-spinning');
    $('#wheel-tap').removeAttribute('aria-disabled');
    $('#wheel-note').textContent = CFG.event.spinHint;

    show('screen-form');
    window.scrollTo(0, 0);
    armIdle();
  }

  /* ---------------------------------------------------------------------- */
  /*  Submit                                                                 */
  /* ---------------------------------------------------------------------- */
  function submit(e) {
    e.preventDefault();
    var v = validate();
    if (!v) return;

    /* Someone tapping through twice would take a second spin at the prize
       stock. Catch it, but never block them — two people can legitimately
       share a practice inbox. */
    var dupe = Store.rows().filter(function (r) {
      return r.email.toLowerCase() === v.email.toLowerCase();
    }).pop();
    if (dupe) {
      var again = confirm('We already have ' + v.email + ' checked in as ' + dupe.raffle +
                          ' (' + dupe.full_name + ').\n\nCheck in again and spin a second time?');
      if (!again) { reset(); return; }
    }

    var btn = $('#btn-submit');
    btn.disabled = true; btn.querySelector('span').textContent = 'Saving…';
    disarmIdle();

    try {
      pendingRec = Store.add(v);          // local write — this is the commit
    } catch (err) {
      btn.disabled = false; btn.querySelector('span').textContent = 'Complete check-in';
      toast('Could not save on this iPad. Get a staff member.');
      console.error(err);
      return;
    }

    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    show('screen-done');
    window.scrollTo(0, 0);

    if (!CFG.wheel.enabled) { revealPrize(null); }
  }

  /* ---------------------------------------------------------------------- */
  /*  The spin                                                               */
  /* ---------------------------------------------------------------------- */
  var spinning = false;
  function spin() {
    /* Guard on our own flag, not on the button's disabled state — a disabled
       <button> stops firing click, but a guest can land two taps inside the
       same frame and a second spin would draw a second prize against stock. */
    if (spinning) return;
    spinning = true;
    var tap = $('#wheel-tap');
    tap.classList.add('is-spinning');
    tap.setAttribute('aria-disabled', 'true');
    $('#wheel-note').textContent = 'Good luck…';

    var prize = Wheel.draw();            // decided here, before anything moves
    Wheel.spinTo($('#wheel'), prize).then(function (p) {
      /* Only count it against stock once it has actually been shown to the
         guest — a spin abandoned mid-animation shouldn't burn a bottle. */
      Wheel.recordAward(p.id);
      if (pendingRec) Store.setPrize(pendingRec.id, p.id, p.label);
      spinning = false;
      revealPrize(p);
    });
  }

  function revealPrize(p) {
    var rec = pendingRec || {};
    $('#wheel-stage').hidden = true;
    $('#prize-stage').hidden = false;

    if (p) {
      var lost = (p.id === 'none');
      var card = $('#prize-card');
      /* Prizes no longer carry their own colour — the wheel's palette is
         positional. A win is brand red; a loss is a muted grey. */
      card.style.setProperty('--prize', lost ? '#8B96A2' : '#D6202A');
      card.classList.toggle('is-loss', lost);
      $('#prize-kicker').textContent = lost ? 'This time' : 'You won';
      $('#prize-name').textContent   = p.label;
      $('#done-sub').textContent     = lost ? 'Thanks for coming out.' : 'Nice one.';
    } else {
      $('#prize-card').hidden = true;
    }

    /* No countdown. The guest taps "Next guest" when they are done reading —
       a screen that snatches itself away mid-sentence is worse than one that
       waits. `confirmSeconds` can reinstate a quiet auto-reset if the queue
       ever needs it, but it is off by default. */
    clearTimeout(doneCountdown);
    if (CFG.kiosk.confirmSeconds > 0) {
      doneCountdown = setTimeout(reset, CFG.kiosk.confirmSeconds * 1000);
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Staff screen                                                           */
  /* ---------------------------------------------------------------------- */
  function renderStaff() {
    var rows = Store.rows();
    var pending = Store.pendingCount();
    $('#staff-letter').textContent = (Store.device() || {}).letter || 'A';
    $('#stat-total').textContent   = rows.length;
    /* With no Supabase project configured there is nothing to be synced or
       pending — "3 waiting to sync" would imply a queue that never drains. */
    $('#stat-synced').textContent  = Store.configured() ? (rows.length - pending) : '—';
    $('#stat-pending').textContent = Store.configured() ? pending : '—';

    var sync = $('#staff-sync');
    if (!Store.configured())    sync.innerHTML = '<span class="pill pill-off">Local only — no cloud configured</span>';
    else if (!navigator.onLine) sync.innerHTML = '<span class="pill pill-wait">Offline — saved here, will sync later</span>';
    else if (pending)           sync.innerHTML = '<span class="pill pill-wait">' + pending + ' waiting to sync</span>';
    else                        sync.innerHTML = '<span class="pill pill-ok">All synced</span>';

    var list = $('#staff-list');
    if (!rows.length) { list.innerHTML = '<p class="staff-empty">No check-ins yet.</p>'; return; }

    /* Prize stock left on THIS iPad. Staff need this to know when to swap the
       display, and it is the only place the number is visible. */
    var stockBits = CFG.wheel.enabled ? CFG.wheel.prizes.filter(function (p) {
      return p.stock !== null && p.stock !== undefined;
    }).map(function (p) {
      var left = Wheel.remaining(p);
      return '<span class="pill ' + (left ? 'pill-ok' : 'pill-wait') + '">' +
             esc(p.label) + ': ' + left + ' left</span>';
    }).join(' ') : '';

    var body = rows.slice().reverse().map(function (r) {
      var t = new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return '<tr><td class="mono">' + esc(r.raffle) + '</td><td>' + esc(r.full_name) +
             '</td><td>' + esc(r.company || '—') + '</td><td>' + esc(r.prize_label || '—') +
             '</td><td>' + esc(r.email) + '</td><td>' + t +
             '</td><td>' + (r.synced ? '<span class="pill pill-ok">✓</span>'
                                     : '<span class="pill pill-wait">…</span>') + '</td></tr>';
    }).join('');
    list.innerHTML = (stockBits ? '<div style="padding:11px 13px;border-bottom:1.5px solid var(--line);' +
                      'display:flex;gap:7px;flex-wrap:wrap">' + stockBits + '</div>' : '') +
                     '<table><thead><tr><th>Code</th><th>Name</th><th>Company</th><th>Prize</th>' +
                     '<th>Email</th><th>Time</th><th>Sync</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url  = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ---------------------------------------------------------------------- */
  /*  Wire up                                                                */
  /* ---------------------------------------------------------------------- */
  function wire() {
    $('#checkin-form').addEventListener('submit', submit);
    $('#wheel-tap').addEventListener('click', spin);
    $('#btn-next').addEventListener('click', reset);
    $('#btn-still-here').addEventListener('click', function () { disarmIdle(); armIdle(); });

    ['input', 'touchstart', 'click'].forEach(function (ev) {
      $('#screen-form').addEventListener(ev, function () {
        if ($('#screen-form').classList.contains('is-active')) armIdle();
      }, { passive: true });
    });

    // Enter moves to the next field rather than submitting halfway down.
    var order = ['in-name','in-email','in-street','in-city','in-state','in-zip','in-company','in-role','in-phone'];
    order.forEach(function (id, i) {
      var el = $('#' + id); if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        for (var j = i + 1; j < order.length; j++) {
          var n = $('#' + order[j]);
          if (n && n.offsetParent !== null) { n.focus(); return; }
        }
        $('#btn-submit').click();
      });
    });

    // ---- staff way in: five taps on the wordmark inside three seconds ----
    var taps = [];
    $('#secret-tap').addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      var now = Date.now();
      taps = taps.filter(function (t) { return now - t < 3000; });
      taps.push(now);
      if (taps.length >= 5) {
        taps = [];
        $('#pin-in').value = ''; setErr('pin-in', 0);
        veil('#veil-pin', true);
        setTimeout(function () { $('#pin-in').focus(); }, 60);
      }
    });
    $('#btn-pin-cancel').addEventListener('click', function () { veil('#veil-pin', false); });
    $('#btn-pin-ok').addEventListener('click', tryPin);
    $('#pin-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPin(); });

    function tryPin() {
      Store.checkPin($('#pin-in').value).then(function (ok) {
        if (!ok) { setErr('pin-in', 1); return; }
        veil('#veil-pin', false);
        renderStaff();
        veil('#veil-staff', true);
      });
    }

    $('#btn-staff-close').addEventListener('click', function () { veil('#veil-staff', false); });
    $('#btn-sync-now').addEventListener('click', function () {
      if (!Store.configured()) { toast('No cloud configured — everything is saved on this iPad.'); return; }
      Store.sync().then(function (n) {
        renderStaff();
        toast(n ? 'Synced ' + n + ' check-in' + (n === 1 ? '' : 's') + '.' : 'Nothing to sync right now.');
      });
    });
    $('#btn-export').addEventListener('click', function () {
      if (!Store.rows().length) { toast('Nothing to export yet.'); return; }
      var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
      download('sportpharm-checkins-' + ((Store.device() || {}).letter || 'A') + '-' +
               d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.csv',
               Store.csv(), 'text/csv;charset=utf-8');
    });
    $('#btn-draw').addEventListener('click', function () {
      var rows = Store.rows();
      if (!rows.length) { toast('No entries yet.'); return; }
      var i = crypto.getRandomValues(new Uint32Array(1))[0] % rows.length;
      toast('Drawn: ' + rows[i].raffle + ' — ' + rows[i].full_name);
    });
    $('#btn-wipe').addEventListener('click', function () {
      var n = Store.rows().length, pending = Store.pendingCount();
      var warn = 'Erase all ' + n + ' check-in' + (n === 1 ? '' : 's') + ' from this iPad?';
      if (pending) warn += '\n\n' + pending + ' have NOT synced to the cloud yet and will be lost. ' +
                          'Download the CSV first.';
      warn += '\n\nThis also resets the prize stock counters.\n\nThis cannot be undone.';
      if (!confirm(warn)) return;
      if (!confirm('Really erase? Last chance.')) return;
      Store.clearAll(); Wheel.reset(); renderStaff(); toast('Erased.');
    });

    document.addEventListener('spci:sync', function () {
      if ($('#veil-staff').classList.contains('is-active')) renderStaff();
    });

    $('#btn-setup-save').addEventListener('click', function () {
      var chip = $('#chips-letter .chip[aria-pressed="true"]');
      var pin = $('#setup-pin').value.trim();
      if (!chip || !/^\d{4}$/.test(pin)) { setErr('setup-pin', 1); return; }
      setErr('setup-pin', 0);
      Store.setUpDevice(chip.dataset.v, pin).then(function () {
        veil('#veil-setup', false);
        toast('Ready. This is iPad ' + chip.dataset.v + '.');
        armIdle();
      });
    });
  }

  /* Keep the screen awake between guests. iOS 16.4+ honours this; on older
     iPads it throws, which is why Settings ▸ Auto-Lock ▸ Never is in the
     setup checklist rather than optional. */
  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    var lock = null;
    var take = function () {
      navigator.wakeLock.request('screen')
        .then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); })
        .catch(function () {});
    };
    take();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !lock) take();
    });
  }

  /* ---------------------------------------------------------------------- */
  build();
  wire();
  keepAwake();
  if (!Store.isSetUp()) veil('#veil-setup', true); else armIdle();
  Store.sync();
})();
