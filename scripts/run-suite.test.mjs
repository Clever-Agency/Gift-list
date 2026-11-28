import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { planAffectedTests } from "./run-suite.mjs";

const sprintStatusFile = "_bmad-output/implementation-artifacts/sprint-status.yaml";
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

describe("выбор затронутых тестов", function affectedTests() {
  it("подбирает приложения по добавленным и изменённым исходникам", function selectsApps() {
    assert.deepEqual(planAffectedTests([
      { status: "M", file: "apps/web/src/lib/auth.ts" },
      { status: "A", file: "apps/mobile/app/(app)/gifts/[id]/index.tsx" },
      { status: "M", file: "docs/deployment-environments.md" },
      { status: "M", file: sprintStatusFile },
    ]), {
      filesByApp: { web: ["src/lib/auth.ts"], mobile: ["app/(app)/gifts/[id]/index.tsx"] },
    });
  });

  it("назначает полный набор для общих файлов и удалений", function usesFullSuite() {
    for (const [status, file] of [
      ["M", "packages/contracts/src/index.ts"],
      ["M", "_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md"],
      ["M", "apps/mobile/src/test/setup.tsx"],
      ["D", "apps/web/src/lib/auth.ts"],
      ["M", ".github/workflows/ci.yml"],
      ["M", "_bmad-output/implementation-artifacts/other-status.yaml"],
      ["D", sprintStatusFile],
    ]) {
      assert.deepEqual(planAffectedTests([{ status, file }]), { fullReason: `${status} ${file}` });
    }
  });

  it("для Markdown без тестовых зависимостей оставляет проверки скриптов", function skipsVitest() {
    assert.deepEqual(planAffectedTests([{ status: "M", file: "docs/deployment-environments.md" }]), {
      filesByApp: { web: [], mobile: [] },
    });
  });

  it("при обновлении только статусов спринта оставляет проверки скриптов", function skipsSprintStatus() {
    assert.deepEqual(planAffectedTests([{ status: "M", file: sprintStatusFile }]), {
      filesByApp: { web: [], mobile: [] },
    });
  });

  it("сохраняет полный прогон для общего пакета в смешанном PR", function keepsFullSuiteForMixedChanges() {
    const sharedFile = "packages/contracts/src/index.ts";
    assert.deepEqual(planAffectedTests([
      { status: "M", file: sprintStatusFile },
      { status: "M", file: "apps/web/src/lib/auth.ts" },
      { status: "M", file: sharedFile },
    ]), { fullReason: `M ${sharedFile}` });
  });
});
