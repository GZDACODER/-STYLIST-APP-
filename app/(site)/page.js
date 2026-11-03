import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already logged in? Go straight to the dashboard.
  if (user) redirect("/dashboard");

  return (
    <div className="stack hero">
      <Logo size="large" />
      <p className="hero-tagline">Where your regulars come first.</p>
      <p className="muted">
        Elegant online booking for hair stylists. Give your loyal clients first pick of your
        openings, and only pay for the extras you turn on.
      </p>
      <div className="hero-divider" />
      <Link href="/signup" className="button">
        Create a stylist account
      </Link>
      <Link href="/login" className="button secondary">
        Log in
      </Link>
    </div>
  );
}
