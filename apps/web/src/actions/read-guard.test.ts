import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * AD-7: a viewer-facing `Gift` read belongs in the gated wishlist read.
 * Story 2.6 adds a second `findMany` there for the owner's archive (plus its
 * `count`). The status adapter also scans expiry candidates by status; that is
 * not a visibility bypass: the scan selects only `id`, `expiresOn` and the
 * owner's time zone, and writes `archivedAt` through the CAS, never a card.
 * So the adapter is exempt only for exactly one `.gift.findMany` with that
 * narrow `select`.
 */
const WISHLIST_READ = path.resolve(fileURLToPath(new URL("./wishlist-read.ts", import.meta.url)));
const STATUS_SERVICE = path.resolve(
  fileURLToPath(new URL("../lib/gift-status-store.ts", import.meta.url)),
);
const SRC = path.resolve(path.dirname(WISHLIST_READ), "..");

const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SKIP_RELATIVE_DIRS = new Set([path.join("db", "generated")]);
const ADVICE = "читайте желания через readWishlist (AD-7)";

/** Prisma calls that could bypass `VisibilityPolicy` when pointed at `Gift`. */
const GIFT_READS = [/\.gift\.findMany\s*\(/, /\.gift\.groupBy\s*\(/, /\.gift\.count\s*\(/] as const;
const GIFT_FIND_MANY = /\.gift\.findMany\s*\(/g;
const RAW_QUERY = /\$queryRaw(?:Unsafe)?/g;

/** The one allowed scan `select`, whitespace removed, nested form included. */
const EXPIRY_SELECT = "{id:true,expiresOn:true,list:{select:{owner:{select:{timeZone:true}}}}}";

type Violation = { readonly file: string; readonly call: string };

function isTestFile(name: string): boolean {
  return name.endsWith(".test.ts") || name.endsWith(".test.tsx");
}

function isSource(name: string): boolean {
  return (name.endsWith(".ts") || name.endsWith(".tsx")) && !isTestFile(name);
}

/** Every non-test `.ts` / `.tsx` source under `apps/web/src`, generated Prisma output aside. */
async function* sources(
  dir = SRC,
  relative = "",
): AsyncGenerator<{
  file: string;
  relative: string;
}> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    const childRelative = relative === "" ? entry.name : path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || SKIP_RELATIVE_DIRS.has(childRelative)) continue;
      yield* sources(file, childRelative);
    } else if (entry.isFile() && isSource(entry.name)) {
      yield { file, relative: childRelative };
    }
  }
}

/** Skips a TypeScript generic argument list (`$queryRaw<Row[]>`), if any. */
function afterGeneric(text: string, start: number): number {
  let i = start;
  while (i < text.length && /\s/.test(text[i] ?? "")) i++;
  if (text[i] !== "<") return i;
  let depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === "<") depth++;
    else if (text[i] === ">" && --depth === 0) return i + 1;
  }
  return text.length;
}

/** SQL of one `$queryRaw` call: its template literal or its string argument. */
function rawQuerySql(text: string, start: number): string {
  const from = afterGeneric(text, start);
  const delimiter = text[from] ?? "";
  if (delimiter !== "`" && delimiter !== '"' && delimiter !== "'") return "";
  const bodyStart = from + 1;
  const bodyEnd = text.indexOf(delimiter, bodyStart);
  return text.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd);
}

/** `$queryRaw` calls whose SQL names the `"Gift"` table. */
function rawGiftQueries(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(RAW_QUERY)) {
    if (rawQuerySql(text, match.index ?? 0).includes('"Gift"')) found.push(match[0]);
  }
  return found;
}

async function findViolations(): Promise<Violation[]> {
  const violations: Violation[] = [];
  for await (const { file, relative } of sources()) {
    const resolved = path.resolve(file);
    if (resolved === WISHLIST_READ) continue;
    const text = await readFile(file, "utf8");
    if (resolved === STATUS_SERVICE && isNarrowExpiryScan(text)) continue;
    for (const call of GIFT_READS) {
      if (call.test(text)) violations.push({ file: relative, call: String(call) });
    }
    for (const call of rawGiftQueries(text)) violations.push({ file: relative, call });
  }
  return violations;
}

/**
 * The adapter's only allowed `Gift` read: one `.gift.findMany` whose `select`
 * holds `id`, `expiresOn` and `list` and nothing else, and no other read kind.
 */
function isNarrowExpiryScan(text: string): boolean {
  if (countFindMany(text) !== 1) return false;
  if (/\.gift\.(?:groupBy|count)\s*\(/.test(text) || rawGiftQueries(text).length > 0) return false;
  const call = text.search(/\.gift\.findMany\s*\(/);
  const select = /select:\s*\{/.exec(text.slice(call));
  if (!select) return false;
  const open = call + select.index + select[0].length - 1;
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const normalized = text
    .slice(open, end + 1)
    .replace(/\s+/g, "")
    .replace(/,}/g, "}");
  return normalized === EXPIRY_SELECT;
}

function countFindMany(text: string): number {
  return text.match(new RegExp(GIFT_FIND_MANY.source, "g"))?.length ?? 0;
}

describe("gift read guard (AD-7)", () => {
  it("lets the status adapter scan only id, expiresOn and list", async () => {
    const text = await readFile(STATUS_SERVICE, "utf8");
    expect(isNarrowExpiryScan(text)).toBe(true);
    const wide = text.replace(/(select:\s*\{\s*id: true,)/, "$1 title: true,");
    expect(wide).not.toBe(text);
    expect(isNarrowExpiryScan(wide)).toBe(false);
    const nested = text.replace(
      "owner: { select: { timeZone: true } }",
      "owner: { select: { timeZone: true, email: true } }",
    );
    expect(nested).not.toBe(text);
    expect(isNarrowExpiryScan(nested)).toBe(false);
  });

  it("reads Gift rows only inside readWishlist", async () => {
    const violations = await findViolations();
    const report = violations.map(({ file, call }) => `${file}: ${call} — ${ADVICE}`).join("\n");
    expect(violations, `Прямое чтение Gift вне readWishlist:\n${report}`).toEqual([]);
  });

  it("keeps the active list and the owner archive inside wishlist-read.ts", async () => {
    const text = await readFile(WISHLIST_READ, "utf8");

    expect(
      countFindMany(text),
      `${WISHLIST_READ}: ожидались два gift.findMany — активные желания и архив владельца`,
    ).toBe(2);
  });
});
