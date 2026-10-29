"use server";

// Server actions for the public booking page. The real rules (who sees which
// times, who can book) are enforced inside the database functions these call.
import { createBookingClient } from "@/lib/supabase/booking";
import { createDepositCheckout, siteOrigin, stripeTestMode } from "@/lib/stripe";
import { normalizePhone } from "@/lib/phone";
import { emailStylistCancellation, runWaitlistSafely } from "@/lib/waitlist";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BOOKING_ERRORS = {
  not_verified: "Please confirm your phone number first.",
  invalid_name: "Please enter your name.",
  invalid_phone: "Please enter a phone number we can reach you on.",
  invalid_email: "That email doesn't look right. You can also leave it empty.",
  blocked: "Sorry, online booking isn't available for you. Please contact the salon directly.",
  slot_unavailable: "Sorry, that time was just taken. Please pick another time.",
  too_many_bookings:
    "You already have 3 upcoming appointments here. Please contact the salon to book more.",
  not_found: "That service isn't available any more. Please refresh the page.",
  already_claimed: "You've already claimed this time. You're booked!",
  waitlist_ended: "You're no longer on the waitlist for this, so this link has stopped working.",
};

const WAITLIST_ERRORS = {
  not_verified: "Please confirm your phone number first.",
  invalid_name: "Please enter your name.",
  invalid_phone: "Please enter a phone number we can reach you on.",
  invalid_email: "That email doesn't look right.",
  email_required: "Please enter your email so we can tell you when a time opens up.",
  invalid_choice: "Please pick your days and times again.",
  blocked: "Sorry, the waitlist isn't available for you. Please contact the salon directly.",
  waitlist_off: "The waitlist is closed right now. Please check back soon.",
  too_many_waitlist: "You're already on the waitlist for 3 services here.",
  not_found: "That service isn't available any more. Please refresh the page.",
};

// method is "phone" (a text message code) or "email".
// Returns { success, value } where value is the cleaned-up number or email.
export async function sendCode(method, value) {
  const supabase = await createBookingClient();

  if (method === "phone") {
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

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
      return { error: "Too many codes requested. Please wait a minute and try again." };
    }
    return { error: "We couldn't send a code right now. Please try again shortly." };
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

export async function getSlots(slug, serviceId) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_open_slots", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
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

export async function book({ slug, serviceId, date, time, name, phone, email }) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    p_date: String(date),
    p_time: String(time),
    p_name: String(name || ""),
    p_phone: String(phone || ""),
    p_email: String(email || ""),
  });

  if (error) {
    return {
      error: BOOKING_ERRORS[error.message] || "Something went wrong. Please try again.",
      code: error.message,
    };
  }

  // This service needs a deposit: the time is held while they pay on Stripe.
  if (data.status === "pending_payment") return depositCheckout(data.id);
  return { booking: data };
}

// ---------- Waitlist ----------

export async function joinWaitlist({ slug, serviceId, name, phone, email, days, times, textOk }) {
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
export async function claimOffer(token) {
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
