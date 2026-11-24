// Your data moved into Settings > Privacy & support.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/settings/support#data");
}
