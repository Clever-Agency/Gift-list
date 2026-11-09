import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import symbols from "./material-symbols.json";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".expo") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(full)));
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe("material symbols", () => {
  it("веб-сборка знает каждый android/web символ приложения", async () => {
    const names = new Set<string>();
    for (const file of await sourceFiles(path.join(mobileRoot, "src"))) {
      const text = await readFile(file, "utf8");
      for (const match of text.matchAll(/(?:android|web):\s*"([a-z0-9_]+)"/g)) {
        names.add(match[1]);
      }
    }
    expect([...names].sort()).toEqual(Object.keys(symbols).sort());
  });
});
