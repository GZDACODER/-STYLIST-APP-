// Business-type templates. One app and one booking engine; each template
// sets the words, presets (example services, intake form, aftercare),
// which tabs and features show, and Home's cards. The pro's own choices
// (stylists.modules) override the template's modules.
//
// stylists.business_type keeps its existing values: "", "hair", "nails",
// "lashes" and "other" all use the Stylist template, so existing accounts
// don't change. To add a type: write lib/templates/<type>.js with only what
// differs from stylist.js, then add it to TEMPLATES and TYPE_TO_TEMPLATE.
import { stylist } from "./stylist";
import { barber } from "./barber";
import { tattoo } from "./tattoo";
import { tutor } from "./tutor";

const merge = (base, t) => ({
  ...base,
  ...t,
  vocab: { ...base.vocab, ...(t.vocab || {}) },
  modules: { ...base.modules, ...(t.modules || {}) },
  presets: { ...base.presets, ...(t.presets || {}) },
});

export const TEMPLATES = {
  stylist,
  barber: merge(stylist, barber),
  tattoo: merge(stylist, tattoo),
  tutor: merge(stylist, tutor),
};

// business_type value -> template key.
const TYPE_TO_TEMPLATE = { "": "stylist", hair: "stylist", nails: "stylist", lashes: "stylist", other: "stylist", barber: "barber", tattoo: "tattoo", tutor: "tutor" };

// The choices on sign-up and in Settings (value = what's saved).
export const TYPE_CHOICES = [
  { value: "hair", template: "stylist" },
  { value: "barber", template: "barber" },
  { value: "tattoo", template: "tattoo" },
  { value: "tutor", template: "tutor" },
].map((c) => ({ ...c, label: TEMPLATES[c.template].label, blurb: TEMPLATES[c.template].blurb }));

export const COMING_SOON = ["Nails", "Lashes & brows", "Makeup", "Massage & esthetics", "Cleaning", "Landscaping", "Car rental"];

export const MODULE_LABELS = {
  regulars: { label: "Regulars", note: "Regulars-only times and first pick of openings" },
  waitlist: { label: "Waitlist", note: "Clients join a list and get offered cancellations" },
  deposits: { label: "Deposits", note: "Take a deposit when someone books" },
  aftercare: { label: "Aftercare tips", note: "Emailed after each visit" },
  myLook: { label: "My look", note: "A photo and notes shared with the client after a visit" },
  bookMyUsual: { label: "Book my usual", note: "One tap to rebook the same service" },
  standing: { label: "Standing appointments", note: "A repeating booking, like every 2 weeks" },
  intake: { label: "Intake form", note: "Questions and a waiver before the first booking" },
  portfolio: { label: "Portfolio", note: "Photos of your work on your booking page" },
  birthday: { label: "Birthday treat", note: "Clients add a birthday and get your treat" },
  reports: { label: "Insights", note: "Rebooking, busy times, no-shows, top services" },
  requests: { label: "Booking requests", note: "Clients send an idea and photos; you approve before they book" },
  bookingPhotos: { label: "Photos at booking", note: "Clients can add inspiration or reference photos when they book" },
  projects: { label: "Projects", note: "Group the sessions of a multi-session piece, like a sleeve" },
  healing: { label: "Healing check-ins", note: "Emails on day 1, 3 and 14 after a session" },
  packages: { label: "Packages", note: "Prepaid bundles of sessions that count down as they're used" },
  parentNotes: { label: "Parent notes", note: "A parent or guardian on each card, emailed a note after each session" },
};

export function templateKeyFor(businessType) {
  return TYPE_TO_TEMPLATE[String(businessType || "")] || "stylist";
}

// The template for a pro: { ...template, modules (with their own choices) }.
export function templateFor(businessType, moduleOverrides = null) {
  const t = TEMPLATES[templateKeyFor(businessType)];
  const modules = { ...t.modules };
  if (moduleOverrides && typeof moduleOverrides === "object") {
    for (const [k, v] of Object.entries(moduleOverrides)) if (k in modules) modules[k] = Boolean(v);
  }
  return { ...t, modules, words: words(t.vocab) };
}

// Words in every form a page needs: words.clients = "clients",
// words.Clients = "Clients", words.aClient = "a client".
function words(v) {
  const out = {};
  for (const [k, w] of Object.entries(v)) {
    out[k] = w;
    out[k[0].toUpperCase() + k.slice(1)] = w[0].toUpperCase() + w.slice(1);
  }
  const an = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");
  out.aClient = `${an(v.client)} ${v.client}`;
  out.anAppointment = `${an(v.appointment)} ${v.appointment}`;
  out.aService = `${an(v.service)} ${v.service}`;
  return out;
}

// Swaps the Stylist words in a sentence for the template's
// ("Add a client" -> "Add a student" for a tutor). Whole words only, keeps
// capitals; "a"/"an" before a swapped word follows the new word. For the
// Stylist template it returns the text unchanged.
const SWAPS = ["clients", "client", "appointments", "appointment", "services", "service", "stylists", "stylist", "visits", "visit"];
const KEY = { clients: "clients", client: "client", appointments: "appointments", appointment: "appointment", services: "services", service: "service", stylists: "pro", stylist: "pro", visits: "visits", visit: "visit" };

export function swapWords(text, words) {
  if (typeof text !== "string" || !words) return text;
  const changed = SWAPS.filter((w) => words[KEY[w]] && words[KEY[w]] !== (w === "stylists" ? "stylists" : w === "stylist" ? "stylist" : w));
  if (!changed.length) return text;
  const re = new RegExp(`\\b(an?\\s+)?(${changed.join("|")})\\b`, "gi");
  return text.replace(re, (m, article, word) => {
    const lower = word.toLowerCase();
    let to = words[KEY[lower]];
    if (lower === "stylists") to = `${to}s`;
    if (word[0] === word[0].toUpperCase()) to = to[0].toUpperCase() + to.slice(1);
    if (!article) return to;
    const an = /^[aeiou]/i.test(to) ? "an" : "a";
    const art = article.trim()[0] === "A" ? an[0].toUpperCase() + an.slice(1) : an;
    return `${art} ${to}`;
  });
}
