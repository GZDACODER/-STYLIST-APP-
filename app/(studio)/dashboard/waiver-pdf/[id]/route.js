// Opens a client's signed waiver PDF (a 10-minute link), for the pro whose
// client it is.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  // The pro can only read their own clients' responses (row security).
  const { data: row } = await supabase.from("intake_responses").select("stylist_id, pdf_path").eq("id", id).maybeSingle();
  if (!row?.pdf_path || row.stylist_id !== user.id) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient().storage.from("waivers").createSignedUrl(row.pdf_path, 600);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
