// Admin > Email all pros: one email to every pro, or a group of them
// (lib/announce.js). Owner only (ADMIN_EMAILS).
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/user";
import { isAdmin } from "@/lib/admin";
import { BRAND_NAME } from "@/lib/brand";
import { AUDIENCES, audienceOf } from "@/lib/announce";
import PageHeader from "@/components/dash/PageHeader";
import { loadProsAdmin } from "../pros/data";
import AnnounceForm from "./AnnounceForm";

export const metadata = { title: `Email all pros (admin) · ${BRAND_NAME}` };

export default async function AnnouncePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) notFound();
  const { pros, error } = await loadProsAdmin();
  const audiences = AUDIENCES.map((a) => ({ ...a, count: audienceOf(pros, a.key).length }));
  return (
    <>
      <PageHeader guide="admin_announce" eyebrow="Admin" title="Email all pros" subtitle="Announcements, new features and important updates. Send yourself a test first." />
      {error && <p className="message error">Couldn&apos;t load pros: {error.message}</p>}
      <AnnounceForm audiences={audiences} />
    </>
  );
}
