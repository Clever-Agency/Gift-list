import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { getMessages } from "@gift-list/contracts";
import { describe, expect, it } from "vitest";

/**
 * The header of `/search` once asked for `brandName` in the `app` namespace while
 * the key lives in `common`, and the screen printed the raw `app.brandName`
 * instead of the product name. The catalogs are plain JSON, so this test checks
 * every literal key against the namespace of the `useTranslations` call that
 * asks for it: a key in the wrong namespace fails here instead of reaching a
 * screen. Dynamic keys (template literals, variables) are out of scope.
 */
const appDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
/** Generated or installed trees hold no screen sources. */
const skip = new Set([".expo", ".spa-export", "assets", "node_modules", "public"]);

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (/\.[jt]sx?$/.test(entry.name) && !entry.name.includes(".test.")) files.push(full);
  }
  return files;
}

const messages = getMessages("ru") as unknown as Record<string, unknown>;

function keyExists(namespace: string, key: string): boolean {
  let node: unknown = messages;
  for (const part of [...namespace.split("."), ...key.split(".")]) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

describe("каталоги переводов", () => {
  it("каждый литеральный ключ существует в пространстве имён своего useTranslations", () => {
    const problems: string[] = [];

    for (const file of sourceFiles(appDir)) {
      const source = readFileSync(file, "utf8");
      const namespaces = new Map<string, string>();
      for (const match of source.matchAll(
        /(?:const|let)\s+(\w+)\s*=\s*useTranslations\("([^"]+)"\)/g,
      )) {
        namespaces.set(match[1], match[2]);
      }

      for (const [name, namespace] of namespaces) {
        for (const match of source.matchAll(new RegExp(`\\b${name}\\(\\s*"([^"]+)"`, "g"))) {
          if (keyExists(namespace, match[1])) continue;
          const line = source.slice(0, match.index).split("\n").length;
          problems.push(`${relative(appDir, file)}:${line} ${name}("${match[1]}") в ${namespace}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
