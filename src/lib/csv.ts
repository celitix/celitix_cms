/**
 * Tiny CSV helpers for the Reports exports. RFC-4180 quoting: any field with a
 * comma, quote or newline is wrapped in quotes and inner quotes doubled.
 */

export type CsvColumn<T> = { key: keyof T | string; header: string; get?: (row: T) => unknown };

function esc(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const head = columns.map((c) => esc(c.header)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => esc(c.get ? c.get(r) : (r as Record<string, unknown>)[c.key as string]))
        .join(","),
    )
    .join("\n");
  return head + "\n" + body;
}

export function downloadCsv(filename: string, csv: string): void {
  // Prepend BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** A date stamp for filenames, e.g. 2026-07-30. */
export function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
