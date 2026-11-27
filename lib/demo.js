// The public demo (clientelesuite.com/demo): one shared sample salon that
// anyone can open without a password. It shows the example data on every
// tab, its booking page has real sample services and openings, and it's
// reset every night (demo_reset() in supabase/migrations/0054_demo.sql).
// Things that would let one visitor lock others out, touch money, upload
// pictures or run up costs are switched off for it (DEMO_LOCKED), and no
// email is ever sent to its address.
export const DEMO_EMAIL = "demo@clientelesuite.com";
export const DEMO_BUSINESS = "Maison Demo";

// One sample account per business type. "hair" is the public demo; the
// others are opened by the owner from the Control Room ("Preview as...").
export const DEMO_ACCOUNTS = {
  hair: { email: DEMO_EMAIL, name: DEMO_BUSINESS, tagline: "Silk presses, braids, color and lashes" },
  barber: { email: "demo-barber@clientelesuite.com", name: "Demo Barber", tagline: "Fades, lineups and beard work" },
  tattoo: { email: "demo-tattoo@clientelesuite.com", name: "Demo Tattoo", tagline: "Custom pieces, flash and consultations" },
  tutor: { email: "demo-tutor@clientelesuite.com", name: "Demo Tutor", tagline: "Math, reading and test prep, online or in person" },
};
const DEMO_EMAILS = new Set(Object.values(DEMO_ACCOUNTS).map((a) => a.email));

export const isDemoEmail = (email) => DEMO_EMAILS.has(String(email || "").toLowerCase());
export const isDemo = (user) => isDemoEmail(user?.email);

export const DEMO_LOCKED =
  "This is the demo salon, so this part is switched off. Start your own free trial to use it.";

// The demo's booking page (its link is "maison-demo-" and 6 letters/digits).
// Booking and the waitlist are off there, so no visitor's real name, phone
// or email ends up in the shared demo dashboard.
// Sample pages made to show a prospect what their own page could look
// like ("sample-" + a name + 6 letters/digits) work the same way.
export const isSampleSlug = (slug) => /^sample-[a-z0-9-]{1,40}-[0-9a-f]{6}$/i.test(String(slug || ""));
export const isDemoSlug = (slug) =>
  /^(maison-demo|demo-barber|demo-tattoo|demo-tutor)-[0-9a-f]{6}$/i.test(String(slug || "")) || isSampleSlug(slug);

export const DEMO_BOOKING_OFF =
  "This is a demo booking page, so booking is switched off here. Everything else works just like a real one.";
