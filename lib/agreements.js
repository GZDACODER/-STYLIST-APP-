// Signed agreements, layer 1: the Clientele agreement every pro signs
// (supabase/migrations/0058_agreements.sql). Server and client safe (no
// secrets here); the PDF maker is in lib/agreementPdf.js.
//
// NOTE FOR LAUNCH: the Terms of Service, Privacy Policy, this summary and
// the starter client waivers are templates written in plain English. A
// lawyer must review them before launch. Changing PRO_TERMS below means
// bumping PRO_TERMS_VERSION, so every pro signs the new version at their
// next login.

export const PRO_TERMS_VERSION = 1;

export const PRO_TERMS = {
  title: "The Clientele agreement",
  intro:
    "Before you start, here's what Clientele is and isn't, in plain English. The full Terms of Service and Privacy Policy are linked below.",
  points: [
    {
      head: "Clientele is software for your business",
      text: "Clientele is booking and business software. You run your own business: you set your own prices, services, policies and schedule.",
    },
    {
      head: "We're not your employer, agent or insurer",
      text: "Clientele isn't your employer, agent or insurer, and isn't a party to the services you provide to your clients. You're responsible for your own licences, permits, insurance and taxes.",
    },
    {
      head: "Payments go to your own Stripe account",
      text: "Deposits and other payments go through Stripe to your own Stripe account. Clientele's fee on a deposit is 3% + 30¢ (it covers Stripe's card fee). Stripe's own terms apply to your Stripe account.",
    },
    {
      head: "Your clients are yours",
      text: "Client details are stored securely and used only to run your bookings and the features you turn on. You own your client list and can export it any time. We never sell your data or your clients' data.",
    },
    {
      head: "Nobody touches your account without permission",
      text: "Clientele staff and the Assistant only access or change your account with your permission (Settings > Support access). Everything done that way is logged for you.",
    },
    {
      head: "Price, trial and cancelling",
      text: "Clientele is $25 a month all-in (team members $12.50 each), or $250 a year, with a 14-day free trial and no card needed to start. Cancel any time; your plan stays on until the end of the period you've paid for. Payments already made aren't refunded except where the law requires.",
    },
  ],
  checks: [
    { key: "terms", label: "I've read and agree to the Terms of Service" },
    { key: "privacy", label: "I agree to the Privacy Policy" },
    {
      key: "responsible",
      label: "I understand Clientele is software, and I'm responsible for my own business, licences and insurance",
    },
  ],
};

// The exact words a pro agrees to, saved with their signature.
export function proTermsText() {
  return [
    `${PRO_TERMS.title} (version ${PRO_TERMS_VERSION})`,
    "",
    PRO_TERMS.intro,
    "",
    ...PRO_TERMS.points.flatMap((p) => [p.head, p.text, ""]),
    "Agreed:",
    ...PRO_TERMS.checks.map((c) => `[x] ${c.label}`),
    "",
    "Full Terms of Service: https://www.clientelesuite.com/terms",
    "Privacy Policy: https://www.clientelesuite.com/privacy",
  ].join("\n");
}
