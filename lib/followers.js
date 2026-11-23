// Opening alerts (step 60 SQL): clients follow a pro from their public
// profile and get an email when new times open that match what they want.
// Regulars hear first; everyone else after the pro's head start. Server only.
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";
import { clockTime, formatDate } from "@/lib/availability";

export const PARTS = [
  ["morning", "Mornings (before 12)"],
  ["afternoon", "Afternoons (12 to 5)"],
  ["evening", "Evenings (after 5)"],
];
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COOLDOWN_HOURS = 4;
const site = () => publicSiteUrl("https://www.clientelesuite.com");
const hash = (code, id) => createHash("sha256").update(`${code}:${id}`).digest("hex");
const partOf = (time) => {
  const h = Number(String(time).slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};
const dayOf = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

// ---------- Following ----------

/**
 * Start following. Sends a 6-digit code unless the email is already
 * confirmed for this pro, or matches the visitor's verified booking email.
 * Returns { ok, needCode, id } or { error }.
 */
export async function startFollowing({ stylist, name, email, phone, wants, days, parts, serviceIds, verifiedEmail }) {
  const admin = createAdminClient();
  const clean = String(email || "").trim().toLowerCase();
  const prefs = {
    name: String(name || "").trim().slice(0, 100),
    phone: String(phone || "").trim().slice(0, 40) || null,
    wants: ["any", "times", "services"].includes(wants) ? wants : "any",
    days: (days || []).map(Number).filter((d) => d >= 0 && d <= 6),
    parts: (parts || []).filter((p) => PARTS.some(([k]) => k === p)),
    service_ids: (serviceIds || []).filter((s) => /^[0-9a-f-]{36}$/i.test(s)),
    unsubscribed_at: null,
  };
  const { data: existing } = await admin
    .from("profile_followers")
    .select("id, verified_at")
    .eq("stylist_id", stylist.id)
    .ilike("email", clean)
    .maybeSingle();
  let id = existing?.id;
  if (id) {
    await admin.from("profile_followers").update(prefs).eq("id", id);
  } else {
    const { data: row, error } = await admin
      .from("profile_followers")
      .insert({ ...prefs, stylist_id: stylist.id, email: clean, token: randomBytes(24).toString("hex") })
      .select("id")
      .single();
    if (error) return { error: "Couldn't save. Please try again." };
    id = row.id;
  }
  // Already confirmed (now or before): no code needed.
  if (existing?.verified_at || (verifiedEmail && verifiedEmail.toLowerCase() === clean)) {
    if (!existing?.verified_at) await admin.from("profile_followers").update({ verified_at: new Date().toISOString() }).eq("id", id);
    return { ok: true, needCode: false, id };
  }
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await admin
    .from("profile_followers")
    .update({ code_hash: hash(code, id), code_expires_at: new Date(Date.now() + 15 * 60000).toISOString(), code_tries: 0 })
    .eq("id", id);
  if (emailConfigured()) {
    await sendEmails([
      {
        to: clean,
        subject: `Confirm your opening alerts from ${stylist.business_name}`,
        html: emailLayout("Confirm your email", [
          `<p>Enter this code to get alerts when ${escapeHtml(stylist.business_name)} has openings:</p>`,
          `<p style="font-size:30px;letter-spacing:6px;font-weight:600;margin:18px 0;">${code}</p>`,
          `<p style="color:#6b665c;font-size:13px;">It works for 15 minutes. If you didn't ask for this, ignore this email.</p>`,
        ]),
        text: `Your code is ${code}. Enter it to get opening alerts from ${stylist.business_name}. It works for 15 minutes.`,
      },
    ]).catch(() => {});
  }
  return { ok: true, needCode: true, id };
}

export async function confirmFollowing({ id, stylistId, code }) {
  const admin = createAdminClient();
  const { data: f } = await admin
    .from("profile_followers")
    .select("id, stylist_id, code_hash, code_expires_at, code_tries, verified_at")
    .eq("id", String(id))
    .maybeSingle();
  if (!f || f.stylist_id !== stylistId) return { error: "Please start again." };
  if (f.verified_at) return { ok: true };
  if (f.code_tries >= 5) return { error: "Too many tries. Please start again for a new code." };
  if (!f.code_expires_at || new Date(f.code_expires_at) < new Date()) return { error: "That code has expired. Please start again for a new one." };
  if (hash(String(code || "").replace(/\D/g, ""), f.id) !== f.code_hash) {
    await admin.from("profile_followers").update({ code_tries: f.code_tries + 1 }).eq("id", f.id);
    return { error: "That code isn't right. Please check the email and try again." };
  }
  await admin.from("profile_followers").update({ verified_at: new Date().toISOString(), code_hash: null, code_expires_at: null }).eq("id", f.id);
  return { ok: true };
}

export async function unfollowByToken(token, again = false) {
  if (!/^[0-9a-f]{48}$/.test(String(token))) return null;
  const admin = createAdminClient();
  const { data: f } = await admin
    .from("profile_followers")
    .select("id, unsubscribed_at, stylist:stylists(business_name, handle)")
    .eq("token", String(token))
    .maybeSingle();
  if (!f) return null;
  await admin.from("profile_followers").update({ unsubscribed_at: again ? null : new Date().toISOString() }).eq("id", f.id);
  return { name: f.stylist?.business_name || "", handle: f.stylist?.handle || null };
}

// ---------- Spotting new times ----------

async function openSlots(admin, stylistId, minutes, viewer) {
  const { data } = await admin.rpc("booking_open_slots", { p_stylist_id: stylistId, p_duration: minutes, p_viewer: viewer });
  return (data || []).map((s) => ({ date: s.slot_date, time: String(s.slot_time).slice(0, 5), vis: s.visibility }));
}

/**
 * Compares a pro's open times with the last check, and queues alerts for
 * new ones: regulars now, everyone else after the head start. The first
 * check only remembers what's open (no alert).
 */
export async function checkNewOpenings(stylistId) {
  const admin = createAdminClient();
  const [{ data: s }, { data: svcs }, { data: state }] = await Promise.all([
    admin.from("stylists").select("id, waitlist_regulars_minutes").eq("id", stylistId).maybeSingle(),
    admin.from("services").select("duration_minutes").eq("stylist_id", stylistId).order("duration_minutes").limit(1),
    admin.from("follower_alert_state").select("*").eq("stylist_id", stylistId).maybeSingle(),
  ]);
  if (!s || !svcs?.length) return 0;
  const minutes = svcs[0].duration_minutes;
  const [regular, everyone] = await Promise.all([openSlots(admin, s.id, minutes, "regular"), openSlots(admin, s.id, minutes, "anonymous")]);
  const key = (x) => `${x.date} ${x.time}`;
  const nowRegular = regular.map(key);
  const nowPublic = everyone.map(key);
  await admin
    .from("follower_alert_state")
    .upsert({ stylist_id: s.id, seen_regular: nowRegular, seen_public: nowPublic, checked_at: new Date().toISOString() });
  if (!state) return 0;
  const seenR = new Set(state.seen_regular);
  const seenP = new Set(state.seen_public);
  const newR = regular.filter((x) => !seenR.has(key(x)));
  const newP = everyone.filter((x) => !seenP.has(key(x)));
  const runs = [];
  if (newR.length) runs.push({ stylist_id: s.id, audience: "regulars", slots: newR.slice(0, 400), due_at: new Date().toISOString() });
  if (newP.length) {
    const head = Math.max(0, Number(s.waitlist_regulars_minutes) || 0);
    runs.push({ stylist_id: s.id, audience: "everyone", slots: newP.slice(0, 400), due_at: new Date(Date.now() + head * 60000).toISOString() });
  }
  if (runs.length) await admin.from("follower_alert_runs").insert(runs);
  return runs.length;
}

// Safe to call right after a pro posts openings.
export async function checkNewOpeningsSafely(stylistId) {
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("profile_followers")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylistId)
      .not("verified_at", "is", null)
      .is("unsubscribed_at", null);
    if (!count) return;
    await checkNewOpenings(stylistId);
    await sendDueAlerts();
  } catch {
    // The every-few-minutes check picks it up.
  }
}

