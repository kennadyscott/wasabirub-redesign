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
    return letter + '-' + String(n).padStart(CFG.codes.padDigits, '0');
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
      prize:       '',              // set after the wheel stops, not before
      prize_label: '',
      synced:      false,           // row exists in the cloud
      prizeSynced: false            // the prize has reached the cloud too
    };
    var all = rows();
    all.push(rec);
    if (!write(K_ROWS, all)) throw new Error('Could not save on this device.');
    setTimeout(sync, 0);           // background, never blocks the guest
    return rec;
  }

  /* The wheel result lands after the record is already saved, so the prize is
     written back and re-queued. If the row has not reached the cloud yet the
     insert will simply carry the prize with it. */
  function setPrize(id, prizeId, prizeLabel) {
    var all = rows(), hit = false;
    all = all.map(function (r) {
      if (r.id !== id) return r;
      hit = true;
      return Object.assign({}, r, { prize: prizeId, prize_label: prizeLabel, prizeSynced: false });
    });
    if (!hit) return null;
    write(K_ROWS, all);
    setTimeout(sync, 0);
    return true;
  }

  /* ---------- Supabase sync ---------------------------------------------- */
  /* Read through a default rather than off CFG directly. A config edit once
     dropped the whole `supabase` block and this threw on every 30-second sync
     tick — noisy in the console, and it would have silently disabled cloud
     sync at the event. The kiosk must degrade to local-only, never break. */
  function sb() { return (CFG && CFG.supabase) || {}; }
  function configured() { return !!(sb().url && sb().anonKey); }

  function headers(extraPrefer) {
    return {
      'apikey':        sb().anonKey,
      'Authorization': 'Bearer ' + sb().anonKey,
      'Content-Type':  'application/json',
      'Prefer':        extraPrefer || 'return=minimal'
    };
  }
  function base() { return sb().url.replace(/\/+$/, '') + '/rest/v1/' + (sb().table || 'checkins'); }

  /* Strip the local bookkeeping flags — they are not columns. */
  function payload(r) {
    var o = Object.assign({}, r);
    delete o.synced; delete o.prizeSynced;
    return o;
  }

  function mark(id, patch) {
    write(K_ROWS, rows().map(function (r) {
      return r.id === id ? Object.assign({}, r, patch) : r;
    }));
  }

  /* ---- pass 1: insert rows the cloud has never seen ---------------------
     A PLAIN insert, deliberately NOT an upsert. See the note in
     supabase/schema.sql: `ON CONFLICT DO UPDATE` needs a SELECT policy under
     RLS, and the only way to give it one is to make the guest list publicly
     readable. So a duplicate is handled here instead, by asking for it. */
  function insertBatch(batch) {
    return fetch(base(), { method: 'POST', headers: headers(), body: JSON.stringify(batch.map(payload)) })
      .then(function (res) {
        if (res.ok) {
          batch.forEach(function (r) { mark(r.id, { synced: true, prizeSynced: !!r.prize }); });
          return batch.length;
        }
        /* 409 = at least one row already landed, from a POST whose response we
           never saw. One bad row fails the whole batch, so fall back to one at
           a time and let each answer for itself. */
        if (res.status === 409 && batch.length > 1) return insertOneByOne(batch);
        if (res.status === 409) { mark(batch[0].id, { synced: true, prizeSynced: !!batch[0].prize }); return 1; }
        return res.text().then(function (t) { throw new Error(res.status + ' ' + t); });
      });
  }

  function insertOneByOne(batch) {
    var done = 0;
    return batch.reduce(function (chain, r) {
      return chain.then(function () {
        return fetch(base(), { method: 'POST', headers: headers(), body: JSON.stringify([payload(r)]) })
          .then(function (res) {
            // 409 means it is already there — that is a success, not a failure.
            if (res.ok || res.status === 409) { mark(r.id, { synced: true, prizeSynced: !!r.prize }); done++; }
          }).catch(function () {});
      });
    }, Promise.resolve()).then(function () { return done; });
  }

  /* ---- pass 2: attach prizes to rows already in the cloud ---------------- */
  function patchPrizes(list) {
    return list.reduce(function (chain, r) {
      return chain.then(function () {
        return fetch(base() + '?id=eq.' + encodeURIComponent(r.id), {
          method: 'PATCH', headers: headers(),
          body: JSON.stringify({ prize: r.prize, prize_label: r.prize_label })
        }).then(function (res) {
          if (res.ok) mark(r.id, { prizeSynced: true });
        }).catch(function () {});
      });
    }, Promise.resolve());
  }

  var syncing = false;
  function sync() {
    if (syncing || !configured() || !navigator.onLine) return Promise.resolve(0);
    var toInsert = rows().filter(function (r) { return !r.synced; });
    var toPatch  = rows().filter(function (r) { return r.synced && r.prize && !r.prizeSynced; });
    if (!toInsert.length && !toPatch.length) return Promise.resolve(0);

    syncing = true;
    return (toInsert.length ? insertBatch(toInsert) : Promise.resolve(0))
      .then(function (n) {
        // Re-read: pass 1 may have just made more rows eligible for a patch.
        var now = rows().filter(function (r) { return r.synced && r.prize && !r.prizeSynced; });
        return patchPrizes(now).then(function () { return n; });
      })
      .then(function (n) {
        document.dispatchEvent(new CustomEvent('spci:sync', { detail: { sent: n } }));
        return n;
      })
      .catch(function (err) {
        console.warn('[store] sync deferred —', err.message);
        return 0;                            // rows stay pending; we try again later
      })
      .finally(function () { syncing = false; });
  }

  function pendingCount() {
    return rows().filter(function (r) {
      return !r.synced || (r.prize && !r.prizeSynced);
    }).length;
  }

  /* Retry whenever the network comes back, and on a slow heartbeat. */
  window.addEventListener('online', sync);
  setInterval(sync, 30000);

  /* ---------- export ----------------------------------------------------- */
  function csv() {
    /* checked_in_local is for the human who opens this in Excel; created_at is
       the unambiguous sortable one. Both, because they answer different questions. */
    var cols = ['raffle', 'checked_in_local', 'created_at', 'full_name', 'company', 'role',
                'email', 'phone', 'street', 'city', 'state', 'zip',
                'prize_label', 'prize', 'device', 'event', 'synced'];
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
    add: add, setPrize: setPrize, rows: rows, nextRaffleNumber: nextRaffleNumber,
    sync: sync, pendingCount: pendingCount, configured: configured,
    csv: csv, clearAll: clearAll
  };
})();
