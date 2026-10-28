import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already logged in? Go straight to the dashboard.
  if (user) redirect("/dashboard");

  return (
    <div className="stack">
      <h1>Regulars First</h1>
      <p className="muted">
        Booking for hair stylists. Let your regular clients book first, and
        only pay for the extras you turn on.
      </p>
      <Link href="/signup" className="button">
        Create a stylist account
      </Link>
      <Link href="/login" className="button secondary">
        Log in
      </Link>
    </div>
  );
}
