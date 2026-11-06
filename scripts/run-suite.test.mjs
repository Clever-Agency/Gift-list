import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suite = path.join(root, "scripts/run-suite.mjs");
const dirs = [];

after(async function cleanUp() {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

function runSteps(steps) {
  return spawnSync(process.execPath, [suite], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, RUN_SUITE_STEPS: JSON.stringify(steps) },
  });
}

describe("run-suite", () => {
  it("после падения первого шага выполняет второй и сохраняет код 3", async function keepsFirstFailure() {
    const dir = await mkdtemp(path.join(tmpdir(), "gift-list-suite-"));
    dirs.push(dir);
    const marker = path.join(dir, "marker.txt");
    const writeMarker = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ok")`;
    const result = runSteps([
      [process.execPath, ["-e", "process.exit(3)"]],
      [process.execPath, ["-e", writeMarker]],
    ]);
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.equal(await readFile(marker, "utf8"), "ok");
  });

  it("если первый шаг успешен, сохраняет код второго", function keepsSecondFailure() {
    const result = runSteps([
      [process.execPath, ["-e", "process.exit(0)"]],
      [process.execPath, ["-e", "process.exit(2)"]],
    ]);
    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  });
});
