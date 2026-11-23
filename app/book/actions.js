"use server";

// Server actions for the public booking page. The real rules (who sees which
// times, who can book) are enforced inside the database functions these call.
import { createBookingClient } from "@/lib/supabase/booking";
import {
  createDepositCheckout,
  createStandingDepositCheckout,
  siteOrigin,
  stripeTestMode,
} from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, textCodesEnabled } from "@/lib/phone";
import { emailStylistCancellation, runWaitlistSafely, stylistEmails } from "@/lib/waitlist";
import { emailReschedule } from "@/lib/bookingEmails";
import { headers } from "next/headers";
import { DEMO_BOOKING_OFF, isDemoSlug } from "@/lib/demo";
import { finishWaiver, signatureBytes, uploadSignature } from "@/lib/waivers";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BOOKING_ERRORS = {
  not_verified: "Please confirm it's you with a code first.",
  invalid_name: "Please enter your name.",
  invalid_phone: "Please enter a phone number we can reach you on.",
  invalid_email: "That email doesn't look right. You can also leave it empty.",
  blocked: "Sorry, online booking isn't available for you. Please contact the business directly.",
  slot_unavailable: "Sorry, that time was just taken. Please pick another time.",
  too_many_bookings:
    "You already have 3 upcoming appointments here. Please contact the business to book more.",
  not_found: "That service isn't available any more. Please refresh the page.",
  already_claimed: "You've already claimed this time. You're booked!",
  waitlist_ended: "You're no longer on the waitlist for this, so this link has stopped working.",
  intake_required: "Please fill in the form above and sign the waiver before booking.",
  invite_wrong_person:
    "This invite is for a different phone number. Please book with the phone number the business has for you.",
};

const WAITLIST_ERRORS = {
  plan_waitlist_paused: "The waitlist isn't open right now. Please check back soon.",
  not_verified: "Please confirm it's you with a code first.",
  invalid_name: "Please enter your name.",
  invalid_phone: "Please enter a phone number we can reach you on.",
  invalid_email: "That email doesn't look right.",
  email_required: "Please enter your email so we can tell you when a time opens up.",
  invalid_choice: "Please pick your days and times again.",
  blocked: "Sorry, the waitlist isn't available for you. Please contact the business directly.",
  waitlist_off: "The waitlist is closed right now. Please check back soon.",
  too_many_waitlist: "You're already on the waitlist for 3 services here.",
  regulars_only: "The waitlist is for regulars only right now.",
  not_found: "That service isn't available any more. Please refresh the page.",
};

// method is "phone" (a text message code) or "email".
// Returns { success, value } where value is the cleaned-up number or email.
export async function sendCode(method, value) {
  const supabase = await createBookingClient();

  if (method === "phone") {
    // Text codes are switched off (see textCodesEnabled in lib/phone.js).
    if (!textCodesEnabled()) {
      return { error: "Text message codes are switched off. Please confirm with your email." };
    }
    const phone = normalizePhone(value);
    if (!phone) return { error: "Please enter your mobile number, like (555) 123-4567." };

    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true, channel: "sms" },
    });
    if (error) {
      console.error("Couldn't send text code", error.code, error.message);
      if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
        return { error: "Too many codes requested. Please wait a minute and try again." };
      }
      // Twilio refused the text. Supabase passes on Twilio's reason, e.g.
      // "Error sending sms OTP to provider: The number +1555... is unverified".
      const sendFailed = error.code === "sms_send_failed" || /error sending .*otp/i.test(error.message);
      if (sendFailed) {
        const reason = error.message.replace(/^.*?to provider:\s*/i, "").trim();
        return {
          error: `We couldn't text that number. Check it and try again, or use email instead.${
            reason ? ` Details: ${reason}` : ""
          }`,
        };
      }
      // Phone codes are switched off (or not set up) in Supabase.
      if (
        error.code === "phone_provider_disabled" ||
        /unsupported phone provider|phone.*disabled/i.test(error.message)
      ) {
        return { error: "Text message codes aren't working right now. Please use email instead." };
      }
      return {
        error: `We couldn't send a text right now. Please try again, or use email instead. Details: ${error.message}`,
      };
    }
    return { success: true, value: phone };
  }

  const email = String(value || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "Please enter a valid email." };
  // Only suggest phone codes when they're switched on.
  const orPhone = textCodesEnabled() ? ", or use your phone number" : "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    // Shows in Vercel's logs (search for "Couldn't send email code").
    console.error("Couldn't send email code", error.status, error.code, error.message);
    if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
      return { error: "Too many codes requested. Please wait a minute and try again." };
    }
    // Supabase's own email only goes to the project's team members, and only
    // to their exact address (name+test@gmail.com is a different address).
    if (error.code === "email_address_not_authorized" || /not authorized/i.test(error.message)) {
      return {
        error: `Email codes aren't set up for this address yet. Please try a different email${orPhone}. Details: ${error.message}`,
      };
    }
    if (error.code === "email_address_invalid" || /invalid/i.test(error.message)) {
      return { error: `That email address can't be used. Please check it${orPhone}.` };
    }
    // Usually the email provider (Resend) refused: see Resend's Logs.
    return {
      error: `We couldn't send a code right now. Please try again shortly${orPhone}. Details: ${error.message}`,
    };
  }
  return { success: true, value: email };
}

