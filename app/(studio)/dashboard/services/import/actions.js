"use server";

// Services import ("We'll set it up for you"), free on every plan:
// 1. startImport: a service_imports row and one-time upload links into the
//    pro's own folder of the private service-imports bucket.
// 2. readImport: the server downloads the screenshots, Claude reads them
//    (lib/serviceImportClaude.js), and the result waits for review.
// 3. approveImport: the rows the pro checked are added to their services.
// Nothing is added to the pro's page until step 3.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { IMPORT_MAX_SCREENSHOTS, validateRows } from "@/lib/serviceImport";
import { extractServicesFromScreenshots } from "@/lib/serviceImportClaude";

const BUCKET = "service-imports";
// Reads a pro can start in a day (each one is a paid call to Claude).
const READS_PER_DAY = 8;
const UUID = /^[0-9a-f-]{36}$/i;
const TOO_MANY = "You've imported a lot today. Please try again tomorrow, or add the rest by hand.";

// True when the pro has used today's reads (only imports that were sent to
// be read count, not uploads that never finished).
async function readsToday(supabase) {
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await supabase
    .from("service_imports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .neq("status", "uploading");
  return (count || 0) >= READS_PER_DAY;
}

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function startImport(count) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > IMPORT_MAX_SCREENSHOTS) {
    return { error: `Choose 1 to ${IMPORT_MAX_SCREENSHOTS} screenshots.` };
  }

  if (await readsToday(supabase)) return { error: TOO_MANY };

  const { data: row, error } = await supabase.from("service_imports").insert({ stylist_id: user.id }).select("id").single();
  if (error) {
    console.error("Services import: couldn't start", error.message);
    return { error: "The import couldn't start. Please try again." };
  }

  const uploads = [];
  for (let i = 1; i <= n; i++) {
    const path = `${user.id}/${row.id}/${i}.jpg`;
    const { data, error: urlError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (urlError) {
      console.error("Services import: no upload link", urlError.message);
      return { error: "The screenshots couldn't be uploaded. Please try again." };
    }
    uploads.push({ path: data.path, token: data.token });
  }
  await supabase.from("service_imports").update({ screenshot_paths: uploads.map((u) => u.path) }).eq("id", row.id);
  return { id: row.id, uploads };
}

export async function readImport(id) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  if (!UUID.test(String(id || ""))) return { error: "That import wasn't found." };

  const { data: row } = await supabase.from("service_imports").select("id, status, screenshot_paths").eq("id", id).maybeSingle();
  if (!row) return { error: "That import wasn't found." };
  if (row.status !== "uploading" && row.status !== "failed") return { ok: true };
  const paths = (row.screenshot_paths || []).filter((p) => p.startsWith(`${user.id}/${row.id}/`));
  if (!paths.length) return { error: "No screenshots were uploaded. Please try again." };

  if (await readsToday(supabase)) return { error: TOO_MANY };
  await supabase.from("service_imports").update({ status: "reading", error: null }).eq("id", row.id);

  const images = [];
  for (const path of paths) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !blob) continue;
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (!bytes.length) continue;
    images.push({ data: bytes.toString("base64"), mediaType: "image/jpeg" });
  }
  const fail = async (message) => {
    await supabase.from("service_imports").update({ status: "failed", error: message }).eq("id", row.id);
    return { error: message };
  };
  if (!images.length) return fail("Your screenshots didn't upload. Please try again.");

  const { extracted, error } = await extractServicesFromScreenshots(images);
  if (error) return fail(error);
  const found = (extracted?.services || []).filter((s) => String(s?.name || "").trim());
  if (!found.length) {
    return fail("We couldn't find any services in those screenshots. Try clearer screenshots of your service menu, with the names and prices showing.");
  }

  await supabase.from("service_imports").update({ status: "review", extracted, error: null }).eq("id", row.id);
  return { ok: true };
}

export async function approveImport(id, rows) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  if (!UUID.test(String(id || ""))) return { error: "That import wasn't found." };

  const { data: row } = await supabase.from("service_imports").select("id, status, extracted").eq("id", id).maybeSingle();
  if (!row) return { error: "That import wasn't found." };
  if (row.status === "approved") return { error: "These services were already added." };
  if (row.status !== "review") return { error: "This import isn't ready yet." };

  const { services, errors } = validateRows(rows);
  if (errors.length) return { errors };

  const { error } = await supabase
    .from("services")
    .insert(services.map((s) => ({ ...s, stylist_id: user.id, aftercare: "" })));
  if (error) {
    console.error("Services import: couldn't add", error.message);
    return { errors: [{ key: null, message: "Your services couldn't be added. Please try again." }] };
  }

  await supabase
    .from("service_imports")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      extracted: { ...(row.extracted || {}), approved: rows.map(({ name, price, duration, category, description }) => ({ name, price, duration, category, description })) },
    })
    .eq("id", row.id);
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard");
  return { added: services.length };
}
