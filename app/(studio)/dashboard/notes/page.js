// Notes moved onto each client's card ("Visits & notes" on Clients).
// Visit notes are also written on Wrap up visits.
import { redirect } from "next/navigation";

export default function NotesPage() {
  redirect("/dashboard/clients");
}
