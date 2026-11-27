// /dashboard/admin: the admin overview is the Control Room's Activity tab.
import { redirect } from "next/navigation";

export default function AdminIndex() {
  redirect("/dashboard/admin/control/activity");
}
