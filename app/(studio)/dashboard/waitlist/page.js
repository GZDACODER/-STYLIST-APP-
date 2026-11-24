// The Waitlist is now a tab of Openings.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/openings?tab=waitlist");
}
