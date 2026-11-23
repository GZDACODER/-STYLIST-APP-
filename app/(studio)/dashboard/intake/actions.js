"use server";

// Saving the intake form, the waiver and which services need them
// (see 0033_intake.sql), and "Ask again" on a client card.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["text", "long", "yesno", "choice"];
const SETUP = "Intake forms aren't set up yet: run supabase/migrations/0033_intake.sql in Supabase, then try again.";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const missing = (error) => /intake_|relation .* does not exist|column .* does not exist/i.test(String(error?.message || ""));

// Checks and tidies the questions sent from the builder.
function cleanQuestions(raw) {
  if (!Array.isArray(raw)) return { error: "Something went wrong reading the questions. Please try again." };
  if (raw.length > 20) return { error: "Please keep it to 20 questions or fewer." };
  const seen = new Set();
  const questions = [];
  for (const [i, q] of raw.entries()) {
    const label = String(q?.label || "").trim();
    if (!label) return { error: `Question ${i + 1} needs some words.` };
    if (label.length > 300) return { error: `Question ${i + 1} is too long (300 characters at most).` };
    const type = TYPES.includes(q?.type) ? q.type : "text";
    let options = [];
    if (type === "choice") {
      options = (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o || "").trim())
        .filter(Boolean)
        .slice(0, 12);
      if (options.length < 2) return { error: `Question ${i + 1} needs at least 2 choices.` };
      if (options.some((o) => o.length > 80)) return { error: `Question ${i + 1} has a choice that's too long.` };
    }
    let id = String(q?.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || `q${i + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    questions.push({ id, label, type, ...(type === "choice" ? { options } : {}), required: Boolean(q?.required) });
  }
  return { questions };
}

// formData: questions (JSON), waiver_text, service (one per ticked service id).
export async function saveIntake(prevState, formData) {
  let raw;
  try {
    raw = JSON.parse(String(formData.get("questions") || "[]"));
  } catch {
    return { error: "Something went wrong reading the questions. Please try again." };
  }
  const { error: questionError, questions } = cleanQuestions(raw);
  if (questionError) return { error: questionError };
  const waiver = String(formData.get("waiver_text") || "").trim();
  if (waiver.length > 10000) return { error: "Please keep the waiver under 10,000 characters." };
  const ticked = new Set(formData.getAll("service").map(String));
  const frequency = ["first", "every", "yearly"].includes(String(formData.get("waiver_frequency"))) ? String(formData.get("waiver_frequency")) : "first";
  const timing = ["booking", "before"].includes(String(formData.get("waiver_timing"))) ? String(formData.get("waiver_timing")) : "booking";

  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };

  // Update the form (only questions and waiver can change), or make it.
  const { data: existing, error: readError } = await supabase
    .from("intake_forms")
    .select("stylist_id")
    .maybeSingle();
  if (readError) return { error: missing(readError) ? SETUP : readError.message };
  const { error } = existing
    ? await supabase.from("intake_forms").update({ questions, waiver_text: waiver, waiver_frequency: frequency, waiver_timing: timing }).eq("stylist_id", user.id)
    : await supabase.from("intake_forms").insert({ stylist_id: user.id, questions, waiver_text: waiver, waiver_frequency: frequency, waiver_timing: timing });
  if (error) return { error: missing(error) ? SETUP : error.message };

  const { data: services, error: serviceError } = await supabase.from("services").select("id, intake_required");
  if (serviceError) return { error: missing(serviceError) ? SETUP : serviceError.message };
  const changes = (services || []).filter((s) => Boolean(s.intake_required) !== ticked.has(s.id));
  const results = await Promise.all(
    changes.map((s) => supabase.from("services").update({ intake_required: ticked.has(s.id) }).eq("id", s.id))
  );
  const failed = results.find((r) => r.error);
  if (failed) return { error: failed.error.message };

  revalidatePath("/dashboard/intake");
  revalidatePath("/book", "layout");
  const empty = questions.length === 0 && !waiver;
  return {
    success: empty
      ? "Saved. With no questions and no waiver, clients aren't asked anything."
      : ticked.size === 0
        ? "Saved. Tick at least one service so clients are asked to fill it in."
        : "Saved. Clients booking those services will fill it in (once; editing it asks everyone again).",
  };
}

// The newest response for a client card, for the card's Intake section.
export async function getClientIntake(clientId) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  const { data, error } = await supabase.rpc("client_intake", { p_client_id: String(clientId) });
  if (error) return { error: missing(error) ? null : "Couldn't load their intake form.", missing: missing(error) };
  return { intake: data };
}

// "Ask again": the client fills it in again on their next booking.
export async function askIntakeAgain(clientId) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  const { error } = await supabase
    .from("clients")
    .update({ intake_redo_at: new Date().toISOString() })
    .eq("id", String(clientId));
  if (error) return { error: missing(error) ? SETUP : error.message };
  revalidatePath("/dashboard/clients");
  return { success: true };
}
