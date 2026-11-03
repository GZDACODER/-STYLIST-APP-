// The gold star that marks Regulars and their times.
export default function RegularStar({ label = "Regulars only", size = 11 }) {
  return (
    <svg
      className="regular-star"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
    >
      <path d="M12 1.5l3.1 7.1 7.7.7-5.8 5.1 1.7 7.6L12 18l-6.7 4 1.7-7.6-5.8-5.1 7.7-.7z" />
    </svg>
  );
}
