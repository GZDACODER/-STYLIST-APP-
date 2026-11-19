// Settings section: Email (server component).
import SettingsForm from "../SettingsForm";
import { me, optional } from "./common";

export async function EmailSection() {
  const { supabase, user } = await me("id");
  if (!user) return null;
  const replyEmail = await optional(supabase, user.id, "reply_email");
  return (
    <section className="card">
      <SettingsForm part="email" replyEmail={replyEmail || ""} loginEmail={user.email || ""} />
    </section>
  );
}
