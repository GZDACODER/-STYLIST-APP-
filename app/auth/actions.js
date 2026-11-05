"use server";

// Server actions for sign-up, log-in and log-out.
// These run on the server, never in the browser.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BUSINESS_TYPE_VALUES } from "@/lib/businessTypes";

export async function signup(prevState, formData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const firstName = String(formData.get("first_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  // Optional; anything not on the list is left empty.
  const rawType = String(formData.get("business_type") || "");
  const businessType = BUSINESS_TYPE_VALUES.includes(rawType) ? rawType : "";

  if (!businessName) return { error: "Please enter your business name." };
  if (firstName.length > 50) return { error: "Please keep your first name to 50 characters." };
  if (!email) return { error: "Please enter your email." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Saved with the account; the database copies it into "stylists".
      data: { business_name: businessName, first_name: firstName, business_type: businessType },
      // Where the "confirm your email" link sends them.
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  // Shows in Vercel's logs (Deployments -> the deployment -> Logs), to see
  // whether Supabase says it sent the confirmation email.
  console.log("Business sign-up", {
    email,
    error: error ? `${error.status || ""} ${error.code || ""} ${error.message}` : null,
    userId: data?.user?.id || null,
    identities: data?.user?.identities?.length ?? null,
    confirmationSentAt: data?.user?.confirmation_sent_at || null,
  });

  if (error) return { error: signupErrorMessage(error) };

  // If email confirmation is turned off in Supabase, they're logged in now.
  if (data.session) redirect("/dashboard");

  // An account with this email already exists: Supabase sends no email and
  // gives no error (so nobody can check who has an account), but the user it
  // returns has no sign-in identities.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      error:
        "This email already has an account. Log in instead, or use a different email. If it's waiting for confirmation, tap Resend confirmation email below.",
      email,
    };
  }

  return {
    success: `Almost done! We emailed a confirmation link to ${email}. Tap it to finish. It can take a minute; check your spam folder too.`,
    email,
  };
}

function signupErrorMessage(error) {
  const text = `${error.code || ""} ${error.message || ""}`;
  if (error.status === 429 || /rate limit|after \d+ seconds/i.test(text)) {
    return "Too many emails were sent just now. Please wait a minute and try again.";
  }
  if (/sending|smtp|mail/i.test(text)) {
    return `The confirmation email couldn't be sent. Details: ${error.message}`;
  }
  return error.message;
}

// "Resend confirmation email": sends the sign-up email again. Shows
// Supabase's own reason if it can't be sent.
export async function resendConfirmation(prevState, formData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Please enter your email." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  console.log("Resend sign-up confirmation", {
    email,
    error: error ? `${error.status || ""} ${error.code || ""} ${error.message}` : null,
  });

  if (error) return { error: signupErrorMessage(error) };
  return {
    success: `Sent. Check ${email} (and your spam folder) for the confirmation link.`,
  };
}

export async function login(prevState, formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      return {
        error: "Your email isn't confirmed yet. Tap the link in the email we sent, or resend it below.",
        unconfirmedEmail: email,
      };
    }
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
