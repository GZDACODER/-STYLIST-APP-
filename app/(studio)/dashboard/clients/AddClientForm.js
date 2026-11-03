"use client";

import { useActionState } from "react";
import { addClient } from "./actions";
import ClientFields from "./ClientFields";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function AddClientForm() {
  const [state, formAction] = useActionState(addClient, null);

  return (
    <form action={formAction}>
      {/* If there was a mistake, keep what the stylist typed so they can fix it. */}
      <ClientFields values={state?.values} />
      <SubmitButton pendingText="Adding...">Add client</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
