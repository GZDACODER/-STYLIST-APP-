// The gold star that marks Regulars and their times.
// label: read out by screen readers when the star stands alone (like on a
// time). Pass label={null} when it sits next to the word "Regulars".
export default function RegularStar({ label = "Regulars only", size = 11 }) {
  return (
    <svg
      className="regular-star"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d="M12 1.5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L12 18l-6.7 4 1.7-7.6-5.8-5.1 7.7-.7z" />
    </svg>
  );
}
