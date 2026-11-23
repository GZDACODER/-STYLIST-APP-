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
  reports: { label: "Reports", note: "Revenue, no-shows and top clients" },
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
