"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { paymentsConfigured, refundDeposit, siteOrigin } from "@/lib/stripe";
import { emailBookingCancelled, emailDepositRefunded } from "@/lib/bookingEmails";
import { formatPrice } from "@/lib/money";
import { emailConfigured } from "@/lib/notify";
import { runWaitlistSafely } from "@/lib/waitlist";
import { loadPastBookings } from "@/lib/calendarPast";

export async function cancelBooking(formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // The database's security rules only let a stylist change their own bookings.
  const { data: cancelled } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "confirmed")
    .select(
      "id, stylist_id, client_name, client_email, service_name, booking_date, start_time, deposit_cents, deposit_status"
    );

  if (cancelled?.length) {
    // Tell the client straight away (if they gave an email).
    const { data: stylist } = await supabase
      .from("stylists")
      .select("business_name, slug")
      .eq("id", user.id)
      .maybeSingle();
    await emailBookingCancelled({ ...cancelled[0], business_name: stylist?.business_name, slug: stylist?.slug });
    // The time is free again: tell anyone on the waitlist who wants it.
    await runWaitlistSafely(user.id, await siteOrigin());
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/openings");
  revalidatePath("/dashboard/waitlist");
}

// "Refund deposit" (Cancelled list, or a booking's details). The booking
// itself isn't changed. Returns { success } or { error } for the button.
export async function refundBookingDeposit(prevState, formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (!paymentsConfigured()) return { error: "Deposits aren't set up on this site, so nothing can be refunded here." };

  // Read with the stylist's own login, so it has to be their booking.
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, stylist_id, status, client_name, client_email, service_name, booking_date, start_time, deposit_cents, deposit_status, stylist:stylists(business_name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!booking) return { error: "That booking isn't there any more." };
  if (booking.deposit_status !== "paid") return { error: "This deposit isn't paid, or it has already been refunded." };

  const result = await refundDeposit(booking.id, user.id);
  if (result.error) return { error: result.error };

  await emailDepositRefunded({ ...booking, business_name: booking.stylist?.business_name || "" });

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");
  return {
    success: `${formatPrice(booking.deposit_cents)} refunded to ${booking.client_name}. It reaches their card in 5 to 10 business days${
      booking.client_email && emailConfigured() ? ", and they've been emailed" : ""
    }.`,
  };
}

// The Calendar went back past what it loaded: past visits for
// from <= date < to (a few months at a time), and whether any are older.
export async function loadOlderBookings(from, to) {
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  if (!isDate(from) || !isDate(to) || from >= to) return { error: "Bad dates." };
  // A few months at most per request.
  if (new Date(to) - new Date(from) > 100 * 24 * 60 * 60 * 1000) return { error: "Too many months at once." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  const { data: stylist } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  if (!stylist) return { error: "Please log in again." };

  const [bookings, { data: older }] = await Promise.all([
    loadPastBookings(supabase, from, to, stylist.timezone),
    supabase.from("bookings").select("id").eq("status", "confirmed").lt("booking_date", from).limit(1),
  ]);
  return { bookings, hasOlder: (older || []).length > 0 };
}
