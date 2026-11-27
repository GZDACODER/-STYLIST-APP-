// Shop accounts (0081 SQL): one owner, several chairs, one bill. Pure
// helpers (no database), shared by the pages and the tests.
import { randomBytes } from "node:crypto";
import { PLANS } from "./plans.js";

// Other chairs one shop can have (the owner's own chair is extra to this).
export const MAX_EXTRA_CHAIRS = 20;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const oneLine = (t, max) => String(t || "").replace(/\s+/g, " ").trim().slice(0, max);

// The shop's monthly (or yearly) price: All-in for the owner's chair plus
// Extra chair for each other one. $25 + $15 × extra.
export function shopPriceCents(extraChairs, interval = "month") {
  const n = Math.max(0, Math.round(Number(extraChairs) || 0));
  const key = interval === "year" ? "yearlyCents" : "monthlyCents";
  return PLANS.allin[key] + n * PLANS.chair[key];
}

export function checkShopName(name) {
  const clean = oneLine(name, 100);
  return clean ? { name: clean } : { error: "Please give your shop a name." };
}

// Add a chair: their name (optional) and email (needed, it's who can join).
export function checkInvite({ name, email }) {
  const cleanEmail = String(email || "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL.test(cleanEmail)) return { error: "Please check their email address." };
  return { name: oneLine(name, 100), email: cleanEmail };
}

export const newInviteToken = () => randomBytes(24).toString("base64url");
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{22,64}$/;

/**
 * Can this pro join this shop? me: { id, ownsShopId, chairShopId }.
 * invite: { shop_id, status, owner_id }. Returns null if yes, else the reason.
 */
export function joinProblem(me, invite) {
  if (!invite || invite.status === "removed") return "This invite was cancelled. Ask the shop owner for a new one.";
  if (invite.status === "active") return invite.stylist_id === me.id ? "You're already in this shop." : "This invite was already used.";
  if (invite.owner_id === me.id) return "This is your own shop. Send the invite to the person taking the chair.";
  if (me.chairShopId) return "You're already a chair in a shop. Leave it first (Shop page), then join this one.";
  if (me.ownsShopId) return "You own a shop, so you can't be a chair in another one.";
  return null;
}
