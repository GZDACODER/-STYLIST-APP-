// Deposit badges, shared by the Calendar list and its cancelled section.
import { formatPrice } from "@/lib/money";

// Deposit amount and whether it's paid. compact: shorter text for list rows
// ("$20 paid"), and nothing at all when there's no deposit.
export function DepositBadge({ booking, compact = false }) {
  const { deposit_cents: cents, deposit_status: status } = booking;
  if (status === "none" || !cents) return compact ? null : <span className="badge">No deposit</span>;
  const amount = formatPrice(cents);
  if (status === "paid") {
    return <span className="badge paid">{compact ? `${amount} paid` : `${amount} deposit paid`}</span>;
  }
  if (status === "refunded" || status === "refund_pending") {
    return <span className="badge">{compact ? `${amount} refunded` : `${amount} deposit refunded`}</span>;
  }
  return <span className="badge unpaid">{compact ? `${amount} unpaid` : `${amount} deposit unpaid`}</span>;
}

// Cancelled bookings: a paid deposit wasn't refunded automatically, so the
// stylist still has it: "Deposit kept · $20.00" (neutral, not green).
export function CancelledDepositBadge({ booking }) {
  if (booking.deposit_status === "paid" && booking.deposit_cents) {
    return <span className="badge kept">Deposit kept · {formatPrice(booking.deposit_cents)}</span>;
  }
  return <DepositBadge booking={booking} />;
}
