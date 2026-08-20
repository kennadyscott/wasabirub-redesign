/* =============================================================================
   SportPharm Grand Opening — check-in kiosk CONFIG

   ⚠️  THIS FILE IS DOWNLOADED BY EVERY BROWSER THAT OPENS THE KIOSK.
       It is served publicly. It may hold ONLY things that are safe in public.

       SAFE HERE:            event name/date, catalogue-style lists, the
                             Supabase project URL, the Supabase ANON key.
       NEVER PUT HERE:       the Supabase service-role key, any staff PIN,
                             any guest's name / email / address / phone,
                             any Twilio SID or auth token, any email password.

       The anon key is only safe because the table's RLS grants anon INSERT and
       NOTHING ELSE — see supabase/schema.sql. If you ever add a SELECT policy
       for anon, this file becomes a public download of your entire guest list.
       (This is the same mistake logged against SportPharm HQ. Don't repeat it.)
============================================================================= */

window.CHECKIN_CONFIG = {

  /* ---- The event ------------------------------------------------------- */
  event: {
    name:      'Grand Opening',
    brand:     'SportPharm',
    location:  'Florida',              // e.g. 'Fort Lauderdale, FL'
    dateLabel: '',                     // e.g. 'Thursday, October 9' — blank hides it
    // Shown under the headline on the welcome screen.
    welcomeLine: 'Welcome. Check in to be entered in today’s drawing.',
    // Shown on the confirmation screen above the raffle number.
    prizeLine:   'You’re entered in the drawing.'
  },

  /* ---- Raffle ---------------------------------------------------------- */
  raffle: {
    enabled: true,
    // Each iPad gets its own letter at setup so two devices can never both
    // hand out ticket #001. (Same lesson as the order-form reference numbers.)
    padDigits: 3
  },

  /* ---- Ticket page the QR code points at -------------------------------
     Must be an absolute https:// URL once deployed, or phones can't open it.
     Leave blank while developing — the QR then encodes the number as plain
     text, which still scans, it just doesn't open a page.
     The URL carries the RAFFLE NUMBER ONLY. Never add name/email to it.     */
  ticketBaseUrl: 'https://wasabirub.com/checkin/ticket.html',

  /* ---- Supabase sync ---------------------------------------------------
     Fill these in after running supabase/schema.sql. Leave blank and the
     kiosk still works perfectly — it just stays local to the iPad and the
     staff screen will say "Local only".                                     */
  supabase: {
    url:     '',   // e.g. 'https://abcdefgh.supabase.co'
    anonKey: '',   // the anon / publishable key — NOT the service_role key
    table:   'checkins'
  },

  /* ---- Optional fields: flip to false to remove them from the form ------ */
  fields: {
    phone: true,   // needed if you ever want to text the raffle number
    role:  true    // one-tap job title, useful for sales follow-up
  },

  /* Job titles offered as one-tap chips. Order = how they appear. */
  roles: [
    'Athletic Trainer',
    'Physician / DO',
    'PA / NP',
    'Physical Therapist',
    'Chiropractor',
    'Coach',
    'Team / Athletics Staff',
    'Pharmacist',
    'Other'
  ],

  /* ---- Kiosk behaviour -------------------------------------------------- */
  kiosk: {
    confirmSeconds: 25,   // confirmation screen holds this long, then resets
    idleSeconds:    90,   // a part-filled form untouched this long is wiped
    idleWarnSeconds: 15   // countdown shown before the wipe
  }
};
