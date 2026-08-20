/* =============================================================================
   store.js — where a check-in actually goes.

   The order matters and is deliberate:

     1. Write to this iPad's localStorage.  Synchronous, cannot fail, needs no
        network. The guest is confirmed the instant this succeeds.
     2. THEN try Supabase, in the background, retrying forever.

   That ordering is the whole point of the design. Venue wifi at a grand
   opening is not to be trusted, and a lead that only exists if the network
   happened to be up is a lead you will lose.
============================================================================= */
(function () {
  'use strict';

  var CFG      = window.CHECKIN_CONFIG;
  var K_DEVICE = 'spci-device-v1';    // this iPad's letter + staff PIN hash
  var K_ROWS   = 'spci-checkins-v1';  // every check-in taken on this iPad

  /* ---------- tiny helpers ---------------------------------------------- */
  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.error('[store] write failed', e); return false; }
  }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* PIN hashing. Note this is NOT a security boundary against a determined
     attacker — it is a "guest who found the staff screen" boundary. The real
     protection is that the PIN is chosen on the device and never ships in the
     bundle, so there is no shared passcode to leak. */
  function hashPin(pin) {
    var salted = 'spci:' + pin;
    if (window.crypto && crypto.subtle && window.isSecureContext) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted))
        .then(function (buf) {
          return Array.from(new Uint8Array(buf))
            .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        });
    }
    // http:// dev fallback — crypto.subtle is unavailable outside secure contexts.
    var h = 0;
    for (var i = 0; i < salted.length; i++) { h = (h * 31 + salted.charCodeAt(i)) | 0; }
    return Promise.resolve('weak:' + (h >>> 0).toString(16));
  }

  /* ---------- device identity ------------------------------------------- */
  function device()          { return read(K_DEVICE, null); }
  function isSetUp()         { var d = device(); return !!(d && d.letter && d.pinHash); }
  function setUpDevice(letter, pin) {
    return hashPin(pin).then(function (pinHash) {
      write(K_DEVICE, { letter: String(letter).toUpperCase().slice(0, 2), pinHash: pinHash, setAt: new Date().toISOString() });
      return true;
    });
  }
  function checkPin(pin) {
    var d = device();
    if (!d) return Promise.resolve(false);
    return hashPin(pin).then(function (h) { return h === d.pinHash; });
  }

  /* ---------- records ---------------------------------------------------- */
  function rows() { return read(K_ROWS, []); }

  function nextRaffleNumber() {
    var d = device();
    var letter = (d && d.letter) || 'A';
    var n = rows().length + 1;
    return letter + '-' + String(n).padStart(CFG.raffle.padDigits, '0');
  }

  /* Add a check-in. Returns the saved record synchronously-ish (via promise)
     so the UI can show the raffle number immediately. Sync is fire-and-forget. */
  function add(fields) {
    var rec = {
      id:          uuid(),
      raffle:      nextRaffleNumber(),
      created_at:  new Date().toISOString(),
      device:      (device() || {}).letter || 'A',
      event:       CFG.event.name + ' — ' + CFG.event.location,
      full_name:   fields.full_name,
      company:     fields.company,
      email:       fields.email,
      phone:       fields.phone || '',
      street:      fields.street,
      city:        fields.city,
      state:       fields.state,
      zip:         fields.zip,
      role:        fields.role || '',
      synced:      false
    };
    var all = rows();
    all.push(rec);
    if (!write(K_ROWS, all)) throw new Error('Could not save on this device.');
    setTimeout(sync, 0);           // background, never blocks the guest
    return rec;
  }

  /* ---------- Supabase sync ---------------------------------------------- */
  function configured() { return !!(CFG.supabase.url && CFG.supabase.anonKey); }

  var syncing = false;
  function sync() {
    if (syncing || !configured() || !navigator.onLine) return Promise.resolve(0);
    var pending = rows().filter(function (r) { return !r.synced; });
    if (!pending.length) return Promise.resolve(0);

    syncing = true;
    var base = CFG.supabase.url.replace(/\/+$/, '');
    var body = pending.map(function (r) {
      var o = Object.assign({}, r);
      delete o.synced;                       // local bookkeeping, not a column
      return o;
    });

    /* on_conflict=id + ignore-duplicates makes a retry after a timeout safe:
       a row that actually landed the first time is not inserted twice. */
    return fetch(base + '/rest/v1/' + CFG.supabase.table + '?on_conflict=id', {
      method: 'POST',
      headers: {
        'apikey':        CFG.supabase.anonKey,
        'Authorization': 'Bearer ' + CFG.supabase.anonKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal,resolution=ignore-duplicates'
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + ' ' + t); });
      var ids = {};
      pending.forEach(function (r) { ids[r.id] = true; });
      var all = rows().map(function (r) { return ids[r.id] ? Object.assign({}, r, { synced: true }) : r; });
      write(K_ROWS, all);
      document.dispatchEvent(new CustomEvent('spci:sync', { detail: { sent: pending.length } }));
      return pending.length;
    }).catch(function (err) {
      console.warn('[store] sync deferred —', err.message);
      return 0;                              // rows stay pending; we try again later
    }).finally(function () { syncing = false; });
  }

  function pendingCount() { return rows().filter(function (r) { return !r.synced; }).length; }

  /* Retry whenever the network comes back, and on a slow heartbeat. */
  window.addEventListener('online', sync);
  setInterval(sync, 30000);

  /* ---------- export ----------------------------------------------------- */
  function csv() {
    /* checked_in_local is for the human who opens this in Excel; created_at is
       the unambiguous sortable one. Both, because they answer different questions. */
    var cols = ['raffle', 'checked_in_local', 'created_at', 'full_name', 'company', 'role',
                'email', 'phone', 'street', 'city', 'state', 'zip',
                'device', 'event', 'synced'];
    function cell(v) {
      if (Array.isArray(v)) v = v.join('; ');
      v = (v === null || v === undefined) ? '' : String(v);
      /* Guard against CSV formula injection — a name beginning = + - @ is
         executed by Excel on open. Prefixing an apostrophe defuses it. */
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return '"' + v.replace(/"/g, '""') + '"';
    }
    var lines = [cols.join(',')];
    rows().forEach(function (r) {
      var row = Object.assign({}, r);
      row.checked_in_local = new Date(r.created_at).toLocaleString();
      lines.push(cols.map(function (c) { return cell(row[c]); }).join(','));
    });
    return '﻿' + lines.join('\r\n');    // BOM so Excel reads UTF-8 names correctly
  }

  function clearAll() { write(K_ROWS, []); }

  window.Store = {
    isSetUp: isSetUp, setUpDevice: setUpDevice, checkPin: checkPin, device: device,
    add: add, rows: rows, nextRaffleNumber: nextRaffleNumber,
    sync: sync, pendingCount: pendingCount, configured: configured,
    csv: csv, clearAll: clearAll
  };
})();
