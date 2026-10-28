"use server";

// Server actions for sign-up, log-in and log-out.
// These run on the server, never in the stylist's browser.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(prevState, formData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!businessName) return { error: "Please enter your business name." };
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
      data: { business_name: businessName },
      // Where the "confirm your email" link sends them.
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) return { error: error.message };

  // If email confirmation is turned off in Supabase, they're logged in now.
  if (data.session) redirect("/dashboard");

  return {
    success: "Almost done! Check your email and tap the link to confirm your account.",
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

  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
