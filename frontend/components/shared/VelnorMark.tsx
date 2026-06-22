/**
 * Velnor brand mark — the chart-line "peaks" logo, as inline SVG.
 * Recolors via `currentColor` (set text color on a parent), so it tracks the
 * brand accent token. Scales crisply at any size (unlike the raster PNG).
 */
export default function VelnorMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 64" fill="none" className={className} aria-hidden="true">
      <polyline
        points="12,50 34,20 52,38 72,12 88,42"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="12" cy="50" r="6" fill="currentColor" />
      <circle cx="34" cy="20" r="7" fill="currentColor" />
      <circle cx="52" cy="38" r="6" fill="currentColor" />
      <circle cx="72" cy="12" r="8.5" fill="currentColor" />
      <circle cx="88" cy="42" r="6" fill="currentColor" />
    </svg>
  );
}