// ---------- Sending ----------

function matches(f, slot) {
  if (f.wants === "times") {
    if (f.days?.length && !f.days.includes(dayOf(slot.date))) return false;
    if (f.parts?.length && !f.parts.includes(partOf(slot.time))) return false;
  }
  return true;
}

async function sendRun(admin, run) {
  const { data: s } = await admin
    .from("stylists")
    .select("id, slug, handle, business_name, timezone, profile_on")
    .eq("id", run.stylist_id)
    .maybeSingle();
  if (!s) return 0;
  const [{ data: followers }, { data: regulars }, { data: services }] = await Promise.all([
    admin
      .from("profile_followers")
      .select("id, name, email, wants, days, parts, service_ids, token, last_alert_at, alerts_sent")
      .eq("stylist_id", s.id)
      .not("verified_at", "is", null)
      .is("unsubscribed_at", null),
    admin.from("clients").select("email").eq("stylist_id", s.id).eq("status", "regular"),
    admin.from("services").select("id, name, duration_minutes").eq("stylist_id", s.id),
  ]);
  const regularEmails = new Set((regulars || []).map((r) => String(r.email || "").toLowerCase()).filter(Boolean));
  const audience = (followers || []).filter((f) => (run.audience === "regulars") === regularEmails.has(f.email.toLowerCase()));
  const cutoff = Date.now() - COOLDOWN_HOURS * 3600000;
  // Times a specific service fits in, worked out once per service.
  const fitsCache = {};
  const fits = async (serviceId, viewer) => {
    const k = `${serviceId}:${viewer}`;
    if (!fitsCache[k]) {
      const svc = (services || []).find((x) => x.id === serviceId);
      fitsCache[k] = svc ? new Set((await openSlots(admin, s.id, svc.duration_minutes, viewer)).map((x) => `${x.date} ${x.time}`)) : new Set();
    }
    return fitsCache[k];
  };
  const viewer = run.audience === "regulars" ? "regular" : "anonymous";
  const messages = [];
  const sentIds = [];
  for (const f of audience) {
    if (f.last_alert_at && new Date(f.last_alert_at).getTime() > cutoff) continue;
    let slots = run.slots.filter((x) => matches(f, x));
    let serviceName = null;
    if (f.wants === "services" && f.service_ids?.length) {
      const ok = new Set();
      for (const id of f.service_ids) for (const k of await fits(id, viewer)) ok.add(k);
      slots = slots.filter((x) => ok.has(`${x.date} ${x.time}`));
      const names = (services || []).filter((x) => f.service_ids.includes(x.id)).map((x) => x.name);
      serviceName = names.length === 1 ? names[0] : null;
    }
    if (!slots.length) continue;
    // One line per day: the first few times.
    const byDay = new Map();
    for (const x of slots) (byDay.get(x.date) || byDay.set(x.date, []).get(x.date)).push(x.time);
    const lines = [...byDay.entries()].slice(0, 6).map(([d, times]) => `${formatDate(d).replace(/, \d{4}$/, "")}: ${times.slice(0, 4).map(clockTime).join(", ")}${times.length > 4 ? " and more" : ""}`);
    const bookUrl = `${site()}/book/${s.slug}${f.wants === "services" && f.service_ids?.length === 1 ? `?service=${f.service_ids[0]}` : ""}`;
    const stopUrl = `${site()}/alerts/stop/${f.token}`;
    const first = f.name.split(" ")[0];
    messages.push({
      to: f.email,
      subject: `${s.business_name} has new openings`,
      html: emailLayout(run.audience === "regulars" ? "Openings, first for regulars" : "New openings", [
        `<p>Hi ${escapeHtml(first)},</p>`,
        `<p>${escapeHtml(s.business_name)} just opened ${serviceName ? `times for <strong>${escapeHtml(serviceName)}</strong>` : "new times"}${
          run.audience === "regulars" ? ". As a regular, you're hearing first" : ""
        }:</p>`,
        `<ul style="padding-left:18px;margin:14px 0;">${lines.map((l) => `<li style="margin:4px 0;">${escapeHtml(l)}</li>`).join("")}</ul>`,
        `<p style="color:#6b665c;font-size:13px;">Times are first come, first served.</p>`,
        `<p>${emailButton(bookUrl, "Book now")}</p>`,
        `<p style="color:#6b665c;font-size:12px;margin-top:28px;">You asked for opening alerts from ${escapeHtml(s.business_name)}. <a href="${escapeHtml(stopUrl)}" style="color:#6b665c;">Stop these alerts</a></p>`,
      ]),
      text: `Hi ${first}, ${s.business_name} just opened new times:\n${lines.join("\n")}\n\nBook now: ${bookUrl}\n\nStop these alerts: ${stopUrl}`,
    });
    sentIds.push(f);
  }
  if (messages.length && emailConfigured()) await sendEmails(messages).catch(() => {});
  const now = new Date().toISOString();
  for (const f of sentIds) await admin.from("profile_followers").update({ last_alert_at: now, alerts_sent: (f.alerts_sent || 0) + 1 }).eq("id", f.id);
  return sentIds.length;
}

