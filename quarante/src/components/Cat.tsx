/**
 * The game's own mascot: a white cat with cat-eye lashes, a heart nose, a little
 * smile and a red bow at the collar. Original drawing, not any existing character.
 */
type Pose = "peek" | "wink" | "hearts" | "sit";

export function Cat({ pose = "peek", className = "", style }: { pose?: Pose; className?: string; style?: React.CSSProperties }) {
  const outline = "#3A0910";
  const red = "#C3142A";
  const leftEye =
    pose === "wink" ? (
      <path d="M58 92 q12 9 24 0" stroke={outline} strokeWidth="4" fill="none" strokeLinecap="round" />
    ) : (
      <g>
        <ellipse cx="70" cy="92" rx="8" ry="10" fill={outline} />
        <circle cx="72.5" cy="88.5" r="2.6" fill="#fff" />
        <path d="M60 84 l-6 -5 M63 81 l-4 -6" stroke={outline} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  const rightEye = (
    <g>
      <ellipse cx="130" cy="92" rx="8" ry="10" fill={outline} />
      <circle cx="132.5" cy="88.5" r="2.6" fill="#fff" />
      <path d="M140 84 l6 -5 M137 81 l4 -6" stroke={outline} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
  const heart = (cx: number, cy: number, s: number, fill: string) => (
    <path
      d={`M${cx} ${cy + s * 0.9} C ${cx - s * 1.6} ${cy - s * 0.2}, ${cx - s * 0.9} ${cy - s * 1.4}, ${cx} ${cy - s * 0.5} C ${cx + s * 0.9} ${cy - s * 1.4}, ${cx + s * 1.6} ${cy - s * 0.2}, ${cx} ${cy + s * 0.9} Z`}
      fill={fill}
      stroke={outline}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  );
  return (
    <svg viewBox="0 0 200 190" className={className} style={style} aria-hidden>
      {/* ears */}
      <path d="M38 70 L46 14 L92 46 Z" fill="#fff" stroke={outline} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M52 52 L56 28 L78 44 Z" fill="#F7B7BE" />
      <path d="M162 70 L154 14 L108 46 Z" fill="#fff" stroke={outline} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M148 52 L144 28 L122 44 Z" fill="#F7B7BE" />
      {/* head */}
      <ellipse cx="100" cy="98" rx="76" ry="62" fill="#fff" stroke={outline} strokeWidth="4.5" />
      {/* cheeks */}
      <ellipse cx="54" cy="116" rx="11" ry="6.5" fill="#F7B7BE" opacity="0.8" />
      <ellipse cx="146" cy="116" rx="11" ry="6.5" fill="#F7B7BE" opacity="0.8" />
      {/* eyes or heart sunglasses */}
      {pose === "hearts" ? (
        <g>
          {heart(70, 92, 15, red)}
          {heart(130, 92, 15, red)}
          <path d="M84 88 q16 -8 32 0" stroke={outline} strokeWidth="4" fill="none" />
        </g>
      ) : (
        <g>
          {leftEye}
          {rightEye}
        </g>
      )}
      {/* heart nose and smile */}
      {heart(100, 110, 5.5, "#F28AA0")}
      <path d="M100 116 q-8 9 -16 3 M100 116 q8 9 16 3" stroke={outline} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* whiskers */}
      <path d="M22 104 l26 4 M24 120 l25 -3 M178 104 l-26 4 M176 120 l-25 -3" stroke={outline} strokeWidth="3.5" strokeLinecap="round" />
      {/* collar bow */}
      <g transform="translate(100 162)">
        <path d="M0 0 L-30 -16 Q-40 0 -30 16 Z" fill={red} stroke={outline} strokeWidth="4" strokeLinejoin="round" />
        <path d="M0 0 L30 -16 Q40 0 30 16 Z" fill={red} stroke={outline} strokeWidth="4" strokeLinejoin="round" />
        <circle r="8.5" fill={red} stroke={outline} strokeWidth="4" />
        <path d="M-24 -6 L-12 -2 M24 -6 L12 -2" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </g>
      {/* paws, when peeking over an edge */}
      {pose === "peek" && (
        <g>
          <ellipse cx="62" cy="176" rx="18" ry="12" fill="#fff" stroke={outline} strokeWidth="4.5" />
          <ellipse cx="138" cy="176" rx="18" ry="12" fill="#fff" stroke={outline} strokeWidth="4.5" />
        </g>
      )}
    </svg>
  );
}

/** Four-point sparkle. */
export function Sparkle({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="currentColor" />
    </svg>
  );
}

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden>
      <path d="M4 34 L8 8 L22 22 L32 4 L42 22 L56 8 L60 34 Z" fill="#E9B530" stroke="#7A4A06" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="3.5" fill="#E9B530" stroke="#7A4A06" strokeWidth="2" />
      <circle cx="32" cy="4" r="3.5" fill="#E9B530" stroke="#7A4A06" strokeWidth="2" />
      <circle cx="56" cy="8" r="3.5" fill="#E9B530" stroke="#7A4A06" strokeWidth="2" />
    </svg>
  );
}

export function Heart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 30" className={className} aria-hidden>
      <path d="M16 28 C-6 14 2 -4 16 7 C30 -4 38 14 16 28 Z" fill="#C3142A" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}
