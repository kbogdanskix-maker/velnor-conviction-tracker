/**
 * Export utilities — CSV download for financial data.
 * No dependencies required.
 */

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * Convert an array of objects to a CSV string.
 * Handles commas, quotes, and newlines in values.
 */
export function toCSV(rows: Row[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0) return "";

  // Auto-detect columns from first row if not specified
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const header = cols.map((c) => escapeCSV(c.label)).join(",");
  const body = rows
    .map((row) =>
      cols.map((c) => escapeCSV(String(row[c.key] ?? ""))).join(",")
    )
    .join("\n");

  return `${header}\n${body}`;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType = "text/csv") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export rows as a CSV file download.
 */
export function exportCSV(
  rows: Row[],
  filename: string,
  columns?: { key: string; label: string }[],
) {
  const csv = toCSV(rows, columns);
  downloadFile(csv, filename);
}
