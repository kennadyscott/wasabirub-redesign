/* =============================================================================
   checkin.js — the kiosk itself.
============================================================================= */
(function () {
  'use strict';

  var CFG = window.CHECKIN_CONFIG;
  var $   = function (s, r) { return (r || document).querySelector(s); };
  var $$  = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var STATES = ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO ' +
                'MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY').split(' ');

  var selectedRole = '';
  var idleTimer = null, idleCountdown = null, doneCountdown = null;

  /* ---------------------------------------------------------------------- */
  /*  Screens                                                                */
  /* ---------------------------------------------------------------------- */
  function show(id) {
    $$('.screen').forEach(function (s) { s.classList.toggle('is-active', s.id === id); });
  }
  function veil(id, on) { $(id).classList.toggle('is-active', on !== false); }
  function closeVeils() { $$('.veil').forEach(function (v) { v.classList.remove('is-active'); }); }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  /* ---------------------------------------------------------------------- */
  /*  Build the form from config                                             */
  /* ---------------------------------------------------------------------- */
  function build() {
    var loc = CFG.event.location || '';
    var kicker = [CFG.event.name, loc].filter(Boolean).join(' · ');
    if (CFG.event.dateLabel) kicker += ' · ' + CFG.event.dateLabel;
    $('#w-kicker').textContent = kicker;
    $('#w-meta').textContent   = CFG.event.welcomeLine;
    $('#f-event').textContent  = CFG.event.name;
    $('#f-loc').textContent    = loc;
    $('#done-sub').textContent = CFG.raffle.enabled ? CFG.event.prizeLine : 'Thanks for coming out.';
    document.title = 'Check In — ' + CFG.event.brand + ' ' + CFG.event.name;

    // State dropdown, defaulted to the state the event is in.
    var sel = $('#in-state');
    sel.innerHTML = '<option value="">—</option>' +
      STATES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
    var home = (loc.match(/\b([A-Z]{2})\b\s*$/) || [])[1];
    sel.value = STATES.indexOf(home) > -1 ? home : 'FL';

    // Optional fields
    $('#wrap-phone').hidden = !CFG.fields.phone;
    $('#wrap-role').hidden  = !CFG.fields.role;

    // Chips
    $('#chips-role').innerHTML = CFG.roles.map(function (r) {
      return '<button type="button" class="chip" aria-pressed="false" data-v="' + esc(r) + '">' + esc(r) + '</button>';
    }).join('');

    // Role is single-select.
    $('#chips-role').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var was = b.getAttribute('aria-pressed') === 'true';
      $$('.chip', this).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', was ? 'false' : 'true');
      selectedRole = was ? '' : b.dataset.v;
    });
    // Setup sheet letters
    $('#chips-letter').innerHTML = ['A', 'B', 'C', 'D'].map(function (l, i) {
      return '<button type="button" class="chip" aria-pressed="' + (i === 0) + '" data-v="' + l + '">iPad ' + l + '</button>';
    }).join('');
    $('#chips-letter').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      $$('.chip', this).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
    });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  /* ---------------------------------------------------------------------- */
  /*  Idle wipe — a half-filled form is somebody's home address in public    */
  /* ---------------------------------------------------------------------- */
  function armIdle() {
    disarmIdle();
    idleTimer = setTimeout(function () {
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
    clearTimeout(idleTimer); clearInterval(idleCountdown);
    veil('#veil-idle', false);
  }

  /* ---------------------------------------------------------------------- */
  /*  Validation                                                             */
  /* ---------------------------------------------------------------------- */
  function setErr(id, on) {
    var el = $('#' + id);
    el.classList.toggle('is-bad', !!on);
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
      role:      CFG.fields.role ? selectedRole : ''
    };
    var bad = [];
    if (v.full_name.length < 2)                      { setErr('in-name', 1);    bad.push('in-name'); }    else setErr('in-name', 0);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.email)) { setErr('in-email', 1); bad.push('in-email'); }   else setErr('in-email', 0);
    if (v.street.length < 3)                         { setErr('in-street', 1);  bad.push('in-street'); }  else setErr('in-street', 0);
    if (v.city.length < 2)                           { setErr('in-city', 1);    bad.push('in-city'); }    else setErr('in-city', 0);
    if (!v.state)                                    { setErr('in-state', 1);   bad.push('in-state'); }   else setErr('in-state', 0);
    if (!/^\d{5}(-\d{4})?$/.test(v.zip))             { setErr('in-zip', 1);     bad.push('in-zip'); }     else setErr('in-zip', 0);
    // Phone is optional, but if they typed something it should be usable.
    if (v.phone && digits(v.phone).length !== 10)    { setErr('in-phone', 1);   bad.push('in-phone'); }   else setErr('in-phone', 0);

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
    clearInterval(doneCountdown);
    $('#checkin-form').reset();
    ['in-name','in-company','in-email','in-phone','in-street','in-city','in-state','in-zip']
      .forEach(function (id) { setErr(id, 0); });
    $('#in-state').value = 'FL';
    selectedRole = '';
    $$('#chips-role .chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    $('#btn-submit').disabled = false;
    $('#btn-submit').textContent = 'Check me in';
    $('.form-body').scrollTop = 0;
    show('screen-welcome');
  }

  /* ---------------------------------------------------------------------- */
  /*  Submit                                                                 */
  /* ---------------------------------------------------------------------- */
  function submit(e) {
    e.preventDefault();
    var v = validate();
    if (!v) return;

    /* Someone tapping through twice would burn a second drawing number and
       put a duplicate in the follow-up list. Catch it, but never block them —
       two people can legitimately share a practice inbox. */
    var dupe = Store.rows().filter(function (r) {
      return r.email.toLowerCase() === v.email.toLowerCase();
    }).pop();
    if (dupe) {
      var again = confirm('We already have ' + v.email + ' checked in as ' + dupe.raffle +
                          ' (' + dupe.full_name + ').\n\nCheck in again with a second ' +
                          'drawing number?');
      if (!again) { reset(); return; }
    }

    var btn = $('#btn-submit');
    btn.disabled = true; btn.textContent = 'Saving…';
    disarmIdle();

    var rec;
    try {
      rec = Store.add(v);                        // local write — this is the commit
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Check me in';
      toast('Could not save on this iPad. Get a staff member.');
      console.error(err);
      return;
    }

    // Blur so the iPad keyboard drops before the confirmation animates in.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    $('#ticket-num').textContent  = rec.raffle;
    $('#ticket-name').textContent = rec.full_name;
    $('#ticket').hidden = !CFG.raffle.enabled;
    renderQR(rec.raffle);
    show('screen-done');

    var left = CFG.kiosk.confirmSeconds;
    $('#done-timer').textContent = left;
    clearInterval(doneCountdown);
    doneCountdown = setInterval(function () {
      left--; $('#done-timer').textContent = Math.max(0, left);
      if (left <= 0) { clearInterval(doneCountdown); reset(); }
    }, 1000);
  }

  /* ---------------------------------------------------------------------- */
  /*  QR — generated on-device, so it works with the wifi completely down.   */
  /*  It encodes the RAFFLE NUMBER ONLY. Never put a guest's details in a    */
  /*  URL: they end up in browser history, in referrer headers, and in any   */
  /*  server log along the way.                                              */
  /* ---------------------------------------------------------------------- */
  function renderQR(raffle) {
    var wrap = $('#ticket-qr');
    var base = (CFG.ticketBaseUrl || '').trim();
    var data = base ? base.replace(/#.*$/, '') + '#' + encodeURIComponent(raffle)
                    : CFG.event.brand + ' ' + CFG.event.name + ' — drawing number ' + raffle;
    try {
      var q = qrcode(0, 'M');
      q.addData(data);
      q.make();
      wrap.innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      var svg = wrap.querySelector('svg');
      if (svg) { svg.setAttribute('width', '124'); svg.setAttribute('height', '124'); }
      $('#ticket-qr-wrap').hidden = false;
    } catch (err) {
      console.warn('[qr]', err);
      $('#ticket-qr-wrap').hidden = true;   // number is still on screen, large
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Staff screen                                                           */
  /* ---------------------------------------------------------------------- */
  function renderStaff() {
    var rows = Store.rows();
    var pending = Store.pendingCount();
    $('#staff-letter').textContent = (Store.device() || {}).letter || 'A';
    $('#stat-total').textContent = rows.length;
    /* With no Supabase project configured there is nothing to be synced or
       pending — showing "3 waiting to sync" would imply a queue that will
       drain, and it never will. Say so instead. */
    $('#stat-synced').textContent  = Store.configured() ? (rows.length - pending) : '—';
    $('#stat-pending').textContent = Store.configured() ? pending : '—';

    var sync = $('#staff-sync');
    if (!Store.configured())      sync.innerHTML = '<span class="pill pill-off">Local only — no cloud configured</span>';
    else if (!navigator.onLine)   sync.innerHTML = '<span class="pill pill-wait">Offline — saved here, will sync later</span>';
    else if (pending)             sync.innerHTML = '<span class="pill pill-wait">' + pending + ' waiting to sync</span>';
    else                          sync.innerHTML = '<span class="pill pill-ok">All synced</span>';

    var list = $('#staff-list');
    if (!rows.length) { list.innerHTML = '<p class="staff-empty">No check-ins yet.</p>'; return; }
    var body = rows.slice().reverse().map(function (r) {
      var t = new Date(r.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return '<tr><td class="mono">' + esc(r.raffle) + '</td><td>' + esc(r.full_name) +
             '</td><td>' + esc(r.company) + '</td><td>' + esc(r.email) + '</td><td>' + t +
             '</td><td>' + (r.synced ? '<span class="pill pill-ok">✓</span>'
                                     : '<span class="pill pill-wait">…</span>') + '</td></tr>';
    }).join('');
    list.innerHTML = '<table><thead><tr><th>No.</th><th>Name</th><th>Company</th><th>Email</th>' +
                     '<th>Time</th><th>Sync</th></tr></thead><tbody>' + body + '</tbody></table>';
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
    $('#screen-welcome').addEventListener('click', function (e) {
      if (e.target.closest('#secret-tap')) return;
      startForm();
    });
    $('#btn-start').addEventListener('click', function (e) { e.stopPropagation(); startForm(); });
    $('#btn-cancel').addEventListener('click', reset);
    $('#btn-next').addEventListener('click', reset);
    $('#checkin-form').addEventListener('submit', submit);
    $('#btn-still-here').addEventListener('click', function () { disarmIdle(); armIdle(); });

    // Any touch on the form restarts the idle clock.
    ['input', 'touchstart', 'click'].forEach(function (ev) {
      $('#screen-form').addEventListener(ev, function () {
        if ($('#screen-form').classList.contains('is-active')) armIdle();
      }, { passive: true });
    });

    // Enter moves to the next field rather than submitting halfway down.
    var order = ['in-name','in-company','in-email','in-phone','in-street','in-city','in-state','in-zip'];
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
      e.stopPropagation();
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
      var rows = Store.rows();
      if (!rows.length) { toast('Nothing to export yet.'); return; }
      var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
      download('sportpharm-checkins-' + ((Store.device() || {}).letter || 'A') + '-' +
               d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.csv',
               Store.csv(), 'text/csv;charset=utf-8');
    });
    $('#btn-draw').addEventListener('click', function () {
      var rows = Store.rows();
      if (!rows.length) { toast('No entries yet.'); return; }
      var i = crypto.getRandomValues(new Uint32Array(1))[0] % rows.length;
      var w = rows[i];
      toast('Winner: ' + w.raffle + ' — ' + w.full_name);
    });
    $('#btn-wipe').addEventListener('click', function () {
      var n = Store.rows().length, pending = Store.pendingCount();
      var warn = 'Erase all ' + n + ' check-in' + (n === 1 ? '' : 's') + ' from this iPad?';
      if (pending) warn += '\n\n' + pending + ' have NOT synced to the cloud yet and will be lost. ' +
                          'Download the CSV first.';
      warn += '\n\nThis cannot be undone.';
      if (!confirm(warn)) return;
      if (!confirm('Really erase? Last chance.')) return;
      Store.clearAll(); renderStaff(); toast('Erased.');
    });

    document.addEventListener('spci:sync', function () {
      if ($('#veil-staff').classList.contains('is-active')) renderStaff();
    });

    // ---- first-run setup ----
    $('#btn-setup-save').addEventListener('click', function () {
      var letter = ($('#chips-letter .chip[aria-pressed="true"]') || {}).dataset;
      var pin = $('#setup-pin').value.trim();
      if (!letter || !/^\d{4}$/.test(pin)) { setErr('setup-pin', 1); return; }
      setErr('setup-pin', 0);
      Store.setUpDevice(letter.v, pin).then(function () {
        veil('#veil-setup', false);
        toast('Ready. This is iPad ' + letter.v + '.');
      });
    });
  }

  function startForm() {
    if (!Store.isSetUp()) { veil('#veil-setup', true); return; }
    show('screen-form');
    armIdle();
    setTimeout(function () { $('#in-name').focus(); }, 120);
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
  if (!Store.isSetUp()) veil('#veil-setup', true);
  Store.sync();
})();