export async function sendDueAlerts() {
  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("follower_alert_runs")
    .select("*")
    .is("done_at", null)
    .lte("due_at", new Date().toISOString())
    .order("due_at")
    .limit(20);
  let sent = 0;
  for (const run of runs || []) {
    // Claim it first so two checks never send the same run twice.
    const { data: claimed } = await admin
      .from("follower_alert_runs")
      .update({ done_at: new Date().toISOString() })
      .eq("id", run.id)
      .is("done_at", null)
      .select("id");
    if (!claimed?.length) continue;
    const n = await sendRun(admin, run);
    await admin.from("follower_alert_runs").update({ sent: n }).eq("id", run.id);
    sent += n;
  }
  return sent;
}

/** The every-minute job: send due alerts; every 5 minutes, look for new times. */
export async function runFollowerAlerts() {
  if (!process.env.SUPABASE_SECRET_KEY) return { sent: 0 };
  const admin = createAdminClient();
  let checked = 0;
  if (new Date().getUTCMinutes() % 5 === 0) {
    const { data: rows } = await admin
      .from("profile_followers")
      .select("stylist_id")
      .not("verified_at", "is", null)
      .is("unsubscribed_at", null)
      .limit(5000);
    const ids = [...new Set((rows || []).map((r) => r.stylist_id))].slice(0, 200);
    for (const id of ids) {
      try {
        await checkNewOpenings(id);
        checked += 1;
      } catch {
        // One pro failing doesn't stop the rest.
      }
    }
  }
  const sent = await sendDueAlerts();
  return { checked, sent };
}
