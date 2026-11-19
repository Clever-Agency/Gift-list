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
 *
 * Story 5.5 adds the one sanctioned A-14 read: «Мои брони» is read by
 * `reservedById` and must keep working after an unfriend or a block, so it does
 * not pass the gate. The exemption is exactly one `.gift.findMany` whose
 * `select` is the closed reservation card — no price, link, token or owner name.
 */
const WISHLIST_READ = path.resolve(fileURLToPath(new URL("./wishlist-read.ts", import.meta.url)));
const STATUS_SERVICE = path.resolve(
  fileURLToPath(new URL("../lib/gift-status-store.ts", import.meta.url)),
);
const MY_RESERVATIONS_READ = path.resolve(
  fileURLToPath(new URL("./my-reservations.ts", import.meta.url)),
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

/** The closed A-14 card `select` of `my-reservations.ts`, same normalisation. */
const RESERVATION_CARD_SELECT =
  "{id:true,status:true,title:true,titleSnapshotOnReserve:true,reservationDueAt:true," +
  "reservationTimeZone:true,reservationPhase:true,reservationBought:true," +
  "holderVisibleToOwner:true,holderVisibleToOthers:true,visibility:true,archivedAt:true," +
  "reservedById:true,list:{select:{ownerId:true,owner:{select:{nick:true}}}}}";

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
    if (resolved === MY_RESERVATIONS_READ && isReservationCardScan(text)) continue;
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
  return objectAt(text, open) === EXPIRY_SELECT;
}

/**
 * Story 5.5 (A-14): «Мои брони» reads `Gift` outside the gate on purpose, so the
 * file is exempt only while it keeps exactly one `.gift.findMany` with the
 * closed card `select`. The select may be inline or a named constant.
 */
function isReservationCardScan(text: string): boolean {
  return findManySelectShape(text) === RESERVATION_CARD_SELECT;
}

/** Normalised shape of the single `findMany` select in a file, or `null`. */
function findManySelectShape(text: string): string | null {
  if (countFindMany(text) !== 1) return null;
  if (/\.gift\.(?:groupBy|count)\s*\(/.test(text) || rawGiftQueries(text).length > 0) return null;
  const call = text.search(/\.gift\.findMany\s*\(/);
  const select = /select:\s*(\{|[A-Za-z_$][\w$]*)/.exec(text.slice(call));
  if (!select) return null;
  const at = call + select.index + select[0].length - 1;
  if (select[1] === "{") return objectAt(text, at);

  const name = select[1];
  const declaration = new RegExp(`\\b${name}\\s*=\\s*\\{`).exec(text);
  if (!declaration) return null;
  return objectAt(text, declaration.index + declaration[0].length - 1);
}

/** The object literal starting at `open`, whitespace and trailing commas removed. */
function objectAt(text: string, open: number): string {
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  return text
    .slice(open, end + 1)
    .replace(/\s+/g, "")
    .replace(/,}/g, "}");
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

  it("lets «Мои брони» read only the closed reservation card select", async () => {
    const text = await readFile(MY_RESERVATIONS_READ, "utf8");
    expect(isReservationCardScan(text)).toBe(true);

    const wider = text.replace("id: true,", "id: true, publicToken: true,");
    expect(wider).not.toBe(text);
    expect(isReservationCardScan(wider)).toBe(false);
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
