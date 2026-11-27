// Payment links: a pro asks a client to pay an amount for something (a
// balance, braiding hair, a touch-up) with a link they share anywhere.
// Paid through Stripe straight to the pro, minus the same fee as deposits.
// Pure; relative imports only (npm test loads it).
import { depositFeeCents } from "./plans.js";

export const LINK_MIN_CENTS = 100; // $1
export const LINK_MAX_CENTS = 1000000; // $10,000
export const LINK_DESCRIPTION_MAX = 120;

const oneLine = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function usd(cents) {
  const [whole, part] = (cents / 100).toFixed(2).split(".");
  return `$${Number(whole).toLocaleString("en-US")}.${part}`;
}

// { amountCents, description, clientName } or { error }
export function checkLink({ amount, description, clientName } = {}) {
  const raw = String(amount ?? "").replace(/[$,\s]/g, "");
  if (!raw) return { error: "Enter the amount." };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { error: "Enter the amount as a number, like 60 or 42.50." };
  const amountCents = Math.round(n * 100);
  if (amountCents < LINK_MIN_CENTS) return { error: "The smallest payment link is $1." };
  if (amountCents > LINK_MAX_CENTS) return { error: "The largest payment link is $10,000." };
  const desc = oneLine(description, LINK_DESCRIPTION_MAX);
  if (!desc) return { error: "Say what it's for, like \"Balance for silk press\"." };
  return { amountCents, description: desc, clientName: oneLine(clientName, 100) };
}

export function linkFeeCents(amountCents) {
  return depositFeeCents(amountCents);
}

// How a paid link is recorded in Money (payments.kind).
export function linkPaymentKind(link) {
  return link?.booking_id ? "balance" : "other";
}

// 24 random bytes as URL-safe text (32 characters).
export function newLinkToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).split("+").join("-").split("/").join("_").replace(/=+$/, "");
}

// The text that goes with the link when it's shared.
export function linkShareText(businessName, amountCents, description) {
  return `${businessName}: ${usd(amountCents)} for ${description}. Pay here:`;
}

export function formatLinkAmount(cents) {
  return usd(cents);
}
