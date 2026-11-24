"use server";

// Client sign-in with a pro's ID code and their phone number, and the
// client home's buttons. Step 46 SQL (0051_client_home.sql).
//
// Sign-in: the ID code + phone find the client's record with that pro. If
// this device is already signed in as them, that's it. If not, a one-time
// code goes to the email the pro has for them; once it's entered, the device
// stays signed in (the booking pages' long-lived login cookie). Answers never
// say whether a phone number or email is on file, and every step is
// rate-limited.
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createBookingClient } from "@/lib/supabase/booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";
import { stylistEmails } from "@/lib/waitlist";
import { clockTime } from "@/lib/availability";
import { reportError } from "@/lib/errorAlerts";

const ATTEMPT_COOKIE = "cl-signin";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT =
  "If those details match a client of this business, we've emailed a code to the email address they have for you. It can take a minute; check spam too.";
const BUSY = "Too many tries. Please wait a few minutes and try again.";

const site = () => publicSiteUrl("https://www.clientelesuite.com");

async function ipKey() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  // Hashed: the raw address isn't stored.
  return createHash("sha256").update(`${ip}:${process.env.SUPABASE_SECRET_KEY || ""}`).digest("hex").slice(0, 24);
}

async function allowed(admin, bucket, max, window) {
  const { data, error } = await admin.rpc("rate_ok", { p_bucket: bucket, p_max: max, p_window: window });
  // Before the SQL is run there's nothing to sign in to anyway.
  return !error && data === true;
}

const cleanCode = (code) => {
  const x = String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^CL/, "");
  return /^[2-9A-HJKMNP-Z]{4}$/.test(x) ? `CL-${x}` : null;
};
const digits = (phone) => String(phone || "").replace(/\D/g, "");

// Step 1: ID code + phone. Returns { done: code } when this device is
// already signed in as that client, else { sent: true } (whether or not the
// details matched).
export async function startClientSignIn(codeText, phone) {
  const code = cleanCode(codeText);
  if (!code) return { error: "That ID doesn't look right. It's like CL-7KQ4, in your booking emails." };
  if (digits(phone).length < 10) return { error: "Please enter your mobile number, like (555) 123-4567." };

  const admin = createAdminClient();
  const ip = await ipKey();
  if (!(await allowed(admin, `signin-ip:${ip}`, 20, "15 minutes")) || !(await allowed(admin, `signin:${code}:${digits(phone)}`, 5, "15 minutes"))) {
    return { error: BUSY };
  }

  const { data: rows } = await admin.rpc("client_signin_lookup", { p_code: code, p_phone: phone });
  const match = rows?.[0] || null;

  // Already signed in on this device as this client: straight in.
  const booking = await createBookingClient();
  if (match) {
    const {
      data: { user },
    } = await booking.auth.getUser();
    if (user?.email && user.email.toLowerCase() === match.email) {
      const { data: home } = await booking.rpc("client_home", { p_code: code });
      if (home) return { done: code };
    }
  }

  // A code to the email on file. No match: a dead-end attempt, so the answer
  // looks the same either way.
  const { data: attempt, error } = await admin
    .from("client_signin_attempts")
    .insert({ stylist_id: match?.stylist_id || null, client_id: match?.client_id || null, email: match?.email || null })
    .select("id")
    .single();
  if (error) {
    await reportError("Client sign-in", new Error(error.message));
    return { error: "Signing in isn't available right now. Please try again later." };
  }
  if (match) {
    const { error: sendError } = await booking.auth.signInWithOtp({ email: match.email, options: { shouldCreateUser: true } });
    if (sendError) {
      if (sendError.status === 429 || /rate limit|after \d+ seconds/i.test(sendError.message)) return { error: BUSY };
      await reportError("Client sign-in", new Error(`Couldn't send the code: ${sendError.message}`));
    }
  }
  (await cookies()).set(ATTEMPT_COOKIE, attempt.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/client",
    maxAge: 15 * 60,
  });
  return { sent: true, message: SENT };
}