export async function verifyCode(method, value, code) {
  const cleanCode = String(code || "").replace(/\D/g, "");
  if (cleanCode.length < 6) {
    return {
      error:
        method === "phone" ? "Please enter the 6-digit code." : "Please enter the code from the email.",
    };
  }

  const supabase = await createBookingClient();
  const { error } =
    method === "phone"
      ? await supabase.auth.verifyOtp({
          phone: normalizePhone(value) || "",
          token: cleanCode,
          type: "sms",
        })
      : await supabase.auth.verifyOtp({
          email: String(value || "").trim().toLowerCase(),
          token: cleanCode,
          type: "email",
        });

  if (error) return { error: "That code didn't work or has expired. Check it, or send a new one." };
  return { success: true };
}

export async function signOutBooking() {
  const supabase = await createBookingClient();
  await supabase.auth.signOut({ scope: "local" });
  return { success: true };
}

// invite: the secret from a private invite link, if they came with one.
export async function getSlots(slug, serviceId, invite) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_open_slots", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    // Only sent when there is one (works before the step 8 SQL is run).
    ...(invite ? { p_invite: String(invite) } : {}),
  });
  if (error) return { error: "Couldn't load open times. Please refresh the page." };
  return { slots: data };
}

// Sends the client to Stripe to pay the deposit for a booking that's waiting on it.
async function depositCheckout(bookingId, options) {
  try {
    return { checkoutUrl: await createDepositCheckout(bookingId, await siteOrigin(), options) };
  } catch (e) {
    console.error("Couldn't start deposit payment", e);
    const message = "We couldn't open the payment page. Please try again in a moment.";
    // While testing, show the real reason so it can be fixed. Real
    // clients (live keys) never see technical details.
    const detail = e?.raw?.message || e?.message;
    return { error: stripeTestMode() && detail ? `${message} Details: ${detail}` : message };
  }
}

// ---------- Intake form and waiver (0033_intake.sql) ----------

const INTAKE_ERRORS = {
  not_verified: "Please confirm it's you with a code first.",
  not_found: "That form isn't available any more. Please refresh the page.",
  invalid_answers: "Something went wrong with your answers. Please try again.",
  answer_too_long: "One of your answers is too long. Please shorten it.",
  answer_required: "Please answer the questions marked as required.",
  signature_required: "Please type your full name to sign the waiver.",
};

// The form for a service, if this client still needs to fill it in:
// { needed, questions, waiver_text }. Before the SQL is run: not needed.
export async function getIntake(slug, serviceId) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_intake", { p_slug: String(slug), p_service_id: String(serviceId) });
  if (error || !data) return { needed: false };
  return data;
}

