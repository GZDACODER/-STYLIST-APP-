// Agreements moved into Settings > Plan & billing.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/settings/plan#agreements");
}
