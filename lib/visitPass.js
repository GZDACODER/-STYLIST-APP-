// A "visit pass": the secret in the wrap-up email's link, so it opens the
// day's visits without logging in (emails often open in a different browser
// from the one you're logged in on). Server code only.
//
// A pass names one business and a range of dates, lasts 7 days, and only
// lets you see and mark visits in that range. It's signed with the server's
// secret, so it can't be made up or changed.
import { createHmac, timingSafeEqual } from "crypto";

const DAYS_VALID = 7;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function secret() {
  const key = process.env.VISIT_PASS_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set in Vercel.");
  return key;
}

const sign = (body) => createHmac("sha256", secret()).update(`visit-pass:${body}`).digest("base64url");

// stylistId, and the first and last dates ("YYYY-MM-DD") it covers.
export function makeVisitPass(stylistId, from, to) {
  const expires = Math.floor(Date.now() / 1000) + DAYS_VALID * 24 * 60 * 60;
  const body = Buffer.from(JSON.stringify({ s: stylistId, f: from, t: to, e: expires })).toString("base64url");
  return `${body}.${sign(body)}`;
}

// Returns { stylistId, from, to } for a good pass, or null.
export function readVisitPass(pass) {
  try {
    const [body, signature] = String(pass || "").split(".");
    if (!body || !signature) return null;
    const expected = Buffer.from(sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const { s, f, t, e } = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!s || !DATE.test(f) || !DATE.test(t) || !(e > Date.now() / 1000)) return null;
    return { stylistId: String(s), from: f, to: t };
  } catch {
    return null;
  }
}