// After a booking-page intake is saved: the newest response from this
// client for this business gets the drawn signature and a PDF copy.
async function keepIntakeSignature(slug, extra, ip, userAgent) {
  const png = signatureBytes(extra?.signature);
  if (!png) return;
  const supabase = await createBookingClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const admin = createAdminClient();
  const { data: s } = await admin.from("stylists").select("id, business_name").eq("slug", String(slug).toLowerCase()).maybeSingle();
  if (!s) return;
  const { data: r } = await admin
    .from("intake_responses")
    .select("id, signed_name, waiver_text, answers, email, signature_path")
    .eq("stylist_id", s.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!r || r.signature_path || !String(r.waiver_text || "").trim()) return;
  const signaturePath = await uploadSignature(s.id, png);
  await finishWaiver({
    responseId: r.id,
    stylistId: s.id,
    businessName: s.business_name,
    signerName: r.signed_name || "",
    waiverText: r.waiver_text,
    answers: (r.answers || []).map((a) => ({ label: a.label, answer: a.answer })),
    forMinor: Boolean(extra.forMinor),
    guardianName: extra.guardianName,
    guardianRelation: extra.guardianRelation,
    signaturePath,
    png,
    ip,
    userAgent,
    email: r.email || user.email,
  });
}

// answers: { questionId: "answer" }. Saved with the IP and browser it came from.
export async function submitIntake(slug, serviceId, answers, signedName, extra = {}) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const clean = {};
  for (const [key, value] of Object.entries(answers || {})) clean[String(key).slice(0, 20)] = String(value ?? "").slice(0, 2000);
  const supabase = await createBookingClient();
  const { error } = await supabase.rpc("submit_intake", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    p_answers: clean,
    p_signed_name: String(signedName || ""),
    p_ip: ip,
    p_user_agent: h.get("user-agent"),
  });
  if (error) {
    const code = Object.keys(INTAKE_ERRORS).find((c) => String(error.message).includes(c));
    if (!code) console.error("Saving an intake form failed", error.code, error.message);
    return { error: INTAKE_ERRORS[code] || "Your form couldn't be saved. Please try again." };
  }
  // The drawn signature, guardian details and a PDF copy (step 55 SQL).
  await keepIntakeSignature(slug, extra, ip, h.get("user-agent")).catch((e) => console.error("Waiver PDF failed", e?.message));
  return { success: true };
}

export async function book({ slug, serviceId, date, time, name, phone, email, invite, photos = [], requestToken = null }) {
  if (isDemoSlug(slug)) return { error: DEMO_BOOKING_OFF };
  // Services the pro approves first (step 56 SQL) can only be booked with
  // the link from an approved request, for that service.
  const admin = createAdminClient();
  const { data: svc } = await admin
    .from("services")
    .select("id, request_first, stylist:stylists(id, slug)")
    .eq("id", String(serviceId))
    .maybeSingle();
  let approved = null;
  if (svc?.request_first) {
    if (/^[0-9a-f]{48}$/.test(String(requestToken || ""))) {
      const { data: rq } = await admin
        .from("booking_requests")
        .select("id, status, approved_service_id, stylist_id")
        .eq("token", String(requestToken))
        .maybeSingle();
      if (rq && rq.status === "approved" && rq.approved_service_id === svc.id && rq.stylist_id === svc.stylist?.id) approved = rq;
    }
    if (!approved) return { error: "This service needs an approved request first. Send a request, and you'll get a link to book." };
  }
  // A service that needs the intake form: it must be on file first.
  const intake = await getIntake(slug, serviceId);
  if (intake.needed) return { error: BOOKING_ERRORS.intake_required, code: "intake_required" };

  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    p_date: String(date),
    p_time: String(time),
    p_name: String(name || ""),
    p_phone: String(phone || ""),
    p_email: String(email || ""),
    ...(invite ? { p_invite: String(invite) } : {}),
  });

  if (error) {
    return {
      error: BOOKING_ERRORS[error.message] || "Something went wrong. Please try again.",
      code: error.message,
    };
  }

  // Photos the client added (only their own uploads for this pro), and an
  // approved request that's now booked.
  try {
    const sid = svc?.stylist?.id;
    const ok = (Array.isArray(photos) ? photos : []).map(String).filter((p) => sid && p.startsWith(`${sid}/`)).slice(0, 3);
    if (ok.length) await admin.from("booking_photos").insert(ok.map((path) => ({ stylist_id: sid, booking_id: data.id, path })));
    if (approved) {
      await admin.from("booking_requests").update({ status: "booked", booking_id: data.id }).eq("id", approved.id);
      await admin.from("booking_photos").update({ booking_id: data.id }).eq("request_id", approved.id).is("booking_id", null);
    }
  } catch (e) {
    console.error("Couldn't attach booking photos", e?.message);
  }

  // This service needs a deposit: the time is held while they pay on Stripe.
  if (data.status === "pending_payment") {
    return depositCheckout(data.id, { invite: invite ? String(invite) : undefined });
  }
  return { booking: data };
}

