// Client statuses, in the order they're shown.
export const CLIENT_STATUSES = [
  { value: "regular", label: "Regular" },
  { value: "new", label: "New" },
  { value: "blocked", label: "Blocked" },
];

export const STATUS_VALUES = CLIENT_STATUSES.map((s) => s.value);
