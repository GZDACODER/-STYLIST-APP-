// The hero picture: a gold "C" monogram drawn in code (no image files), set
// on a dark plinth under soft light, so it reads like a 3D object.
//
// The letter is a ring whose inner circle sits a little to the right, so
// it's thick on the left and finer at the ends, like a classic serif C.
// The gap on the right is where the letter opens.

const CX = 200;
const CY = 196;
const OUTER = 140;
const INNER = 104;
const INNER_SHIFT = 20;
const GAP = 44; // degrees either side of the right-hand side

const point = (cx, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), CY - r * Math.sin(a)];
};
const fmt = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

// The letter's outline: the outer arc round the left side, then back along
// the inner arc.
function letterPath() {
  const icx = CX + INNER_SHIFT;
  const o1 = point(CX, OUTER, GAP);
  const o2 = point(CX, OUTER, 360 - GAP);
  const i2 = point(icx, INNER, 360 - GAP - 4);
  const i1 = point(icx, INNER, GAP + 4);
  return [
    `M ${fmt(o1)}`,
    `A ${OUTER} ${OUTER} 0 1 0 ${fmt(o2)}`,
    `L ${fmt(i2)}`,
    `A ${INNER} ${INNER} 0 1 1 ${fmt(i1)}`,
    "Z",
  ].join(" ");
}

const DEPTH = 14;

export default function Monogram() {
  const d = letterPath();
  const shapes = [d];

  return (
    <svg
      className="hm-monogram"
      viewBox="0 0 400 420"
      role="img"
      aria-label="Clientele monogram: a gold letter C"
    >
      <defs>
        <radialGradient id="mg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b8975a" stopOpacity="0.32" />
          <stop offset="45%" stopColor="#b8975a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#b8975a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mg-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6e6bd" />
          <stop offset="28%" stopColor="#d9bc80" />
          <stop offset="55%" stopColor="#b8975a" />
          <stop offset="80%" stopColor="#7d6232" />
          <stop offset="100%" stopColor="#4a3818" />
        </linearGradient>
        <linearGradient id="mg-side" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b4521" />
          <stop offset="100%" stopColor="#1f170a" />
        </linearGradient>
        <linearGradient id="mg-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff6dc" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#fff6dc" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#fff6dc" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="mg-shine" cx="30%" cy="22%" r="45%">
          <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fffaf0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mg-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mg-plinth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2722" />
          <stop offset="100%" stopColor="#0d0c0a" />
        </linearGradient>
        <clipPath id="mg-clip">
          {shapes.map((s, i) => (
            <path key={i} d={s} />
          ))}
        </clipPath>
      </defs>

      {/* Soft light behind the letter. */}
      <circle cx="200" cy="200" r="240" fill="url(#mg-glow)" />

      {/* The plinth it stands on, and its shadow. */}
      <ellipse cx="200" cy="372" rx="150" ry="20" fill="url(#mg-plinth)" />
      <ellipse cx="200" cy="368" rx="150" ry="18" fill="none" stroke="#b8975a" strokeOpacity="0.35" />
      <ellipse cx="206" cy="362" rx="118" ry="12" fill="url(#mg-shadow)" />

      <g className="hm-monogram-letter">
        {/* Depth: the same shape stacked back and down, darker each time. */}
        {Array.from({ length: DEPTH }, (_, i) => DEPTH - i).map((step) => (
          <g key={step} transform={`translate(${step * 0.9} ${step * 1.1})`}>
            {shapes.map((s, i) => (
              <path key={i} d={s} fill="url(#mg-side)" />
            ))}
          </g>
        ))}

        {/* The polished front. */}
        {shapes.map((s, i) => (
          <path key={i} d={s} fill="url(#mg-face)" />
        ))}
        <rect x="0" y="0" width="400" height="400" fill="url(#mg-shine)" clipPath="url(#mg-clip)" />
        {shapes.map((s, i) => (
          <path key={i} d={s} fill="none" stroke="url(#mg-edge)" strokeWidth="1.6" />
        ))}
      </g>
    </svg>
  );
}
