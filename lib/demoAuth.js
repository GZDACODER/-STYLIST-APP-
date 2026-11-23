// Signing a browser in to a demo account (lib/demo.js) with no password:
// makes the account the first time and fills it, then signs in with a
// one-time link made on the server. Server only.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { templateFor } from "@/lib/templates";

// Fills a type demo (barber, tattoo, tutor) from its template: the sample
// services, Tuesday-Saturday 9-6, two weeks of openings, examples on and a
// comped plan. (The hair demo is filled and reset nightly by demo_reset().)
async function fillTypeDemo(admin, id, type) {
  const acct = DEMO_ACCOUNTS[type];
  const tpl = templateFor(type);
  await admin
    .from("stylists")
    .update({ business_type: type, first_name: "Demo", tagline: acct.tagline, show_examples: true })
    .eq("id", id);
  await admin.from("stylist_plans").upsert({ stylist_id: id, comped: true }, { onConflict: "stylist_id" });
  await admin.from("services").insert(
    tpl.presets.services.map((s) => ({
      stylist_id: id,
      name: s.name,
      price_cents: s.price_cents,
      duration_minutes: s.duration_minutes,
      aftercare: tpl.modules.aftercare ? s.aftercare || "" : "",
    }))
  );
  await admin.from("working_hours").upsert(
    [0, 1, 2, 3, 4, 5, 6].map((w) => ({
      stylist_id: id,
      weekday: w,
      is_working: w >= 2 && w <= 6,
      start_time: w >= 2 && w <= 6 ? "09:00" : null,
      end_time: w >= 2 && w <= 6 ? "18:00" : null,
    })),
    { onConflict: "stylist_id,weekday" }
  );
  const openings = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(Date.now() + i * 86400000);
    if (d.getUTCDay() >= 2 && d.getUTCDay() <= 6) {
      openings.push({ stylist_id: id, opening_date: d.toISOString().slice(0, 10), start_time: "09:00", end_time: "18:00", visibility: "everyone" });
    }
  }
  if (openings.length) await admin.from("openings").insert(openings);
}

// Returns true when this browser is signed in to the demo for `type`.
export async function signInToDemo(type = "hair") {
  const acct = DEMO_ACCOUNTS[type];
  if (!acct || !process.env.SUPABASE_SECRET_KEY) return false;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: acct.email,
    email_confirm: true,
    user_metadata: { business_name: acct.name, first_name: "Demo", business_type: type },
  });
  if (createError && !/already|exists|registered/i.test(createError.message)) {
    console.error("Couldn't make the demo account", type, createError.message);
    return false;
  }
  if (!createError) {
    if (type === "hair") await admin.rpc("demo_reset");
    else await fillTypeDemo(admin, created.user.id, type);
  } else if (type !== "hair") {
    // Refill a type demo whose sample services are gone.
    const { data: row } = await admin.from("stylists").select("id").ilike("slug", `demo-${type}-%`).maybeSingle();
    if (row) {
      const { count } = await admin.from("services").select("id", { count: "exact", head: true }).eq("stylist_id", row.id);
      if (!count) await fillTypeDemo(admin, row.id, type);
    }
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: acct.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("Couldn't open the demo", type, linkError?.message);
    return false;
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) {
    console.error("Couldn't sign in to the demo", type, error.message);
    return false;
  }
  return true;
}
