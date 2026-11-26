// The trade's example services as rows to insert for a pro ("Use these
// services"). Every row has the same columns: a bulk insert needs matching keys.
export function exampleServiceRows(services, stylistId) {
  return (services || []).map((x) => ({
    stylist_id: stylistId,
    name: x.name,
    price_cents: x.price_cents || 0,
    duration_minutes: x.duration_minutes,
    aftercare: typeof x.aftercare === "string" && x.aftercare ? x.aftercare : null,
  }));
}
