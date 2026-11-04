import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** AD-7: the only place that may read `Gift` rows is the gated read. */
const WISHLIST_READ = path.resolve(fileURLToPath(new URL("./wishlist-read.ts", import.meta.url)));
const SRC = path.resolve(path.dirname(WISHLIST_READ), "..");

const SKIP_DIRS = new Set(["node_modules", ".next"]);
const SKIP_RELATIVE_DIRS = new Set([path.join("db", "generated")]);
const ADVICE = "читайте желания через readWishlist (AD-7)";

/** Prisma calls that could bypass `VisibilityPolicy` when pointed at `Gift`. */
const GIFT_READS = [
  /\.gift\.findMany\s*\(/,
  /\.gift\.groupBy\s*\(/,
  /\.gift\.count\s*\(/,
] as const;
const GIFT_FIND_MANY = /\.gift\.findMany\s*\(/g;
const RAW_QUERY = /\$queryRaw(?:Unsafe)?/g;

type Violation = { readonly file: string; readonly call: string };

function isTestFile(name: string): boolean {
  return name.endsWith(".test.ts") || name.endsWith(".test.tsx");
}

function isSource(name: string): boolean {
  return (name.endsWith(".ts") || name.endsWith(".tsx")) && !isTestFile(name);
}

/** Every non-test `.ts` / `.tsx` source under `apps/web/src`, generated Prisma output aside. */
async function* sources(dir = SRC, relative = ""): AsyncGenerator<{
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
    if (path.resolve(file) === WISHLIST_READ) continue;
    const text = await readFile(file, "utf8");
    for (const call of GIFT_READS) {
      if (call.test(text)) violations.push({ file: relative, call: String(call) });
    }
    for (const call of rawGiftQueries(text)) violations.push({ file: relative, call });
  }
  return violations;
}

function countFindMany(text: string): number {
  return text.match(new RegExp(GIFT_FIND_MANY.source, "g"))?.length ?? 0;
}

describe("gift read guard (AD-7)", () => {
  it("reads Gift rows only inside readWishlist", async () => {
    const violations = await findViolations();
    const report = violations.map(({ file, call }) => `${file}: ${call} — ${ADVICE}`).join("\n");
    expect(violations, `Прямое чтение Gift вне readWishlist:\n${report}`).toEqual([]);
  });

  it("keeps exactly one gated findMany in wishlist-read.ts", async () => {
    const text = await readFile(WISHLIST_READ, "utf8");

    expect(
      countFindMany(text),
      `${WISHLIST_READ}: ожидался ровно один gift.findMany — ${ADVICE}`,
    ).toBe(1);
  });
});
