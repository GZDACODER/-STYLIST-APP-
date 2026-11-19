// /client: sign in with a pro's ID code and your phone number.
import { redirect } from "next/navigation";
import { createBookingClient } from "@/lib/supabase/booking";
import SignIn from "./SignIn";

const clean = (code) => {
  const x = String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^CL/, "");
  return /^[2-9A-HJKMNP-Z]{4}$/.test(x) ? `CL-${x}` : "";
};

export default async function ClientSignInPage({ searchParams }) {
  const { code: asked, out } = await searchParams;
  const code = clean(asked);
  // Already signed in on this device as that pro's client: straight home.
  if (code && !out) {
    const supabase = await createBookingClient();
    const { data } = await supabase.rpc("client_home", { p_code: code });
    if (data) redirect(`/client/${code}`);
  }
  return (
    <div className="cl-signin">
      <header className="cl-head">
        <p className="bk-kicker">Your visits</p>
        <h1 className="cl-title">Sign in</h1>
        <p className="bk-lede">
          Use your pro&apos;s ID and your phone number. No password. The ID is in your booking emails, like CL-7KQ4.
        </p>
      </header>
      <SignIn initialCode={code} />
    </div>
  );
}