// ---------- Requests (approve before booking) ----------
export async function sendRequest({ slug, serviceId, name, email, phone, idea, placement, size, availability, photos = [] }) {
  if (isDemoSlug(slug)) return { error: DEMO_BOOKING_OFF };
  const clean = (v, n) => String(v || "").trim().slice(0, n);
  const f = {
    name: clean(name, 100),
    email: clean(email, 200).toLowerCase(),
    phone: clean(phone, 40),
    idea: clean(idea, 3000),
    placement: clean(placement, 200),
    size: clean(size, 200),
    availability: clean(availability, 500),
  };
  if (!f.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return { error: "Please add your name and a valid email." };
  if (!f.idea) return { error: "Please describe your idea." };
  const admin = createAdminClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: ok } = await admin.rpc("rate_ok", { p_bucket: `request-ip:${ip}`, p_max: 8, p_window: "1 hour" });
  if (ok === false) return { error: "Too many requests. Please try again later." };
  const { data: svc } = await admin
    .from("services")
    .select("id, name, request_first, stylist:stylists(id, slug, business_name)")
    .eq("id", String(serviceId))
    .maybeSingle();
  if (!svc?.stylist || svc.stylist.slug !== String(slug).toLowerCase()) return { error: "This service isn't available." };
  const sid = svc.stylist.id;
  const okPhotos = (Array.isArray(photos) ? photos : []).map(String).filter((p) => p.startsWith(`${sid}/`)).slice(0, 3);
  const { data: rq, error } = await admin
    .from("booking_requests")
    .insert({
      stylist_id: sid,
      service_id: svc.id,
      service_name: svc.name,
      client_name: f.name,
      client_email: f.email,
      client_phone: f.phone || null,
      idea: f.idea,
      placement: f.placement || null,
      size: f.size || null,
      availability: f.availability || null,
      photos: okPhotos,
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't send your request. Please try again." };
  if (okPhotos.length) await admin.from("booking_photos").insert(okPhotos.map((path) => ({ stylist_id: sid, request_id: rq.id, path })));
  await admin.from("client_activity").insert({ stylist_id: sid, client_name: f.name, action: "requested", detail: svc.name });
  await emailNewRequest({ stylistId: sid, businessName: svc.stylist.business_name, serviceName: svc.name, ...f }).catch(() => {});
  return { success: true };
}

async function emailNewRequest(r) {
  if (!emailConfigured()) return;
  const admin = createAdminClient();
  const to = (await stylistEmails(admin, [r.stylistId]))[r.stylistId];
  const site = await siteOrigin();
  const messages = [];
  if (to) {
    messages.push({
      to,
      subject: `New request from ${r.name}: ${r.serviceName}`,
      html: emailLayout("New booking request", [
        `<p><strong>${escapeHtml(r.name)}</strong> sent a request for <strong>${escapeHtml(r.serviceName)}</strong>.</p>`,
        `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(r.idea)}${
          r.placement ? `\n\nPlacement: ${escapeHtml(r.placement)}` : ""
        }${r.size ? `\nSize: ${escapeHtml(r.size)}` : ""}</p>`,
        `<p>${emailButton(`${site}/dashboard/requests`, "Review the request")}</p>`,
      ]),
      text: `${r.name} sent a request for ${r.serviceName}.\n\n${r.idea}\n\nReview it: ${site}/dashboard/requests`,
    });
  }
  messages.push({
    to: r.email,
    subject: `Your request to ${r.businessName}`,
    html: emailLayout("Request sent", [
      `<p>Hi ${escapeHtml(r.name.split(" ")[0])},</p>`,
      `<p>Thanks! ${escapeHtml(r.businessName)} has your ${escapeHtml(r.serviceName)} request and will email you. If they approve it, you'll get a link to book your time.</p>`,
    ]),
    text: `Thanks! ${r.businessName} has your ${r.serviceName} request and will email you.`,
  });
  await sendEmails(messages);
}

// ---------- Waitlist ----------

export async function joinWaitlist({ slug, serviceId, name, phone, email, days, times, textOk }) {
  if (isDemoSlug(slug)) return { error: DEMO_BOOKING_OFF };
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("join_waitlist", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    p_name: String(name || ""),
    p_phone: String(phone || ""),
    p_email: String(email || ""),
    p_days: (Array.isArray(days) ? days : []).map(Number).filter(Number.isInteger),
    p_times: (Array.isArray(times) ? times : []).map(String),
    p_text_ok: Boolean(textOk),
  });
  if (error) {
    return { error: WAITLIST_ERRORS[error.message] || "Something went wrong. Please try again." };
  }
  return { joined: data };
}

// From the "Claim this time" link in a waitlist message.
// Waitlist claims (step 32 SQL): does this claim need the intake form?
// { needed, questions, waiver_text }. Before the SQL is run: not needed.
export async function getClaimIntake(token) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_claim_intake", { p_token: String(token) });
  if (error || !data) return { needed: false };
  return data;
}

