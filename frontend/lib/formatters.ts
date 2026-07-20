/**
 * Financial display formatters.
 * Keep all number formatting logic here  - never inline it in components.
 */

/** Format a currency value: $1,234.56 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency = "USD",
  compact = false,
): string {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) return " -";

  if (compact && Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (compact && Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/** Format a percentage: +12.34% */
export function formatPercent(value: number | string | null | undefined, showSign = true): string {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) return " -";
  const sign = showSign && num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

/** Format a large number with commas: 1,234,567 */
export function formatNumber(value: number | string | null | undefined, decimals = 2): string {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) return " -";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/** Format a quantity (shares): 1,234.5678 */
export function formatQuantity(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) return " -";
  // Show up to 8 decimal places, strip trailing zeros
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(num);
}

/** Format a date: Mar 4, 2025 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return " -";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return " -";
  }
}

/** Returns Tailwind class for P&L colouring. */
export function pnlClass(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num) || num === 0) return "pnl-neutral";
  return num > 0 ? "pnl-positive" : "pnl-negative";
}

/** Returns Tailwind class for a colored change pill. */
export function changePillClass(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num) || num === 0) return "change-pill-neutral";
  return num > 0 ? "change-pill-gain" : "change-pill-loss";
}

/** Format a relative time string: "2h ago", "3d ago", etc. */
export function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "";
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Compact currency: -$18K, $1.2M, $450 */
export function formatCompact(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) return " -";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Returns a P&L display string: +$1,234.56 */
export function formatPnl(value: number | string | null | undefined, currency = "USD"): string {
  const num = Number(value);
  if (isNaN(num) || value === null || value === undefined) return " -";
  const abs = formatCurrency(Math.abs(num), currency);
  return num >= 0 ? `+${abs}` : `-${abs.replace("-", "")}`;
}

/**
 * Strip markdown / formatting symbols from AI-generated text before display.
 * The AI prompts already forbid markdown (plain human language, line breaks for
 * structure), but models drift, so this is the guaranteed backstop so stray
 * `**bold**`, headers, or bullet markers never reach the UI as "weird signs".
 * Line breaks are preserved (structure the model is told to use).
 */
export function stripAiMarkdown(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")  // **bold** (across lines too)
    .replace(/__([\s\S]+?)__/g, "$1")      // __bold__
    .replace(/`([^`]+)`/g, "$1")           // `inline code`
    // Line-leading markers: match only horizontal whitespace ([ \t]) for indent so
    // a blank line before a marker is never consumed (paragraph breaks preserved).
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")   // # headers
    .replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "")    // - / * bullet markers
    .replace(/^[ \t]{0,3}\d+\.[ \t]+/gm, "")    // 1. numbered list markers
    // Voice guardrail backstop: models occasionally drift an em/en-dash in
    // despite the prompt rule — normalise a spaced dash to a comma so AI
    // output stays plain. Unspaced em-dashes become a comma too.
    .replace(/[ \t]*[—–][ \t]*/g, ", ");
}
