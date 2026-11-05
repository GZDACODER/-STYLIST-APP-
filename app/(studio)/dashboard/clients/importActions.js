"use server";

// Importing a client list from another booking app (see ImportClients.js).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 3000;

// The same as phone_key() in the database: digits, with US numbers
// starting with 1, so "(555) 123-4567" and "+1 555 123 4567" match.
function phoneKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.length === 10 ? `1${digits}` : digits;
}

// rows: [{ name, phone, email, notes }]. status: "new" or "regular".
// Clients already on the list (same phone number or email) are skipped, so
// importing the same file twice is safe. Returns { added, duplicates, invalid }.
export async function importClients(rows, status) {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "There are no clients in this file." };
  if (rows.length > MAX_ROWS) {
    return { error: `That's more than ${MAX_ROWS} clients. Please split the file and import each part.` };
  }
  const clientStatus = status === "regular" ? "regular" : "new";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { data: existing, error: loadError } = await supabase
    .from("clients")
    .select("phone, email")
    .eq("stylist_id", user.id);
  if (loadError) return { error: `Couldn't load your clients: ${loadError.message}` };

  const phones = new Set();
  const emails = new Set();
  for (const c of existing || []) {
    const key = phoneKey(c.phone);
    if (key) phones.add(key);
    if (c.email) emails.add(c.email.toLowerCase());
  }

  const toAdd = [];
  let duplicates = 0;
  let invalid = 0;
  for (const raw of rows) {
    const name = String(raw?.name || "").trim().replace(/\s+/g, " ").slice(0, 100);
    let phone = String(raw?.phone || "").trim();
    let email = String(raw?.email || "").trim().toLowerCase();
    const notes = String(raw?.notes || "").trim().slice(0, 1000);

    if (phone.length > 30 || !phoneKey(phone)) phone = "";
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) email = "";
    // A client needs a name, and a phone or email to be recognized by.
    if (!name || (!phone && !email)) {
      invalid += 1;
      continue;
    }

    const key = phoneKey(phone);
    if ((key && phones.has(key)) || (email && emails.has(email))) {
      duplicates += 1;
      continue;
    }
    if (key) phones.add(key);
    if (email) emails.add(email);

    toAdd.push({
      stylist_id: user.id,
      name,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      status: clientStatus,
    });
  }

  for (let i = 0; i < toAdd.length; i += 500) {
    const { error } = await supabase.from("clients").insert(toAdd.slice(i, i + 500));
    if (error) {
      revalidatePath("/dashboard/clients");
      return { error: `Import stopped after ${i} clients: ${error.message}` };
    }
  }

  revalidatePath("/dashboard/clients");
  return { added: toAdd.length, duplicates, invalid };
}
