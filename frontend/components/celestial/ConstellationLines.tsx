"use client";

/**
 * Decorative constellation line pattern  - renders faint connected dots
 * in a fixed position as atmospheric background detail.
 */
export default function ConstellationLines() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-[0.04]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="constellation-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1AA8BB" />
          <stop offset="100%" stopColor="#1AA8BB" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Velnor constellation approximate pattern */}
      <g stroke="url(#constellation-grad)" strokeWidth="1" fill="none">
        <line x1="15%" y1="20%" x2="22%" y2="35%" />
        <line x1="22%" y1="35%" x2="18%" y2="55%" />
        <line x1="18%" y1="55%" x2="25%" y2="70%" />
        <line x1="22%" y1="35%" x2="35%" y2="30%" />
        <line x1="35%" y1="30%" x2="40%" y2="45%" />
      </g>
      <g fill="#1AA8BB" fillOpacity="0.6">
        <circle cx="15%" cy="20%" r="2" />
        <circle cx="22%" cy="35%" r="2.5" />
        <circle cx="18%" cy="55%" r="1.5" />
        <circle cx="25%" cy="70%" r="2" />
        <circle cx="35%" cy="30%" r="1.5" />
        <circle cx="40%" cy="45%" r="2" />
      </g>
    </svg>
  );
}
