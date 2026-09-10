/* =============================================================================
   SportPharm pharmacy visitor check-in — CONFIG

   ⚠️  THIS FILE IS DOWNLOADED BY EVERY BROWSER THAT OPENS THE KIOSK.
       It is served publicly. It may hold ONLY things that are safe in public.

       SAFE HERE:      event name/location, copy, the Supabase project URL,
                       the Supabase ANON key.
       NEVER HERE:     the service_role key, any visitor's details.

       The anon key is only safe because the table's RLS grants anon INSERT and
       a narrow UPDATE, and NOTHING ELSE — see supabase/schema.sql. Add a SELECT
       policy for anon and this file becomes a public download of the whole
       visitor list.

   ⚠️  DO NOT ADD A "REASON FOR VISIT" FIELD, or anything like it.
       This is a pharmacy. The moment a record says why someone came in, or
       what they collected, an ordinary marketing list becomes health
       information — and this stack has no BAA and is served from a public
       repo. Name and email are deliberately all this asks for.
============================================================================= */

window.CHECKIN_CONFIG = {

  event: {
    name:      'Pharmacy Visit',
    brand:     'SportPharm',
    location:  'Fort Lauderdale, FL',

    /* Stamped on every record so these rows filter cleanly apart from the
       grand-opening ones in the same table. */
    tag: 'Pharmacy Visit — Fort Lauderdale, FL',

    closingLine: 'Have a great day!'
  },

  /* ---- The headline. Type, not artwork — swap in a graphic later by
     setting hero.image the way the grand-opening kiosk does. ------------- */
  hero: {
    line1:   'Thanks for',
    line2:   'stopping by',
    sub:     'Leave your details below and we’ll be in touch.',
    excited: 'It’s good to see you.'
  },

  /* ---- What the visitor is actually agreeing to. Say it plainly on the
     form rather than burying it — they are being asked for an email so we
     can ask them for a review. ------------------------------------------- */
  consentLine: 'We’ll email you once to ask how we did. Untick the box if you’d ' +
               'rather not hear about SportPharm news and offers. We don’t sell ' +
               'your information, and every email has an unsubscribe link.',

  /* ---- The email-updates box. Ticked by default — the client asked for
     that. The visitor's answer is stored as `email_opt_in` on the row. ----- */
  optIn: {
    label:          'Yes, email me SportPharm updates and offers',
    defaultChecked: true
  },

  /* ---- Optional fields: flip to false to remove them from the form ------ */
  fields: {
    phone: true
  },

  /* ---- Internal reference codes ---------------------------------------- */
  codes: { padDigits: 3 },

  /* ---- Supabase --------------------------------------------------------
     The SAME project and table as the grand-opening kiosk. Rows are told
     apart by the `event` column, which carries event.tag above. */
  supabase: {
    url:     'https://aihxmysugxnzxwvowqth.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaHhteXN1Z3huenh3dm93cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTAxMTMsImV4cCI6MjEwMjgyNjExM30.zAUSPfjXHNA4X5RIX_hSIuJs63MPyG0KRrV6rxfLXYE',
    table:   'checkins'
  },

  /* ---- Kiosk behaviour --------------------------------------------------
     There is no attract screen: the EMPTY FORM is the resting state, which is
     why the idle wipe matters. A part-filled form left on a counter is
     somebody's contact details sitting in public. */
  kiosk: {
    confirmSeconds:  6,    // thank-you holds this long, then resets. 0 = wait for a tap.
    idleSeconds:     60,   // a part-filled form untouched this long is wiped
    idleWarnSeconds: 12
  }
};
