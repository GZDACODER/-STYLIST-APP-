// Shop accounts (lib/shops.js, 0081 SQL). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkInvite, checkShopName, joinProblem, MAX_EXTRA_CHAIRS, newInviteToken, INVITE_TOKEN, shopPriceCents } from "../lib/shops.js";
import { PLANS } from "../lib/plans.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the bill: $25 for the owner's chair plus $15 for each other chair", () => {
  assert.equal(PLANS.chair.monthlyCents, 1500);
  assert.equal(shopPriceCents(0), 2500);
  assert.equal(shopPriceCents(1), 4000);
  assert.equal(shopPriceCents(5), 10000);
  assert.equal(shopPriceCents(3, "year"), 25000 + 3 * 15000);
  assert.equal(MAX_EXTRA_CHAIRS, 20);
});

test("adding a chair needs a real email; the name is optional", () => {
  assert.deepEqual(checkInvite({ name: "  Dre  Carter ", email: " Dre@Example.com " }), { name: "Dre Carter", email: "dre@example.com" });
  assert.equal(checkInvite({ name: "", email: "dre@example.com" }).name, "");
  assert.match(checkInvite({ name: "Dre", email: "dre" }).error, /email/);
  assert.match(checkShopName("   ").error, /name/);
  assert.equal(checkShopName(" Fresh  Cuts ").name, "Fresh Cuts");
});

test("invite links are long and random", () => {
  const a = newInviteToken();
  assert.ok(INVITE_TOKEN.test(a));
  assert.notEqual(a, newInviteToken());
});

test("who can join: not the owner, not a pro in another shop, not another shop's owner, not a used invite", () => {
  const invite = { shop_id: "s1", status: "invited", owner_id: "owner" };
  const pro = { id: "p1", ownsShopId: null, chairShopId: null };
  assert.equal(joinProblem(pro, invite), null);
  assert.match(joinProblem({ ...pro, id: "owner" }, invite), /own shop/);
  assert.match(joinProblem({ ...pro, chairShopId: "s2" }, invite), /already a chair/);
  assert.match(joinProblem({ ...pro, ownsShopId: "s9" }, invite), /own a shop/);
  assert.match(joinProblem(pro, { ...invite, status: "active", stylist_id: "x" }), /already used/);
  assert.match(joinProblem(pro, { ...invite, status: "removed" }), /cancelled/);
  assert.match(joinProblem(pro, null), /cancelled/);
});

test("a chair the shop pays for has every feature (the database's plan gate)", () => {
  const sql = read("supabase/migrations/0081_shops.sql");
  assert.match(sql, /\) or public\.shop_covers\(p_stylist_id\);/);
  assert.match(sql, /c\.status = 'active'/);
  assert.match(read("lib/plan.js"), /shopCovered: shopCovered === true/);
});

test("the owner's one subscription follows the chairs, and checkout includes them", () => {
  const billing = read("lib/billing.js");
  assert.match(billing, /export async function setShopChairs/);
  assert.match(billing, /shop_chairs: on && chairItem \? chairItem\.quantity/);
  assert.match(billing, /!isChairItem\(item\)/);
  const server = read("lib/shopsServer.js");
  assert.match(server, /setShopChairs\(ownerId, await extraChairCount\(ownerId\)\)/);
  assert.match(server.slice(server.indexOf("export async function joinShop")), /syncShopBilling\(invite\.shop\.owner_id\)/);
  assert.match(server.slice(server.indexOf("export async function endChair")), /syncShopBilling\(chair\.shop\.owner_id\)/);
  assert.match(read("app/(studio)/dashboard/settings/billingActions.js"), /ensurePrice\("chair", interval\), quantity: chairs/);
});

test("joining stops the chair's own plan from renewing, so nobody pays twice", () => {
  const server = read("lib/shopsServer.js");
  assert.match(server, /cancel_at_period_end: true/);
});

test("the owner sees appointments and totals, not chairs' client lists", () => {
  const sql = read("supabase/migrations/0081_shops.sql");
  const overview = sql.slice(sql.indexOf("create or replace function public.shop_overview"));
  assert.doesNotMatch(overview, /public\.clients/);
  assert.match(overview, /split_part\(coalesce\(b\.client_name, ''\), ' ', 1\)/);
});
