"use server";

// Server actions for the client list.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STATUS_VALUES } from "@/lib/clients";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getUserAndClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Reads and checks the add/edit form. Returns { error } or { client }.
function readClientForm(formData) {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const notes = String(formData.get("notes") || "").trim();
  const status = String(formData.get("status") || "");

  if (!name) return { error: "Please enter the client's name." };
  if (name.length > 100) return { error: "Name is too long." };
  if (phone.length > 30) return { error: "Phone number is too long." };
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    return { error: "That email doesn't look right." };
  }
  if (notes.length > 1000) return { error: "Please keep notes under 1000 characters." };
  if (!STATUS_VALUES.includes(status)) return { error: "Please pick Regular, New or Blocked." };

  return {
    client: { name, phone: phone || null, email: email || null, notes: notes || null, status },
  };
}

function formValues(formData) {
  return Object.fromEntries(
    ["name", "phone", "email", "notes", "status"].map((key) => [key, String(formData.get(key) || "")])
  );
}

export async function addClient(prevState, formData) {
  const { error: formError, client } = readClientForm(formData);
  if (formError) return { error: formError, values: formValues(formData) };

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again.", values: formValues(formData) };

  const { error } = await supabase.from("clients").insert({ ...client, stylist_id: user.id });
  if (error) return { error: error.message, values: formValues(formData) };

  revalidatePath("/dashboard/clients");
  return { success: `Added ${client.name}.` };
}

export async function updateClient(prevState, formData) {
  const id = String(formData.get("id") || "");
  const { error: formError, client } = readClientForm(formData);
  if (formError) return { error: formError };

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };

  // The database's security rules only let a stylist change their own clients.
  const { error } = await supabase.from("clients").update(client).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/clients");
  return { success: "Saved.", savedAt: Date.now() };
}

// Called directly (not from a form) when a status button is tapped.
export async function setClientStatus(id, status) {
  if (!STATUS_VALUES.includes(status)) return { error: "Unknown status." };

  const { supabase } = await getUserAndClient();
  const { error } = await supabase.from("clients").update({ status }).eq("id", String(id));
  if (error) return { error: error.message };

  revalidatePath("/dashboard/clients");
  return { success: true };
}

export async function deleteClient(formData) {
  const id = String(formData.get("id") || "");
  const { supabase } = await getUserAndClient();

  await supabase.from("clients").delete().eq("id", id);

  revalidatePath("/dashboard/clients");
}

const MERGE_ERRORS = {
  not_logged_in: "Please log in again.",
  same_client: "Pick two different cards to merge.",
  client_not_found: "One of these cards is gone. Refresh the page and try again.",
  invalid_name: "Please pick a name (up to 100 characters).",
  invalid_phone: "That phone number is too long.",
  invalid_email: "That email doesn't look right.",
  standing_clash:
    "Both cards have a standing appointment on the same day and time. End one of them first, then merge.",
  notes_too_long:
    "Together, their notes are over 1000 characters. Shorten the notes on one card first, then merge.",
};

// Moves everything from one card onto the other, then deletes the empty
// card (see 0028_merge_clients.sql). Returns { error } or { success }.
export async function mergeClients({ keepId, removeId, name, phone, email }) {
  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: MERGE_ERRORS.not_logged_in };

  const { error } = await supabase.rpc("merge_clients", {
    p_keep: String(keepId || ""),
    p_remove: String(removeId || ""),
    p_name: String(name || "").trim(),
    p_phone: String(phone || "").trim(),
    p_email: String(email || "").trim().toLowerCase(),
  });
  if (error) {
    const text = String(error.message || "");
    const known = Object.keys(MERGE_ERRORS).find((code) => text.includes(code));
    if (known) return { error: MERGE_ERRORS[known] };
    if (error.code === "PGRST202" || text.includes("merge_clients")) {
      return { error: "Merging isn't set up yet: run the step 23 SQL (0028_merge_clients.sql) in Supabase." };
    }
    console.error("Merging clients failed", error.code, error.message);
    return { error: `Couldn't merge: ${text || "please try again."}` };
  }

  revalidatePath("/dashboard/clients");
  return { success: true };
}
