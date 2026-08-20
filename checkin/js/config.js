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
    // Shown on the confirmation screen, above the wheel.
    prizeLine:   'Give the wheel a spin.'
  },

  /* ---- The hero lockup -------------------------------------------------
     `title` is set in heavy condensed caps; `script` is the brush face that
     rides over the bottom of it. Keep `script` short — one or two words. A
     long string will not fit under the caps and will overrun the page. */
  hero: {
    title:   'Grand',
    script:  'Opening!',
    line1:   'Thank you for joining us!',
    line2:   'Please check in below',
    excited: 'We’re excited to have you here!'
  },

  /* ---- The three perks shown under the form ---------------------------- */
  perks: [
    { icon: 'trophy', title: 'Enter to win',
      body: 'Check in for a chance to win premium recovery products and gear.' },
    { icon: 'team',   title: 'Meet the team',
      body: 'Connect with our pharmacists, recovery specialists, and performance experts.' },
    { icon: 'tag',    title: 'Exclusive offers',
      body: 'One-day-only deals you won’t want to miss.' }
  ],

  /* ---- The dark bar along the bottom ---------------------------------- */
  trust: ['Trusted experts', 'Premium products', 'Evidence based', 'Athlete approved'],

  /* Leave either blank to hide it. FILL THESE IN before the event. */
  venue: {
    address: '',            // e.g. '4180 Bayshore Blvd, Tampa, FL 33611'
    hours:   ''             // e.g. 'Today 10AM – 6PM'
  },

  /* ---- Claim codes ------------------------------------------------------
     Every guest gets one, win or lose. It is what staff look up on the staff
     screen when handing a prize over. Each iPad has its own letter, set at
     first run, so two devices can never both issue code 001. */
  codes: {
    padDigits: 3
  },

  /* ---- THE PRIZE WHEEL --------------------------------------------------

     READ THIS BEFORE CHANGING THE NUMBERS.

     `weight` is the real chance of winning. `slots` is only how many wedges
     the prize occupies on the wheel the guest sees. They are deliberately
     separate: the wheel should look fair and evenly divided while the actual
     odds stay under your control. A guest cannot tell the difference, and
     every prize wheel in the world works this way.

     `stock` is the number you physically brought. When it hits zero that
     prize stops being winnable for the rest of the day — the wedge greys out
     and the odds redistribute across whatever is left. `null` means
     unlimited. ALWAYS set stock on anything you have a finite number of, or
     the wheel will cheerfully promise a tenth bottle of wine when you brought
     six.

     ⚠️ STOCK IS COUNTED PER iPAD, NOT SHARED. Two iPads cannot see each
     other (no server between them), so if you run two, split the real stock
     between them — 6 bottles of wine means stock: 3 on each, not 6 on both.
  */
  wheel: {
    enabled: true,
    spinSeconds: 5.2,          // how long the wheel spins before it settles
    prizes: [
      { id: 'wasabirub', label: 'WasabiRub',        color: '#27865A', weight: 17, slots: 1, stock: null },
      { id: 'icetrarub', label: 'IcetraRub',        color: '#337FA7', weight: 17, slots: 1, stock: null },
      { id: 'superhot',  label: 'Super Hot',        color: '#C85B38', weight: 14, slots: 1, stock: null },
      { id: 'giftcard',  label: 'Gift card',        color: '#C9971F', weight:  9, slots: 1, stock: 20   },
      { id: 'wine',      label: 'Bottle of wine',   color: '#8E1B36', weight:  3, slots: 1, stock: 6    },
      { id: 'none',      label: 'Better luck next time', color: '#98A2AE', weight: 40, slots: 3, stock: null }
    ]
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

  /* Job titles offered in the Role dropdown. Order = how they appear. */
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

  /* ---- Kiosk behaviour --------------------------------------------------
     There is no separate attract screen: the empty form IS the resting state,
     which is why the idle wipe matters. A part-filled form left on a kiosk is
     somebody's home address sitting in public. */
  kiosk: {
    confirmSeconds: 25,   // confirmation screen holds this long, then resets
    idleSeconds:    90,   // a part-filled form untouched this long is wiped
    idleWarnSeconds: 15   // countdown shown before the wipe
  }
};
