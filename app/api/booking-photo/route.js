// A photo a client adds on a booking page (reference or inspiration), sent
// already shrunk by the browser. Saved privately; returns its path to send
// with the booking or request. Limited per IP so it can't be abused.
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const MAX = 2.5 * 1024 * 1024;

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  const slug = String(form?.get("slug") || "").toLowerCase();
  if (!file || typeof file === "string" || !/^[a-z0-9-]{3,80}$/.test(slug)) return Response.json({ error: "No photo." }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX) {
    return Response.json({ error: "Please use a photo (JPG or PNG) under 2.5 MB." }, { status: 400 });
  }
  const admin = createAdminClient();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: ok } = await admin.rpc("rate_ok", { p_bucket: `photo-ip:${ip}`, p_max: 30, p_window: "1 hour" });
  if (ok === false) return Response.json({ error: "Too many photos. Please try again later." }, { status: 429 });
  const { data: s } = await admin.from("stylists").select("id").eq("slug", slug).maybeSingle();
  if (!s) return Response.json({ error: "Not found." }, { status: 404 });
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${s.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await admin.storage.from("booking-photos").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) return Response.json({ error: "Couldn't save the photo. Please try again." }, { status: 500 });
  return Response.json({ path });
}
