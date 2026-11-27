"use client";

// Shop page forms: start a shop, add a chair (shows the invite link to
// send), rename, and join (dashboard banner and join page).
import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import CopyLinkButton from "@/components/dash/CopyLinkButton";
import { addChair, joinShopAction, renameShop, startShop } from "./actions";

export function StartShopForm({ defaultName }) {
  const [state, action] = useActionState(startShop, null);
  return (
    <form action={action} className="stack">
      <label>
        Shop name
        <input name="name" maxLength={100} defaultValue={defaultName} required />
      </label>
      <SubmitButton className="button" pendingText="Starting...">
        Start my shop
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AddChairForm({ example }) {
  const [state, action] = useActionState(addChair, null);
  return (
    <form action={action} className="stack sh-add" key={state?.link || "new"}>
      <div className="mn-grid">
        <label>
          Their name
          <input name="name" maxLength={100} placeholder={`e.g. ${example}`} />
        </label>
        <label>
          Their email
          <input name="email" type="email" maxLength={200} required placeholder="They join with this email" />
        </label>
      </div>
      <SubmitButton className="button" pendingText="Adding...">
        Add chair
      </SubmitButton>
      <FormMessage state={state} />
      {state?.link && (
        <div className="row">
          <code className="sh-link">{state.link}</code>
          <CopyLinkButton link={state.link} label="Copy invite link" />
        </div>
      )}
    </form>
  );
}

export function RenameShopForm({ name }) {
  const [state, action] = useActionState(renameShop, null);
  return (
    <form action={action} className="row sh-rename">
      <input name="name" maxLength={100} defaultValue={name} aria-label="Shop name" required />
      <SubmitButton className="button secondary small" pendingText="Saving...">
        Rename
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function JoinShopForm({ token, label = "Join the shop" }) {
  const [state, action] = useActionState(joinShopAction, null);
  if (state?.joined) {
    return (
      <p className="message success">
        {state.success} <a href="/dashboard/shop">Open Shop</a>
      </p>
    );
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="button" pendingText="Joining...">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
