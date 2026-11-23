// Opens a signed agreement's PDF (a link that works for 10 minutes). The
// pro's own, or any pro's for the owner (ADMIN_EMAILS).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: row } = await admin.from("pro_agreements").select("stylist_id, pdf_path").eq("id", id).maybeSingle();
  if (!row?.pdf_path || (row.stylist_id !== user.id && !isAdmin(user))) return new NextResponse("Not found", { status: 404 });
  const { data } = await admin.storage.from("agreements").createSignedUrl(row.pdf_path, 600);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
