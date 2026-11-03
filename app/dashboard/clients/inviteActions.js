"use server";

// Server actions for private invite links.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export async function createInvite(prevState, formData) {
  const name = String(formData.get("name") || "").trim();
  const phoneText = String(formData.get("phone") || "").trim();
  if (!name) return { error: "Please enter their name." };
  if (name.length > 100) return { error: "That name is too long." };

  // Optional. If given, only that number can use the link.
  const phone = phoneText ? normalizePhone(phoneText) : null;
  if (phoneText && !phone) return { error: "That phone number doesn't look right. You can leave it empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { data, error } = await supabase
    .from("client_invites")
    .insert({ stylist_id: user.id, name, phone })
    .select("id, token, name, phone")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/clients");
  return { invite: data, createdAt: Date.now() };
}

export async function cancelInvite(formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  // The database's security rules only let a stylist change their own invites.
  await supabase
    .from("client_invites")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/dashboard/clients");
}
