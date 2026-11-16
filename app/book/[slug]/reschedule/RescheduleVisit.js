"use client";

// The email link's reschedule: the shared picker, working from the
// booking's secret token.
import Link from "next/link";
import ReschedulePicker from "../ReschedulePicker";
import { getRescheduleSlotsByToken, rescheduleByToken } from "../../actions";

export default function RescheduleVisit({ token, booking, businessName, zoneNote, bookingLink }) {
  return (
    <>
      <ReschedulePicker
        booking={booking}
        businessName={businessName}
        zoneNote={zoneNote}
        loadSlots={() => getRescheduleSlotsByToken(token)}
        move={(date, time) => rescheduleByToken(token, date, time)}
      />
      <p className="small-text">
        <Link href={bookingLink}>Go to the booking page</Link>
      </p>
    </>
  );
}
