// The hero picture: a gold object floating over a dark plinth that slowly
// turns between a calendar (front) and a "Fully booked" badge (back). Both faces are
// drawn here in SVG, and the turn is CSS 3D (see .hm-object in home.css).
// No images, no 3D libraries. With "reduce motion" on, the calendar stays put.

// The shared gold: a polished face, a dark edge and a soft shine.
function Gold({ id }) {
  return (
    <>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f6e6bd" />
        <stop offset="30%" stopColor="#d9bc80" />
        <stop offset="58%" stopColor="#b8975a" />
        <stop offset="82%" stopColor="#7d6232" />
        <stop offset="100%" stopColor="#4a3818" />
      </linearGradient>
      <linearGradient id={`${id}-deep`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8a6c38" />
        <stop offset="100%" stopColor="#2e2310" />
      </linearGradient>
      <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff6dc" stopOpacity="0.9" />
        <stop offset="45%" stopColor="#fff6dc" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#fff6dc" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-shine`} cx="28%" cy="20%" r="55%">
        <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#fffaf0" stopOpacity="0" />
      </radialGradient>
    </>
  );
}

// A five-pointed star centred on (cx, cy).
function starPath(cx, cy, outer, inner) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

// Front: a wall calendar with two rings, a month grid and one date marked
// with a star (a regular's booking).
function Calendar() {
  const cols = 7;
  const rows = 5;
  const gridX = 56;
  const gridY = 132;
  const cell = 28;
  const gap = 5;
  const marked = { row: 2, col: 4 };
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      // The month starts on a Wednesday and has 31 days.
      const day = r * cols + c - 2;
      if (day < 1 || day > 31) continue;
      cells.push({ r, c, x: gridX + c * (cell + gap), y: gridY + r * (cell + gap) });
    }
  }

  return (
    <svg className="hm-face hm-face-front" viewBox="0 0 340 340" aria-hidden="true">
      <defs>
        <Gold id="cal" />
        <clipPath id="cal-clip">
          <rect x="36" y="58" width="268" height="250" rx="22" />
        </clipPath>
      </defs>

      {/* Depth: the card's thickness, behind and below. */}
      <rect x="42" y="66" width="268" height="250" rx="22" fill="url(#cal-deep)" />
      <rect x="36" y="58" width="268" height="250" rx="22" fill="url(#cal-face)" />

      {/* The header band, a little darker. */}
      <g clipPath="url(#cal-clip)">
        <rect x="36" y="58" width="268" height="58" fill="#6b5328" opacity="0.55" />
        <rect x="0" y="0" width="340" height="340" fill="url(#cal-shine)" />
      </g>
      {/* The month name, as fine lines (no text to load). */}
      <rect x="132" y="82" width="76" height="6" rx="3" fill="#f6e6bd" opacity="0.85" />
      <rect x="150" y="96" width="40" height="4" rx="2" fill="#f6e6bd" opacity="0.45" />

      {/* The grid: engraved squares. */}
      {cells.map(({ r, c, x, y }) =>
        r === marked.row && c === marked.col ? null : (
          <rect key={`${r}-${c}`} x={x} y={y} width={cell} height={cell} rx="6" fill="#4a3818" opacity="0.32" />
        )
      )}
      {/* The marked date: raised, with a star. */}
      {(() => {
        const x = gridX + marked.col * (cell + gap);
        const y = gridY + marked.row * (cell + gap);
        return (
          <g>
            <rect x={x - 3} y={y - 3} width={cell + 6} height={cell + 6} rx="8" fill="#1a140a" />
            <path d={starPath(x + cell / 2, y + cell / 2, 10, 4.2)} fill="#e9cf94" />
          </g>
        );
      })()}

      <rect
        x="36"
        y="58"
        width="268"
        height="250"
        rx="22"
        fill="none"
        stroke="url(#cal-edge)"
        strokeWidth="2"
      />

      {/* The two rings at the top. */}
      {[112, 228].map((x) => (
        <g key={x}>
          <rect x={x - 9} y="66" width="18" height="10" rx="5" fill="#2a1f0d" />
          <rect x={x - 7} y="30" width="14" height="44" rx="7" fill="url(#cal-face)" />
          <rect x={x - 7} y="30" width="14" height="44" rx="7" fill="none" stroke="url(#cal-edge)" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

// A seal's edge: many small points around a circle.
function sealPath(cx, cy, outer, inner, points) {
  const out = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / points) * i - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${out.join(" L ")} Z`;
}

// Back: a gold "Fully booked" seal with a star and two ribbon tails.
function Badge() {
  const cx = 170;
  const cy = 156;
  const words = { fontFamily: "var(--font-sans), Arial, sans-serif", fontWeight: 700 };
  return (
    <svg className="hm-face hm-face-back" viewBox="0 0 340 340" aria-hidden="true">
      <defs>
        <Gold id="bd" />
      </defs>

      {/* Ribbon tails, behind the seal. */}
      <path d="M 120 222 L 96 316 L 124 300 L 140 326 L 160 236 Z" fill="url(#bd-deep)" />
      <path d="M 220 222 L 244 316 L 216 300 L 200 326 L 180 236 Z" fill="url(#bd-deep)" />
      <path d="M 120 222 L 96 316 L 124 300 L 140 326 L 160 236 Z" fill="url(#bd-face)" opacity="0.55" />
      <path d="M 220 222 L 244 316 L 216 300 L 200 326 L 180 236 Z" fill="url(#bd-face)" opacity="0.4" />

      {/* Depth, then the polished seal. */}
      <path d={sealPath(cx + 6, cy + 7, 124, 114, 36)} fill="url(#bd-deep)" />
      <path d={sealPath(cx, cy, 124, 114, 36)} fill="url(#bd-face)" />
      <path d={sealPath(cx, cy, 124, 114, 36)} fill="url(#bd-shine)" />
      <path d={sealPath(cx, cy, 124, 114, 36)} fill="none" stroke="url(#bd-edge)" strokeWidth="1.6" />

      {/* Inner rings. */}
      <circle cx={cx} cy={cy} r="96" fill="none" stroke="#4a3818" strokeOpacity="0.45" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="88" fill="#6b5328" fillOpacity="0.28" />
      <circle cx={cx} cy={cy} r="88" fill="none" stroke="#f6e6bd" strokeOpacity="0.55" strokeWidth="1.2" />

      {/* The star, then the words. */}
      <path d={starPath(cx, cy - 40, 20, 8.5)} fill="#1a140a" opacity="0.9" />
      <path d={starPath(cx, cy - 42, 18, 7.6)} fill="#f6e6bd" />
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="27" letterSpacing="5" fill="#1a140a" style={words}>
        FULLY
      </text>
      <text x={cx} y={cy + 42} textAnchor="middle" fontSize="27" letterSpacing="5" fill="#1a140a" style={words}>
        BOOKED
      </text>
      <line x1={cx - 34} y1={cy + 60} x2={cx + 34} y2={cy + 60} stroke="#1a140a" strokeOpacity="0.5" strokeWidth="1.5" />
    </svg>
  );
}

export default function HeroObject() {
  return (
    <div className="hm-object" role="img" aria-label="A gold calendar that turns into a Fully booked badge">
      {/* Soft gold light, the plinth and its shadow (these don't turn). */}
      <svg className="hm-object-stage" viewBox="0 0 400 420" aria-hidden="true">
        <defs>
          <radialGradient id="st-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#b8975a" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#b8975a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#b8975a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="st-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="st-plinth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2722" />
            <stop offset="100%" stopColor="#0d0c0a" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="240" fill="url(#st-glow)" />
        <ellipse cx="200" cy="372" rx="150" ry="20" fill="url(#st-plinth)" />
        <ellipse cx="200" cy="368" rx="150" ry="18" fill="none" stroke="#b8975a" strokeOpacity="0.35" />
        <ellipse className="hm-object-shadow" cx="204" cy="362" rx="118" ry="12" fill="url(#st-shadow)" />
      </svg>

      <div className="hm-object-float">
        <div className="hm-object-turn">
          <Calendar />
          <Badge />
        </div>
      </div>
    </div>
  );
}
