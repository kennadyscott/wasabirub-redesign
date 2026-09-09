/* =============================================================================
   checkin.js — the pharmacy visitor kiosk.

   Two screens: the check-in form, and a short thank-you. There is no attract
   screen — the EMPTY FORM is the resting state, which is why the idle wipe
   matters. A part-filled form left on a counter is somebody's contact details
   sitting in public.

   Deliberately NOT here, compared with the grand-opening kiosk it was forked
   from: the prize wheel, the home address, the role dropdown, and any notion
   of WHY the person came in. Name, email, optional mobile. That's the lot.
============================================================================= */
(function () {
  'use strict';

  var CFG = window.CHECKIN_CONFIG;
  var $   = function (s, r) { return (r || document).querySelector(s); };
  var $$  = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var FIELDS = ['in-name', 'in-email', 'in-phone'];
  var idleTimer = null, idleCountdown = null, doneCountdown = null;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function show(id) { $$('.screen').forEach(function (s) { s.classList.toggle('is-active', s.id === id); }); }
  function veil(id, on) { $(id).classList.toggle('is-active', on !== false); }

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('is-on'); }, 2800);
  }

  /* ---------------------------------------------------------------------- */
  /*  Build the page from config                                             */
  /* ---------------------------------------------------------------------- */
  function build() {
    document.title = 'Check In — ' + CFG.event.brand;

    $('#h-line1').textContent = CFG.hero.line1;
    $('#h-line2').textContent = CFG.hero.line2;
    $('#h-sub').textContent   = CFG.hero.sub || '';
    $('#excited').textContent = CFG.hero.excited || '';
    $('#consent').textContent = CFG.consentLine || '';
    $('#closing').textContent = CFG.event.closingLine || '';

    $('#wrap-phone').hidden = !CFG.fields.phone;

    /* Only relevant if a second iPad is running, so it lives on the staff
       screen rather than in front of the team on first launch. */
    var cur = (Store.device() || {}).letter || 'A';
    $('#chips-letter').innerHTML = ['A', 'B', 'C', 'D'].map(function (l) {
      return '<button type="button" class="lchip" aria-pressed="' + (l === cur) + '" data-v="' + l + '">' + l + '</button>';
    }).join('');
    $('#chips-letter').addEventListener('click', function (e) {
      var b = e.target.closest('.lchip'); if (!b) return;
      $$('.lchip', this).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      Store.setDeviceLetter(b.dataset.v).then(function () {
        renderStaff();
        toast('This is iPad ' + b.dataset.v + '. Check-ins already taken keep their old reference.');
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  Idle wipe                                                              */
  /* ---------------------------------------------------------------------- */
  function isDirty() {
    return FIELDS.some(function (id) { var e = $('#' + id); return e && e.value.trim(); });
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
      email:     $('#in-email').value.trim(),
      phone:     CFG.fields.phone ? $('#in-phone').value.trim() : ''
    };
    var bad = [];
    if (v.full_name.length < 2)                         { setErr('in-name', 1);  bad.push('in-name'); }  else setErr('in-name', 0);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.email)) { setErr('in-email', 1); bad.push('in-email'); } else setErr('in-email', 0);
    if (v.phone && digits(v.phone).length !== 10)       { setErr('in-phone', 1); bad.push('in-phone'); } else setErr('in-phone', 0);

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
    $('#checkin-form').reset();
    FIELDS.forEach(function (id) { setErr(id, 0); });
    $('#btn-submit').disabled = false;
    $('#btn-submit').querySelector('span').textContent = 'Check in';
    show('screen-form');
    window.scrollTo(0, 0);
    armIdle();
  }

  /* ---------------------------------------------------------------------- */
  /*  Submit                                                                 */
  /* ---------------------------------------------------------------------- */
  function sameDay(iso) {
    var a = new Date(iso), b = new Date();
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function submit(e) {
    e.preventDefault();
    var v = validate();
    if (!v) return;

    /* A regular who comes back next week is a NEW visit and should check in
       again without being questioned. The only duplicate worth catching is the
       same email twice TODAY — almost always a double tap, and it would earn
       them two review-request emails. */
    var dupe = Store.rows().filter(function (r) {
      return r.email.toLowerCase() === v.email.toLowerCase() && sameDay(r.created_at);
    }).pop();
    if (dupe) {
      var again = confirm(v.email + ' has already checked in today (' + dupe.full_name + ').\n\nCheck in again?');
      if (!again) { reset(); return; }
    }

    var btn = $('#btn-submit');
    btn.disabled = true; btn.querySelector('span').textContent = 'Saving…';
    disarmIdle();

    try {
      Store.add(v);                       // local write — this is the commit
    } catch (err) {
      btn.disabled = false; btn.querySelector('span').textContent = 'Check in';
      toast('Could not save on this iPad. Get a team member.');
      console.error(err);
      return;
    }

    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    show('screen-done');
    window.scrollTo(0, 0);

    /* The thank-you holds for confirmSeconds, then quietly resets for the next
       visitor. 0 = wait for the button. Nothing personal is on that screen. */
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

    var body = rows.slice().reverse().map(function (r) {
      var d = new Date(r.created_at);
      var t = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
              d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return '<tr><td class="mono">' + esc(r.raffle) + '</td><td>' + esc(r.full_name) +
             '</td><td>' + esc(r.email) + '</td><td>' + esc(r.phone || '—') + '</td><td>' + t +
             '</td><td>' + (r.synced ? '<span class="pill pill-ok">✓</span>'
                                     : '<span class="pill pill-wait">…</span>') + '</td></tr>';
    }).join('');
    list.innerHTML = '<table><thead><tr><th>Ref</th><th>Name</th><th>Email</th><th>Mobile</th>' +
                     '<th>When</th><th>Sync</th></tr></thead><tbody>' + body + '</tbody></table>';
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url  = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function stamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  /* ---------------------------------------------------------------------- */
  /*  Wire up                                                                */
  /* ---------------------------------------------------------------------- */
  function wire() {
    $('#checkin-form').addEventListener('submit', submit);
    $('#btn-next').addEventListener('click', reset);
    $('#btn-still-here').addEventListener('click', function () { disarmIdle(); armIdle(); });

    ['input', 'touchstart', 'click'].forEach(function (ev) {
      $('#screen-form').addEventListener(ev, function () {
        if ($('#screen-form').classList.contains('is-active')) armIdle();
      }, { passive: true });
    });

    // Enter moves to the next field rather than submitting halfway down.
    FIELDS.forEach(function (id, i) {
      var el = $('#' + id); if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        for (var j = i + 1; j < FIELDS.length; j++) {
          var n = $('#' + FIELDS[j]);
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
        renderStaff();
        veil('#veil-staff', true);
      }
    });

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
      download('sportpharm-pharmacy-checkins-' + ((Store.device() || {}).letter || 'A') + '-' + stamp() + '.csv',
               Store.csv(), 'text/csv;charset=utf-8');
    });

    /* The whole point of the form is the follow-up email, so make the list of
       addresses one tap away. Clipboard needs a secure context and a user
       gesture — both true here — but fall back to a text file if it refuses. */
    $('#btn-copy-emails').addEventListener('click', function () {
      var list = Store.emails();
      if (!list.length) { toast('No emails yet.'); return; }
      var text = list.join('\n');
      var fallback = function () {
        download('sportpharm-pharmacy-emails-' + stamp() + '.txt', text, 'text/plain;charset=utf-8');
        toast('Saved ' + list.length + ' email' + (list.length === 1 ? '' : 's') + ' as a file.');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          toast('Copied ' + list.length + ' email' + (list.length === 1 ? '' : 's') + '.');
        }).catch(fallback);
      } else fallback();
    });

    $('#btn-wipe').addEventListener('click', function () {
      var n = Store.rows().length, pending = Store.pendingCount();
      var warn = 'Erase all ' + n + ' check-in' + (n === 1 ? '' : 's') + ' from this iPad?';
      if (pending) {
        warn += '\n\n⚠️ ' + pending + ' have NOT reached the cloud yet and exist ' +
                'ONLY on this iPad. They will be lost for good. Download the CSV first.';
      } else if (Store.configured()) {
        warn += '\n\nThese are all synced, so they remain in Supabase — this clears ' +
                'the copy on this iPad only.';
      }
      warn += '\n\nThis cannot be undone.';
      if (!confirm(warn)) return;
      if (!confirm('Really erase? Last chance.')) return;
      Store.clearAll(); renderStaff(); toast('Erased.');
    });

    document.addEventListener('sppc:sync', function () {
      if ($('#veil-staff').classList.contains('is-active')) renderStaff();
    });
  }

  /* Keep the screen awake between visitors. iOS 16.4+ honours this; on older
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
  armIdle();
  Store.sync();
})();
