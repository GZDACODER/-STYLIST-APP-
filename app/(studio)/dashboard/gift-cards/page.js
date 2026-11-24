// Gift cards moved to the Gift cards tab on Money. Links to
// /dashboard/gift-cards#redeem keep the #redeem part, which opens Redeem.
import { redirect } from "next/navigation";

export default function GiftCardsPage() {
  redirect("/dashboard/money?tab=gifts");
}