// Step 2: the code from the email. Returns { done: code } once signed in.
export async function verifyClientSignIn(codeText, otp) {
  const code = cleanCode(codeText);
  const token = String(otp || "").replace(/\D/g, "");
  if (token.length < 6) return { error: "Please enter the code from the email." };
  const wrong = { error: "That code didn't work or has expired. Check it, or send a new one." };

  const jar = await cookies();
  const id = jar.get(ATTEMPT_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { error: "That sign-in has expired. Please start again." };

  const admin = createAdminClient();
  const { data: attempt } = await admin.from("client_signin_attempts").select("*").eq("id", id).maybeSingle();
  if (!attempt || attempt.used_at || new Date(attempt.expires_at) < new Date()) {
    return { error: "That sign-in has expired. Please start again." };
  }
  if (attempt.tries >= 5) return { error: BUSY };
  await admin.from("client_signin_attempts").update({ tries: attempt.tries + 1 }).eq("id", id);
  if (!attempt.email) return wrong;

  const booking = await createBookingClient();
  const { error } = await booking.auth.verifyOtp({ email: attempt.email, token, type: "email" });
  if (error) return wrong;
  await admin.from("client_signin_attempts").update({ used_at: new Date().toISOString() }).eq("id", id);
  jar.delete({ name: ATTEMPT_COOKIE, path: "/client" });
  return { done: code };
}

// "Forgot ID code": emails the ID codes of the pros this email books with.
// Always the same answer.
export async function forgotProCode(emailText) {
  const email = String(emailText || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Please enter a valid email." };
  const answer = {
    sent: true,
    message: "If that email is on file with a business on Clientele, we've emailed you their ID. Check spam too.",
  };
  const admin = createAdminClient();
  const ip = await ipKey();
  if (!(await allowed(admin, `forgot-ip:${ip}`, 10, "1 hour")) || !(await allowed(admin, `forgot:${email}`, 3, "1 hour"))) {
    return { error: BUSY };
  }
  const { data: pros } = await admin.rpc("client_pros_for_email", { p_email: email });
  if (!pros?.length || !emailConfigured()) return answer;

  const base = site();
  const name = String(pros[0].client_name || "").trim().split(/\s+/)[0];
  const list = pros
    .map((p) => `<p style="margin:0 0 10px;"><strong>${escapeHtml(p.business_name)}</strong><br>ID: <strong style="letter-spacing:1px;">${escapeHtml(p.pro_code)}</strong> · <a href="${escapeHtml(`${base}/client?code=${p.pro_code}`)}" style="color:#12100d;">Sign in</a></p>`)
    .join("");
  await sendEmails([
    {
      to: email,
      subject: pros.length === 1 ? `Your ID for ${pros[0].business_name}` : "Your IDs for your pros on Clientele",
      html: emailLayout("Here's your ID", [
        `<p>${name ? `Hi ${escapeHtml(name)},` : "Hi,"}</p>`,
        `<p>Sign in with the ID below and your phone number to see your visits, book your usual and more.</p>`,
        list,
        `<p style="color:#6b655b;font-size:13px;">Didn't ask for this? You can ignore it.</p>`,
      ]),
      text: `Sign in at ${base}/client with your ID and phone number.\n\n${pros.map((p) => `${p.business_name}: ${p.pro_code}`).join("\n")}`,
    },
  ]);
  return answer;
}

export async function clientSignOut() {
  const booking = await createBookingClient();
  await booking.auth.signOut();
  return { ok: true };
}

// ---------- The client home's buttons ----------

// "Running late": tells the pro in their dashboard, and by email.
export async function runningLate(codeText, bookingId, minutes) {
  const code = cleanCode(codeText);
  const booking = await createBookingClient();
  const { data, error } = await booking.rpc("client_running_late", {
    p_code: code,
    p_booking_id: String(bookingId),
    p_minutes: Number(minutes),
  });
  if (error) {
    if (/too_soon/.test(error.message)) return { error: "They've just been told. You can send another in a few minutes." };
    if (/not_today/.test(error.message)) return { error: "That's only for a visit later today." };
    return { error: "That didn't go through. Please call or message them instead." };
  }
  const row = data?.[0];
  if (row && emailConfigured()) {
    const to = (await stylistEmails(createAdminClient(), [row.stylist_id], "running_late"))[row.stylist_id];
    if (to) {
      const late = row.minutes >= 15 ? "15+ minutes" : `${row.minutes} minutes`;
      await sendEmails([
        {
          to,
          subject: `${row.client_name} is running ${late} late`,
          html: emailLayout(`${escapeHtml(row.client_name)} is running late`, [
            `<p><strong>${escapeHtml(row.client_name)}</strong> says they're running about <strong>${escapeHtml(late)}</strong> late for their ${escapeHtml(row.service_name)} at ${escapeHtml(clockTime(row.start_time))}.</p>`,
            `<p>${emailButton(`${site()}/dashboard/today`, "Open Today")}</p>`,
          ]),
          text: `${row.client_name} is running about ${late} late for their ${row.service_name} at ${clockTime(row.start_time)}.`,
        },
      ]).catch(() => {});
    }
  }
  return { ok: true };
}

export async function leaveFeedback(codeText, bookingId, rating, comment) {
  const booking = await createBookingClient();
  const { error } = await booking.rpc("client_leave_feedback", {
    p_code: cleanCode(codeText),
    p_booking_id: String(bookingId),
    p_rating: Number(rating),
    p_comment: String(comment || "").slice(0, 1000),
  });
  if (error && /not_completed/.test(error.message)) return { error: "You can leave a review once your visit has happened." };
  return error ? { error: "That didn't save. Please try again." } : { ok: true };
}

export async function saveBirthday(codeText, month, day) {
  const value = month && day ? `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  const booking = await createBookingClient();
  const { error } = await booking.rpc("client_set_birthday", { p_code: cleanCode(codeText), p_birthday: value });
  return error ? { error: "That date doesn't look right." } : { ok: true, birthday: value || null };
}

// One-tap feedback from the after-visit email (no sign-in: the email's link).
export async function feedbackByToken(token, rating, comment) {
  if (!/^[0-9a-f]{64}$/.test(String(token))) return { error: "This link doesn't work." };
  const { error } = await createAdminClient().rpc("feedback_by_token", {
    p_token: String(token),
    p_rating: Number(rating),
    p_comment: String(comment || "").slice(0, 1000),
  });
  if (error && /not_completed/.test(error.message)) return { error: "You can leave a review once your visit has happened." };
  return error ? { error: "That didn't save. Please try again." } : { ok: true };
}

// "My look" on the pro's public profile: the client's yes or no (step 61 SQL).
export async function lookConsent(codeText, bookingId, yes) {
  const booking = await createBookingClient();
  const { error } = await booking.rpc("client_look_consent", {
    p_code: cleanCode(codeText),
    p_booking_id: String(bookingId),
    p_yes: Boolean(yes),
  });
  return error ? { error: "That didn't save. Please try again." } : { ok: true, consent: yes ? "yes" : "no" };
}
