/* =============================================================================
   The two forms.

   Both post to one edge function (supabase/functions/rsvp), which writes the
   row with the service role, emails the person, and tells the team. Nothing
   here holds a key: the page is public, so it gets no database credentials at
   all — a change from the check-in kiosk, which needed to work offline and so
   carried the anon key.

   Validation is deliberately gentle. A wellness event RSVP is not a form worth
   fighting with: name and a valid-looking email, everything else optional.
============================================================================= */
(function () {
  'use strict';

  var ENDPOINT = 'https://aihxmysugxnzxwvowqth.supabase.co/functions/v1/rsvp';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function setErr(id, on) {
    var el = $('#' + id);
    if (!el) return;
    var field = el.closest('.field');
    if (field) field.classList.toggle('is-bad', !!on);
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function emailLooksReal(s) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s || '').trim()); }

  function wire(opts) {
    var form = $(opts.form), btn = $(opts.button), errBox = $(opts.error);
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.hidden = true;

      var data = {};
      opts.fields.forEach(function (f) { data[f.key] = (($(f.id) || {}).value || '').trim(); });
      if (opts.checkbox) data.updates = $(opts.checkbox).checked;
      data.website = (($(opts.trap) || {}).value || '');   // honeypot, must stay empty

      var bad = [];
      opts.fields.forEach(function (f) {
        var v = data[f.key], wrong = false;
        if (f.required && v.length < 2) wrong = true;
        if (f.type === 'email' && !emailLooksReal(v)) wrong = true;
        if (f.type === 'phone' && v && digits(v).length !== 10) wrong = true;
        setErr(f.id.slice(1), wrong);
        if (wrong) bad.push(f.id);
      });
      if (bad.length) {
        var first = $(bad[0]);
        first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        first.focus({ preventScroll: true });
        return;
      }

      var label = btn.querySelector('span');
      var original = label.textContent;
      btn.disabled = true; label.textContent = 'Sending…';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ kind: opts.kind }, data)),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.body && res.body.error) || 'Something went wrong.');
          form.hidden = true;
          $(opts.done).hidden = false;
          if (opts.doneSub && res.body.emailed === false) {
            /* Be honest when the confirmation could not be sent: the RSVP is
               safely recorded either way, and they should not sit waiting for
               an email that is not coming. */
            $(opts.doneSub).textContent = 'You’re on the list for November 7. We couldn’t send your confirmation email, so please double-check your address with us at the event.';
          }
          $(opts.done).scrollIntoView({ block: 'center', behavior: 'smooth' });
        })
        .catch(function (err) {
          btn.disabled = false; label.textContent = original;
          errBox.textContent = err.message === 'Failed to fetch'
            ? 'We couldn’t reach the server. Check your connection and try again.'
            : err.message;
          errBox.hidden = false;
        });
    });
  }

  wire({
    kind: 'attendee',
    form: '#form-rsvp', button: '#r-submit', error: '#r-error',
    done: '#r-done', doneSub: '#r-done-sub', checkbox: '#r-updates', trap: '#r-company-url',
    fields: [
      { id: '#r-name',   key: 'name',   required: true },
      { id: '#r-email',  key: 'email',  required: true, type: 'email' },
      { id: '#r-phone',  key: 'phone',  type: 'phone' },
      { id: '#r-guests', key: 'guests' },
    ],
  });

  wire({
    kind: 'vendor',
    form: '#form-vendor', button: '#v-submit', error: '#v-error',
    done: '#v-done', trap: '#v-fax',
    fields: [
      { id: '#v-business', key: 'business', required: true },
      { id: '#v-name',     key: 'name',     required: true },
      { id: '#v-email',    key: 'email',    required: true, type: 'email' },
      { id: '#v-phone',    key: 'phone',    type: 'phone' },
      { id: '#v-site',     key: 'site' },
      { id: '#v-offer',    key: 'offer' },
    ],
  });
})();
