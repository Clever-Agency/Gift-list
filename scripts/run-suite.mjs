import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Git Bash reports the drive as `e:\` while Node's ESM loader uses the
// canonical `E:\`. Vitest then loads two copies of `@vitest/runner` and
// every suite fails with `reading 'config'`. Spawn from the canonical path.
const root = realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

// `npm` on Windows is npm.cmd. spawnSync cannot start it without a shell
// (ENOENT; spawning npm.cmd directly is EINVAL since CVE-2024-27980).
// Node itself is spawned directly: shell quoting breaks paths with spaces.
function needsShell(command) {
  return process.platform === "win32" && command === "npm";
}

function defaultSteps() {
  return [
    ["npm", ["run", "test", "--workspaces", "--if-present"]],
    [
      process.execPath,
      [
        "--test",
        "scripts/check-boundaries.test.mjs",
        "scripts/emulator-origin.test.mjs",
        "scripts/run-suite.test.mjs",
      ],
    ],
  ];
}

function configuredSteps() {
  const raw = process.env.RUN_SUITE_STEPS;
  if (!raw) return defaultSteps();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("RUN_SUITE_STEPS must be a JSON array of [command, args]");
  }
  return parsed;
}

function childEnv() {
  const env = { ...process.env };
  delete env.RUN_SUITE_STEPS;
  return env;
}

function run(command, args) {
  const result = spawnSync(command, args ?? [], {
    cwd: root,
    stdio: "inherit",
    shell: needsShell(command),
    env: childEnv(),
  });
  if (result.error) console.error(result.error.message);
  return result.status === null ? 1 : result.status;
}

export function firstFailure(statuses) {
  for (const status of statuses) {
    if (status !== 0) return status ?? 1;
  }
  return 0;
}

function main() {
  const statuses = [];
  for (const step of configuredSteps()) {
    const [command, args] = step;
    statuses.push(run(command, args));
  }
  process.exit(firstFailure(statuses));
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main();
}
