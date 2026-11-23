// The public demo (clientelesuite.com/demo): one shared sample salon that
// anyone can open without a password. It shows the example data on every
// tab, its booking page has real sample services and openings, and it's
// reset every night (demo_reset() in supabase/migrations/0054_demo.sql).
// Things that would let one visitor lock others out, touch money, upload
// pictures or run up costs are switched off for it (DEMO_LOCKED), and no
// email is ever sent to its address.
export const DEMO_EMAIL = "demo@clientelesuite.com";
export const DEMO_BUSINESS = "Maison Demo";

export const isDemo = (user) => String(user?.email || "").toLowerCase() === DEMO_EMAIL;

export const DEMO_LOCKED =
  "This is the demo salon, so this part is switched off. Start your own free trial to use it.";

// The demo's booking page (its link is "maison-demo-" and 6 letters/digits).
// Booking and the waitlist are off there, so no visitor's real name, phone
// or email ends up in the shared demo dashboard.
export const isDemoSlug = (slug) => /^maison-demo-[0-9a-f]{6}$/i.test(String(slug || ""));

export const DEMO_BOOKING_OFF =
  "This is the demo salon's booking page, so booking is switched off here. Everything else works just like a real one.";
