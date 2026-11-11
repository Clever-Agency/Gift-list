/**
 * Length of a text in Unicode code points — the unit Zod 4 measures `min()`/`max()`
 * in (`zod/v4/core/util.js` → `codePointLength`) and the unit of PostgreSQL
 * `VARCHAR(n)` (AD-22). `String#length` counts UTF-16 code units instead: a
 * character outside the BMP (an emoji) is two of them, and every `maxLength`
 * attribute of the clients counts the same way.
 *
 * One implementation for the schema, the server and both clients: a screen must
 * compare in the unit its schema uses, otherwise it rejects or cuts a value the
 * server would accept. Text outside the BMP is the only case where the two
 * units differ; a combining mark is a separate code point as well, exactly as
 * the database counts it.
 */
export function textLength(value: string): number {
  return Array.from(value).length;
}
