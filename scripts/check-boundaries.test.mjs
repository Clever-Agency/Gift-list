import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/check-boundaries.mjs");
const realLock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));

const tempDirs = [];
const tempFiles = [];

after(async function cleanUp() {
  for (const file of tempFiles) await rm(file, { force: true });
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
});

function run(env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

async function lockCopy(mutate) {
  const dir = await mkdtemp(path.join(tmpdir(), "gift-list-lock-"));
  tempDirs.push(dir);
  const lock = structuredClone(realLock);
  mutate?.(lock);
  const file = path.join(dir, "package-lock.json");
  await writeFile(file, JSON.stringify(lock));
  return file;
}

async function sourceFile(name, text, dir = "apps/web/src") {
  const file = path.join(root, dir, name);
  tempFiles.push(file);
  await writeFile(file, text);
  return file;
}

describe("check-boundaries", () => {
  it("чистое дерево и копия lock: код 0", async () => {
    const lock = await lockCopy();
    const result = run({ GIFT_LIST_LOCKFILE: lock });
    assert.equal(result.code, 0, result.output);
  });

  it("дубль пакета в lock: код 1 с понятным сообщением", async () => {
    const lock = await lockCopy(function duplicate(data) {
      data.packages["node_modules/@tamagui/stacks/node_modules/@tamagui/core"] = { version: "3.1.9" };
      data.packages["apps/web/node_modules/react"] = { version: "19.2.8" };
    });
    const result = run({ GIFT_LIST_LOCKFILE: lock });
    assert.equal(result.code, 1);
    assert.match(result.output, /duplicate copies of @tamagui\/core/);
    assert.match(result.output, /duplicate copies of react/);
    assert.match(result.output, /must share one version/);
  });

  it('импорт "tamagui": код 1', async () => {
    const file = await sourceFile(
      "tmp-bad-tamagui.test-fixture.ts",
      'import { Button } from "tamagui";\nexport const x = Button;\n',
    );
    const result = run();
    assert.equal(result.code, 1);
    assert.match(result.output, /tmp-bad-tamagui\.test-fixture\.ts: imports from "tamagui"/);
    await rm(file, { force: true });
  });

  it("подпуть tamagui/dialog: код 0", async () => {
    await sourceFile(
      "tmp-good-tamagui.test-fixture.ts",
      'import { Dialog } from "tamagui/dialog";\nimport { Stack } from "@tamagui/core";\nexport const x = [Dialog, Stack];\n',
    );
    const result = run();
    assert.equal(result.code, 0, result.output);
  });


  it("packages/ui/src без env, contracts, Next, Expo и better-auth: код 1 с сообщениями", async () => {
    const dir = "packages/ui/src";
    await sourceFile("tmp-env.test-fixture.ts", "export const x = process.env.X;\n", dir);
    await sourceFile("tmp-contracts.test-fixture.ts", 'import "@gift-list/contracts";\n', dir);
    await sourceFile(
      "tmp-next.test-fixture.ts",
      'import { useRouter } from "next/navigation";\nexport const r = useRouter;\n',
      dir,
    );
    await sourceFile(
      "tmp-expo.test-fixture.ts",
      'import { Link } from "expo-router";\nexport const l = Link;\n',
      dir,
    );
    await sourceFile(
      "tmp-auth.test-fixture.ts",
      'import { x } from "@better-auth/core";\nexport const a = x;\n',
      dir,
    );
    const result = run();
    assert.equal(result.code, 1);
    assert.match(result.output, /tmp-env\.test-fixture\.ts: reads process\.env/);
    for (const name of ["contracts", "next", "expo", "auth"]) {
      assert.match(
        result.output,
        new RegExp(
          `tmp-${name}\\.test-fixture\\.ts: imports Prisma, web, contracts, Next, Expo or better-auth`,
        ),
      );
    }
  });
});
