// Who made a booking. bookings.booked_by is the signed-in person who booked:
// the client's own account for online bookings, or the pro's when they book
// for a client from their own booking page. Older bookings have none.
export function madeByPro(booking) {
  return Boolean(booking?.booked_by) && booking.booked_by === booking.stylist_id;
}
