"use server";

// Server actions for the public booking page. The real rules (who sees which
// times, who can book) are enforced inside the database functions these call.
import { createBookingClient } from "@/lib/supabase/booking";
import { createDepositCheckout, siteOrigin, stripeTestMode } from "@/lib/stripe";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BOOKING_ERRORS = {
  not_verified: "Please confirm your email first.",
  invalid_name: "Please enter your name.",
  invalid_phone: "Please enter a phone number we can reach you on.",
  blocked: "Sorry, online booking isn't available for you. Please contact the salon directly.",
  slot_unavailable: "Sorry, that time was just taken. Please pick another time.",
  too_many_bookings:
    "You already have 3 upcoming appointments here. Please contact the salon to book more.",
  not_found: "That service isn't available any more. Please refresh the page.",
};

export async function sendCode(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) return { error: "Please enter a valid email." };

  const supabase = await createBookingClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: true },
  });

  if (error) {
    if (error.status === 429 || /rate limit|after \d+ seconds/i.test(error.message)) {
      return { error: "Too many codes requested. Please wait a minute and try again." };
    }
    return { error: "We couldn't send a code right now. Please try again shortly." };
  }
  return { success: true, email: cleanEmail };
}

export async function verifyCode(email, code) {
  const cleanCode = String(code || "").replace(/\D/g, "");
  if (cleanCode.length < 6) return { error: "Please enter the code from the email." };

  const supabase = await createBookingClient();
  const { error } = await supabase.auth.verifyOtp({
    email: String(email || "").trim().toLowerCase(),
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

export async function book({ slug, serviceId, date, time, name, phone }) {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_slug: String(slug),
    p_service_id: String(serviceId),
    p_date: String(date),
    p_time: String(time),
    p_name: String(name || ""),
    p_phone: String(phone || ""),
  });

  if (error) {
    return {
      error: BOOKING_ERRORS[error.message] || "Something went wrong. Please try again.",
      code: error.message,
    };
  }

  // This service needs a deposit: the time is held while they pay on Stripe.
  if (data.status === "pending_payment") {
    try {
      return { checkoutUrl: await createDepositCheckout(data.id, await siteOrigin()) };
    } catch (e) {
      console.error("Couldn't start deposit payment", e);
      const message = "We couldn't open the payment page. Please try again in a moment.";
      // While testing, show the real reason so it can be fixed. Real
      // clients (live keys) never see technical details.
      const detail = e?.raw?.message || e?.message;
      return { error: stripeTestMode() && detail ? `${message} Details: ${detail}` : message };
    }
  }
  return { booking: data };
}
