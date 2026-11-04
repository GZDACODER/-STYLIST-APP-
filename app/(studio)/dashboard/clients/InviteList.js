import { cancelInvite } from "./inviteActions";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPhone } from "@/lib/phone";
import ConfirmAction from "@/components/ConfirmAction";
import InviteShare from "./InviteShare";

// Invites that are still open, and ones used in the last 30 days.
export default function InviteList({ invites, slug, businessName }) {
  if (invites.length === 0) return null;

  return (
    <ul className="service-list">
      {invites.map((invite) => {
        const booking = invite.bookings?.find((b) => b.status === "confirmed") || invite.bookings?.[0];
        return (
          <li key={invite.id} className="invite-row">
            <div>
              <div className="service-name">
                {invite.name}
                {invite.phone && <span className="muted"> · {formatPhone(invite.phone)}</span>}
              </div>
              <div className="muted small-text">
                {invite.invite_state === "used" && booking
                  ? `Booked ${booking.service_name} on ${formatDate(booking.booking_date)} at ${clockTime(booking.start_time)}`
                  : `Expires ${formatDate(invite.expires_at.slice(0, 10))}`}
              </div>
            </div>
            {invite.invite_state === "open" ? (
              <>
                <InviteShare
                  slug={slug}
                  token={invite.token}
                  name={invite.name}
                  phone={invite.phone}
                  businessName={businessName}
                />
                <ConfirmAction
                  label="Cancel invite"
                  question={`Cancel ${invite.name}'s invite?`}
                  note="The link stops working. You can send a new invite any time."
                  keepLabel="Keep invite"
                  confirmLabel="Yes, cancel"
                  pendingText="Cancelling..."
                  action={cancelInvite}
                  fields={{ id: invite.id }}
                />
              </>
            ) : (
              <span className={invite.invite_state === "used" ? "badge paid" : "badge"}>
                {invite.invite_state === "used" ? "Used" : invite.invite_state}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
