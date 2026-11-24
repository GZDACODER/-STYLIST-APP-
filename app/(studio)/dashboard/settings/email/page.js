// Email moved into Settings > Business.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/settings/business#email");
}
