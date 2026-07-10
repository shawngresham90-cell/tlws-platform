/**
 * Minimal RFC-4180 CSV parse/serialize. No dependency: the import/export
 * surface only needs quoted fields, embedded commas/quotes/newlines, and
 * CRLF tolerance — ~60 lines beats a new package in the server bundle.
 * Pure functions, no imports: safe anywhere, trivially testable.
 */

/** Parse CSV text into rows of string cells. Handles quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  // trailing cell/row (file not ending in a newline)
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // drop fully-empty rows (blank lines)
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize rows to CSV text (CRLF line endings for spreadsheet apps). */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows
    .map((row) => row.map((c) => escapeCell(c == null ? '' : String(c))).join(','))
    .join('\r\n');
}
