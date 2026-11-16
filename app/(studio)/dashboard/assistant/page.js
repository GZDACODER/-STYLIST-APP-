import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";
import Assistant from "./Assistant";

export const metadata = { title: `Assistant · ${BRAND_NAME}` };

export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <section className="card assistant-card">
      <h2>Assistant</h2>
      <p className="muted small-text">
        Ask about your schedule or tell it what to change, in your own words. Nothing changes until
        you tap Confirm.
      </p>
      {process.env.ANTHROPIC_API_KEY ? (
        <Assistant />
      ) : (
        <p className="message info">
          The assistant isn&apos;t switched on yet. Add an <code>ANTHROPIC_API_KEY</code> in Vercel
          (see ASSISTANT_SETUP.md), then redeploy.
        </p>
      )}
    </section>
  );
}