// Saves the intake form from a claim link, for the person on the waitlist.
export async function submitClaimIntake(token, answers, signedName) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const clean = {};
  for (const [key, value] of Object.entries(answers || {})) clean[String(key).slice(0, 20)] = String(value ?? "").slice(0, 2000);
  const supabase = await createBookingClient();
  const { error } = await supabase.rpc("submit_claim_intake", {
    p_token: String(token),
    p_answers: clean,
    p_signed_name: String(signedName || ""),
    p_ip: ip,
    p_user_agent: h.get("user-agent"),
  });
  if (error) {
    const code = Object.keys(INTAKE_ERRORS).find((c) => String(error.message).includes(c));
    if (!code) console.error("Saving a claim intake form failed", error.code, error.message);
    return { error: INTAKE_ERRORS[code] || "Your form couldn't be saved. Please try again." };
  }
  return { success: true };
}

export async function claimOffer(token) {
  // A service that needs the intake form: it must be on file first.
  const intake = await getClaimIntake(token);
  if (intake.needed) return { error: BOOKING_ERRORS.intake_required, code: "intake_required" };

  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("claim_waitlist_offer", { p_token: String(token) });
  if (error) {
    return {
      error: BOOKING_ERRORS[error.message] || "Something went wrong. Please try again.",
      code: error.message,
    };
  }
  if (data.status === "pending_payment") {
    // If they leave the payment page, the claim link lets the time go again.
    return depositCheckout(data.id, { claimToken: String(token) });
  }
  return { booking: data };
}

export async function leaveWaitlist(token) {
  const supabase = await createBookingClient();
  const { error } = await supabase.rpc("leave_waitlist", { p_token: String(token) });
  if (error) return { error: "Something went wrong. Please try again." };
  return { success: true };
}

// ---------- The client's own bookings ----------

export async function getMyBookings(slug) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_my_bookings", { p_slug: String(slug) });
  if (error) return { bookings: [] };
  return { bookings: data };
}

// Name and phone from their last booking, to fill in the booking form.
// Empty before the step 30 SQL is run.
export async function getMyDetails(slug) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_my_details", { p_slug: String(slug) });
  if (error || !data?.length) return {};
  return { name: data[0].client_name || "", phone: data[0].client_phone || "" };
}

export async function cancelMyBooking(slug, bookingId) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("cancel_my_booking", {
    p_slug: String(slug),
    p_booking_id: String(bookingId),
  });
  if (error) {
    return { error: "That booking couldn't be cancelled. It may have already been cancelled." };
  }

  // Let the stylist know, and tell anyone on the waitlist the time is free.
  const origin = await siteOrigin();
  await Promise.all([emailStylistCancellation(data), runWaitlistSafely(data.stylist_id, origin)]);
  return { success: true };
}

// ---------- The links in booking emails ----------

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// Notes what a client did from an email link on the pro's Today page
// (client_activity, step 53 SQL). Never stops the action itself.
async function logClientAction(token, action, detail = null) {
  try {
    const admin = createAdminClient();
    const { data: b } = await admin.from("bookings").select("id, stylist_id, client_name").eq("cancel_token", String(token)).maybeSingle();
    if (b) await admin.from("client_activity").insert({ stylist_id: b.stylist_id, booking_id: b.id, client_name: b.client_name || "", action, detail });
  } catch (error) {
    console.error("Couldn't log client action", error?.message);
  }
}

