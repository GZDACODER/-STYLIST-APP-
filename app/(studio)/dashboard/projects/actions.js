"use server";

// Projects (step 67 SQL): a multi-session piece and its sessions.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";

const STATUSES = ["planning", "in_progress", "healing", "done"];

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const clean = (formData, k, max) => String(formData.get(k) || "").trim().slice(0, max) || null;

export async function createProject(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const clientId = String(formData.get("client_id") || "");
  const { data: c } = clientId ? await supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle() : { data: null };
  if (!c) return { error: "Choose the client." };
  const title = clean(formData, "title", 100);
  if (!title) return { error: "Give the project a name, like Sleeve or Back piece." };
  const planned = Number(formData.get("sessions_planned")) || null;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      stylist_id: user.id,
      client_id: c.id,
      client_name: c.name,
      title,
      placement: clean(formData, "placement", 100),
      sessions_planned: planned && planned >= 1 && planned <= 50 ? planned : null,
      notes: clean(formData, "notes", 2000),
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't save. Please try again." };
  redirect(`/dashboard/projects/${data.id}`);
}

export async function updateProject(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const planned = Number(formData.get("sessions_planned")) || null;
  const { error } = await supabase
    .from("projects")
    .update({
      title: clean(formData, "title", 100) || "Project",
      placement: clean(formData, "placement", 100),
      sessions_planned: planned && planned >= 1 && planned <= 50 ? planned : null,
      notes: clean(formData, "notes", 2000),
      status: STATUSES.includes(status) ? status : "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("stylist_id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard/projects");
  return { success: "Saved." };
}

export async function linkSession(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  const projectId = String(formData.get("project_id"));
  const on = formData.get("on") === "true";
  const { data: p } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!p) return;
  await supabase
    .from("bookings")
    .update({ project_id: on ? p.id : null })
    .eq("id", String(formData.get("booking_id")))
    .eq("stylist_id", user.id);
  await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", p.id);
  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard/projects");
}

export async function deleteProject(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  // Sessions stay; they're just no longer grouped.
  await supabase.from("projects").delete().eq("id", String(formData.get("id"))).eq("stylist_id", user.id);
  redirect("/dashboard/projects");
}
