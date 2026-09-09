/* =============================================================================
   store.js — where a check-in actually goes.

   The order matters and is deliberate:

     1. Write to this iPad's localStorage.  Synchronous, cannot fail, needs no
        network. The visitor is confirmed the instant this succeeds.
     2. THEN try Supabase, in the background, retrying forever.

   A lead that only exists if the pharmacy wifi happened to be up is a lead
   you will lose.

   ⚠️ STORAGE KEYS ARE DELIBERATELY DIFFERENT from the grand-opening kiosk's.
   Both kiosks are served from wasabirub.com, and localStorage is shared across
   every path on an origin. With the old keys, an iPad that had run the grand
   opening would show that night's guests on this staff screen and carry on
   its numbering. `sppc-` keeps the two apart.
============================================================================= */
(function () {
  'use strict';

  var CFG      = window.CHECKIN_CONFIG;
  var K_DEVICE = 'sppc-device-v1';    // this iPad's letter
  var K_ROWS   = 'sppc-checkins-v1';  // every check-in taken on this iPad

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

  /* ---------- device identity ------------------------------------------- */
  /* The letter only prefixes an internal reference on the staff screen and in
     the CSV — visitors never see it. Defaults to A; change it on the staff
     screen if a second iPad is ever running. */
  function device() { return read(K_DEVICE, null) || { letter: 'A' }; }

  function setDeviceLetter(letter) {
    write(K_DEVICE, {
      letter: String(letter).toUpperCase().slice(0, 2),
      setAt:  new Date().toISOString()
    });
    return Promise.resolve(true);
  }

  /* ---------- records ---------------------------------------------------- */
  function rows() { return read(K_ROWS, []); }

  /* The table's `raffle` column is NOT NULL — it was the grand opening's claim
     code. Here it is just a per-iPad reference number, kept so the shared
     table stays happy and so a row on the staff screen has a handle. */
  function nextRef() {
    var letter = (device() || {}).letter || 'A';
    var n = rows().length + 1;
    return letter + '-' + String(n).padStart(CFG.codes.padDigits, '0');
  }

  function add(fields) {
    var rec = {
      id:          uuid(),
      raffle:      nextRef(),
      created_at:  new Date().toISOString(),
      device:      (device() || {}).letter || 'A',
      event:       CFG.event.tag || (CFG.event.name + ' — ' + CFG.event.location),
      full_name:   fields.full_name,
      email:       fields.email,
      phone:       fields.phone || '',
      synced:      false             // row exists in the cloud
    };
    var all = rows();
    all.push(rec);
    if (!write(K_ROWS, all)) throw new Error('Could not save on this device.');
    setTimeout(sync, 0);           // background, never blocks the visitor
    return rec;
  }

  /* ---------- Supabase sync ---------------------------------------------- */
  /* Read through a default rather than off CFG directly, so a config edit that
     drops the `supabase` block degrades the kiosk to local-only rather than
     breaking it. */
  function sb() { return (CFG && CFG.supabase) || {}; }
  function configured() { return !!(sb().url && sb().anonKey); }

  function headers() {
    return {
      'apikey':        sb().anonKey,
      'Authorization': 'Bearer ' + sb().anonKey,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    };
  }
  function base() { return sb().url.replace(/\/+$/, '') + '/rest/v1/' + (sb().table || 'checkins'); }

  /* Only the columns this kiosk fills. The rest of the shared table (address,
     role, prize…) is left null, which is exactly what tells the two lists
     apart at a glance. Every row in a batch carries the same keys — PostgREST
     insists on that. */
  var COLS = ['id', 'raffle', 'created_at', 'device', 'event', 'full_name', 'email', 'phone'];
  function payload(r) {
    var o = {};
    COLS.forEach(function (k) { o[k] = r[k] === undefined ? null : r[k]; });
    return o;
  }

  function mark(id, patch) {
    write(K_ROWS, rows().map(function (r) {
      return r.id === id ? Object.assign({}, r, patch) : r;
    }));
  }

  /* A PLAIN insert, deliberately NOT an upsert. See the note in
     supabase/schema.sql: `ON CONFLICT DO UPDATE` needs a SELECT policy under
     RLS, and the only way to give it one is to make the list publicly
     readable. A retry that lands twice comes back 409, which is a success. */
  function insertBatch(batch) {
    return fetch(base(), { method: 'POST', headers: headers(), body: JSON.stringify(batch.map(payload)) })
      .then(function (res) {
        if (res.ok) {
          batch.forEach(function (r) { mark(r.id, { synced: true }); });
          return batch.length;
        }
        /* 409 = at least one row already landed, from a POST whose response we
           never saw. One bad row fails the whole batch, so fall back to one at
           a time and let each answer for itself. */
        if (res.status === 409 && batch.length > 1) return insertOneByOne(batch);
        if (res.status === 409) { mark(batch[0].id, { synced: true }); return 1; }
        return res.text().then(function (t) { throw new Error(res.status + ' ' + t); });
      });
  }

  function insertOneByOne(batch) {
    var done = 0;
    return batch.reduce(function (chain, r) {
      return chain.then(function () {
        return fetch(base(), { method: 'POST', headers: headers(), body: JSON.stringify([payload(r)]) })
          .then(function (res) {
            if (res.ok || res.status === 409) { mark(r.id, { synced: true }); done++; }
          }).catch(function () {});
      });
    }, Promise.resolve()).then(function () { return done; });
  }

  var syncing = false;
  function sync() {
    if (syncing || !configured() || !navigator.onLine) return Promise.resolve(0);
    var toInsert = rows().filter(function (r) { return !r.synced; });
    if (!toInsert.length) return Promise.resolve(0);

    syncing = true;
    return insertBatch(toInsert)
      .then(function (n) {
        document.dispatchEvent(new CustomEvent('sppc:sync', { detail: { sent: n } }));
        return n;
      })
      .catch(function (err) {
        console.warn('[store] sync deferred —', err.message);
        return 0;                            // rows stay pending; we try again later
      })
      .finally(function () { syncing = false; });
  }

  function pendingCount() {
    return rows().filter(function (r) { return !r.synced; }).length;
  }

  /* Retry whenever the network comes back, and on a slow heartbeat. */
  window.addEventListener('online', sync);
  setInterval(sync, 30000);

  /* ---------- export ----------------------------------------------------- */
  function csv() {
    /* checked_in_local is for the human who opens this in Excel; created_at is
       the unambiguous sortable one. Both, because they answer different questions. */
    var cols = ['raffle', 'checked_in_local', 'created_at', 'full_name', 'email', 'phone',
                'device', 'event', 'synced'];
    function cell(v) {
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

  /* Unique addresses, oldest first, for the review-request send. */
  function emails() {
    var seen = {}, out = [];
    rows().forEach(function (r) {
      var k = String(r.email || '').trim().toLowerCase();
      if (!k || seen[k]) return;
      seen[k] = true; out.push(k);
    });
    return out;
  }

  function clearAll() { write(K_ROWS, []); }

  window.Store = {
    setDeviceLetter: setDeviceLetter, device: device,
    add: add, rows: rows, emails: emails,
    sync: sync, pendingCount: pendingCount, configured: configured,
    csv: csv, clearAll: clearAll
  };
})();