// "Cancel this visit": the same rules as cancelling here on the booking page.
export async function cancelVisitByToken(token) {
  if (!TOKEN_PATTERN.test(String(token))) return { error: "This link doesn't work." };
  const { data, error } = await createAdminClient().rpc("cancel_booking_by_token", {
    p_token: String(token),
  });
  if (error) {
    return { error: "This visit couldn't be cancelled. It may have already been cancelled or passed." };
  }

  // Let the stylist know, and tell anyone on the waitlist the time is free.
  const origin = await siteOrigin();
  await Promise.all([emailStylistCancellation(data), runWaitlistSafely(data.stylist_id, origin), logClientAction(token, "cancelled")]);
  return { success: true };
}

// ---------- Rescheduling (moving a booking to another time) ----------

const RESCHEDULE_ERRORS = {
  not_found: "This appointment can't be moved here. It may have been cancelled or already passed.",
  too_close: "It's too close to your appointment to move it online.",
  too_many: "This appointment has already been moved twice.",
  blocked: "Sorry, online booking isn't available for you. Please contact the business directly.",
  slot_unavailable: "Sorry, that time was just taken. Please pick another time.",
};

function rescheduleError(error) {
  const text = String(error?.message || "");
  const code = Object.keys(RESCHEDULE_ERRORS).find((c) => text === c || text.includes(c));
  if (!code) console.error("Reschedule failed", error?.code, text);
  return {
    error: RESCHEDULE_ERRORS[code] || "Something went wrong. Please try again.",
    code: code || "error",
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

// After a move: emails to the client and the business, and the waitlist
// hears about the time that opened up.
async function afterReschedule(moved) {
  const origin = await siteOrigin();
  await Promise.all([emailReschedule(moved), runWaitlistSafely(moved.stylist_id, origin)]);
}

// From "Your upcoming appointments" (the client's own login).
export async function getMyRescheduleSlots(slug, bookingId) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_my_reschedule_slots", {
    p_slug: String(slug),
    p_booking_id: String(bookingId),
  });
  if (error) return rescheduleError(error);
  return { slots: data || [] };
}

export async function rescheduleMyBooking(slug, bookingId, date, time) {
  if (!DATE_PATTERN.test(String(date)) || !TIME_PATTERN.test(String(time))) {
    return { error: RESCHEDULE_ERRORS.slot_unavailable, code: "slot_unavailable" };
  }
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("reschedule_my_booking", {
    p_slug: String(slug),
    p_booking_id: String(bookingId),
    p_date: String(date),
    p_time: String(time),
  });
  if (error) return rescheduleError(error);
  await afterReschedule(data);
  return { moved: data };
}

// From the "Reschedule" link in a booking email (the booking's secret token).
export async function getRescheduleSlotsByToken(token) {
  if (!TOKEN_PATTERN.test(String(token))) return { error: "This link doesn't work.", code: "not_found" };
  const { data, error } = await createAdminClient().rpc("reschedule_slots_by_token", { p_token: String(token) });
  if (error) return rescheduleError(error);
  return { slots: data || [] };
}

export async function rescheduleByToken(token, date, time) {
  if (!TOKEN_PATTERN.test(String(token))) return { error: "This link doesn't work.", code: "not_found" };
  if (!DATE_PATTERN.test(String(date)) || !TIME_PATTERN.test(String(time))) {
    return { error: RESCHEDULE_ERRORS.slot_unavailable, code: "slot_unavailable" };
  }
  const { data, error } = await createAdminClient().rpc("reschedule_booking_by_token", {
    p_token: String(token),
    p_date: String(date),
    p_time: String(time),
  });
  if (error) return rescheduleError(error);
  await afterReschedule(data);
  await logClientAction(token, "rescheduled", `to ${String(date)} ${String(time).slice(0, 5)}`);
  return { moved: data };
}

// "Pay your deposit" on a standing visit: opens Stripe's payment page.
export async function payVisitDeposit(token) {
  if (!TOKEN_PATTERN.test(String(token))) return { error: "This link doesn't work." };
  try {
    return { checkoutUrl: await createStandingDepositCheckout(String(token), await siteOrigin()) };
  } catch (e) {
    console.error("Couldn't start standing deposit payment", e);
    const message = "We couldn't open the payment page. Please try again in a moment.";
    const detail = e?.raw?.message || e?.message;
    return { error: stripeTestMode() && detail ? `${message} Details: ${detail}` : message };
  }
}
