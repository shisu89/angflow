/**
 * Pragmatic CSV parser for the demo backend.
 *
 * Rules (per spec):
 * - First non-empty line is the header row.
 * - First column = time/x; all other columns = value columns.
 * - Quoted fields ("foo,bar") supported; escape via doubled quote ("").
 * - Empty cells in value columns parse to null.
 * - Value cells must be numeric or empty; otherwise error.
 * - Time parsing: Number(v) → if >= 1e12 treat as ms; if >= 1e9 treat as
 *   seconds (→ *1000); else treat as plain numeric x (pass through as ms-like).
 *   If Number(v) is NaN, try Date.parse(v); if NaN, error.
 * - A single bad row fails the whole parse with the row number + column name.
 *
 * This is deliberately NOT a production-grade RFC 4180 implementation.
 * Good enough for the demo; swap for papaparse if you need more.
 */

export interface ParsedCsv {
  /** Column names in source order, including the time column first. */
  headerColumns: string[];
  /** Value column names (everything except the first/time column). */
  availableColumns: string[];
  /** Unix ms, sorted ascending by parse order (not re-sorted). */
  time: number[];
  /** Column name -> parallel array of same length as `time`. */
  columns: Record<string, Array<number | null>>;
}

export class CsvParseError extends Error {
  constructor(message: string, public row?: number, public column?: string) {
    super(message);
  }
}

/**
 * Tokenize a single CSV line into fields, honoring quoted fields and
 * doubled-quote escapes.
 */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    let field = '';
    if (i < n && line[i] === '"') {
      // quoted field
      i++;
      while (i < n) {
        if (line[i] === '"') {
          if (i + 1 < n && line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // closing quote
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
    } else {
      while (i < n && line[i] !== ',') {
        field += line[i];
        i++;
      }
    }
    fields.push(field);
    if (i < n && line[i] === ',') {
      i++;
      if (i === n) {
        // trailing comma → empty final field
        fields.push('');
        break;
      }
    } else {
      break;
    }
  }
  return fields;
}

/**
 * Split on LF/CRLF and drop lines that are entirely blank (after trim).
 */
function splitLines(raw: string): string[] {
  return raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function parseTimeCell(raw: string, row: number): number {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new CsvParseError(`Empty time value`, row, 'time');
  }
  const asNum = Number(trimmed);
  if (!Number.isNaN(asNum)) {
    if (asNum >= 1e12) return asNum;              // already ms
    if (asNum >= 1e9) return asNum * 1000;        // seconds → ms
    return asNum;                                 // plain numeric x
  }
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) return asDate;
  throw new CsvParseError(`Unparseable time: "${trimmed}"`, row, 'time');
}

function parseValueCell(raw: string, row: number, column: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const asNum = Number(trimmed);
  if (Number.isNaN(asNum)) {
    throw new CsvParseError(`Non-numeric value "${trimmed}"`, row, column);
  }
  return asNum;
}

export function parseCsv(raw: string): ParsedCsv {
  const lines = splitLines(raw);
  if (lines.length < 2) {
    throw new CsvParseError('CSV must have a header row and at least one data row');
  }

  const headerColumns = parseLine(lines[0]).map((h) => h.trim());
  if (headerColumns.length < 2) {
    throw new CsvParseError('CSV must have at least 2 columns (time + 1 value)');
  }
  const availableColumns = headerColumns.slice(1);

  const time: number[] = [];
  const columns: Record<string, Array<number | null>> = {};
  for (const col of availableColumns) columns[col] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    const rowNumber = i + 1; // 1-indexed for humans
    if (fields.length !== headerColumns.length) {
      throw new CsvParseError(
        `Expected ${headerColumns.length} fields, got ${fields.length}`,
        rowNumber,
      );
    }
    time.push(parseTimeCell(fields[0], rowNumber));
    for (let c = 1; c < headerColumns.length; c++) {
      const col = headerColumns[c];
      columns[col].push(parseValueCell(fields[c], rowNumber, col));
    }
  }

  return { headerColumns, availableColumns, time, columns };
}
