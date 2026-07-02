/**
 * Utilities for SQL identifier navigation (Ctrl/Cmd + click on table/column names).
 */

const SQL_KEYWORDS_SET = new Set([
  "select",
  "from",
  "where",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "on",
  "group",
  "by",
  "order",
  "asc",
  "desc",
  "having",
  "limit",
  "offset",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "view",
  "as",
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "like",
  "distinct",
  "union",
  "all",
  "exists",
  "between",
  "case",
  "when",
  "then",
  "else",
  "end",
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "coalesce",
  "cast",
  "alter",
  "drop",
  "add",
  "column",
  "index",
  "primary",
  "key",
  "foreign",
  "references",
  "constraint",
  "default",
  "check",
  "unique",
  "begin",
  "commit",
  "rollback",
  "truncate",
  "explain",
  "analyze",
  "with",
  "recursive",
  "over",
  "partition",
  "row_number",
  "rank",
  "dense_rank",
  "lag",
  "lead",
  "first_value",
  "last_value",
  "ntile",
  "cross",
  "full",
  "natural",
  "using",
  "lateral",
  "unnest",
  "filter",
  "exclude",
  "replace",
  "qualify",
  "pivot",
  "unpivot",
  "asof",
  "positional",
  "anti",
  "semi",
  "sample",
  "struct",
  "map",
  "list",
  "array",
  "lambda",
  "copy",
  "export",
  "import",
  "describe",
  "show",
  "summarize",
  "pragma",
  "tablesample",
  "read_csv",
  "read_parquet",
  "read_json",
  "list_transform",
]);

/** Extract identifier at position `pos` in the document. */
export function extractIdentifierAt(doc: string, pos: number): string | null {
  if (pos < 0 || pos >= doc.length) return null;

  const isId = (c: string) => /\w/.test(c);
  const isQuote = (c: string) => c === "`" || c === '"';

  // Find bounds of a segment (quoted or unquoted) at position p
  const bounds = (p: number): [number, number] | null => {
    const c = doc[p];
    if (isQuote(c)) {
      // Walk backwards past quote/id chars to find the true opening quote
      let s = p;
      while (s >= 0 && (doc[s] === c || isId(doc[s]))) s--;
      s++;
      const e = doc.indexOf(c, s + 1);
      return e < 0 ? null : [s, e + 1];
    }
    if (isId(c)) {
      let s = p;
      while (s > 0 && isId(doc[s - 1])) s--;
      let e = p;
      while (e < doc.length && isId(doc[e])) e++;
      return [s, e];
    }
    return null;
  };

  const seg = bounds(pos);
  if (!seg) return null;

  // Extend backward: look for `qualifier.`, skipping closing quotes
  let [start, end] = seg;
  while (start > 0) {
    let prevPos = start - 1;
    while (prevPos >= 0 && isQuote(doc[prevPos])) prevPos--;
    if (prevPos < 0 || doc[prevPos] !== ".") break;
    const prev = bounds(prevPos - 1);
    if (!prev) break;
    start = prev[0];
  }

  // Extend forward: look for `.qualifier`, skipping closing quotes
  while (end < doc.length) {
    let nextPos = end;
    while (nextPos < doc.length && isQuote(doc[nextPos])) nextPos++;
    if (nextPos >= doc.length || doc[nextPos] !== ".") break;
    const next = bounds(nextPos + 1);
    if (!next) break;
    end = next[1];
  }

  // For qualified identifiers, ensure surrounding quotes are included
  if (doc.slice(start, end).includes(".")) {
    while (start > 0 && isQuote(doc[start - 1])) start--;
    while (end < doc.length && isQuote(doc[end])) end++;
  }

  return doc.slice(start, end);
}

/** Check whether the identifier is a SQL keyword (not a table/column name). */
export function isSqlKeyword(identifier: string): boolean {
  return SQL_KEYWORDS_SET.has(identifier.toLowerCase());
}

/** Split a qualified identifier like `schema`.table into its parts, stripping surrounding quotes. */
export function splitQualifiedIdentifier(identifier: string): { qualifier: string | null; name: string } {
  const strip = (s: string) => s.replace(/[`"]/g, "");
  let dotIdx = -1;
  let quoted = false;
  for (let i = 0; i < identifier.length; i++) {
    const ch = identifier[i];
    if (ch === "`" || ch === '"') {
      quoted = !quoted;
    } else if (ch === "." && !quoted) {
      dotIdx = i;
      break;
    }
  }
  if (dotIdx > 0) {
    return { qualifier: strip(identifier.substring(0, dotIdx)), name: strip(identifier.substring(dotIdx + 1)) };
  }
  return { qualifier: null, name: identifier };
}

/** Match identifier against known table names (case-insensitive). Supports qualified identifiers like schema.table. */
export function matchTable(identifier: string, tables: Array<{ name: string; schema?: string }>): { name: string; schema?: string } | null {
  const lower = identifier.toLowerCase();
  const direct = tables.find((t) => t.name.toLowerCase() === lower);
  if (direct) return direct;

  const { qualifier, name } = splitQualifiedIdentifier(identifier);
  if (qualifier) {
    return tables.find((t) => t.name.toLowerCase() === name.toLowerCase() && t.schema?.toLowerCase() === qualifier.toLowerCase()) ?? null;
  }
  return null;
}
