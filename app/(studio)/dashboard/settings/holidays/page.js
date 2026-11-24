// Holidays moved into Settings > Hours & days off.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/availability#holidays");
}
