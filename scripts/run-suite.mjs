import { realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

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
        "scripts/generate-brand-icons.test.mjs",
        "scripts/measure-web-size.test.mjs",
        "scripts/run-suite.test.mjs",
      ],
    ],
  ];
}

// Эти тесты читают исходники с диска или обходят дерево приложения.
const sourceChecks = {
  web: ["src/actions/read-guard.test.ts", "src/actions/gifts.test.ts"],
  mobile: [
    "src/i18n/keys.test.ts",
    "src/navigation/app-link-routes.test.tsx",
    "src/ui/component-names.test.tsx",
    "src/ui/material-symbols.test.ts",
  ],
};

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr?.trim() || "Git недоступен");
  return result.stdout;
}

function changedFiles(baseRef) {
  const base = git(["rev-parse", "--verify", "--end-of-options", `${baseRef ?? "origin/staging"}^{commit}`]).trim();
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  const diff = git(["diff", "--no-renames", "--name-status", "-z", baseRef ? `${mergeBase}..HEAD` : mergeBase, "--"]);
  const fields = diff.split("\0");
  const changes = [];
  for (let index = 0; index < fields.length - 1; index += 2) {
    changes.push({ status: fields[index], file: fields[index + 1] });
  }
  if (!baseRef) {
    const untracked = git(["ls-files", "--others", "--exclude-standard", "-z", "--", ".", ":(exclude).codex/config.toml"]);
    for (const file of untracked.split("\0").filter(Boolean)) changes.push({ status: "A", file });
  }
  return changes;
}

function fullAffectedRun(reason) {
  console.log(`Выборочный прогон: полный набор (${reason}).`);
  return defaultSteps();
}

function vitestStep(app, files) {
  const cwd = path.join(root, "apps", app);
  const require = createRequire(path.join(cwd, "package.json"));
  const vitest = path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs");
  const related = [...new Set([...files, ...sourceChecks[app]])];
  console.log(`Выборочный прогон: apps/${app}, изменённых файлов: ${files.length}.`);
  return [process.execPath, [vitest, "related", "--run", "--passWithNoTests", ...related], cwd];
}

export function planAffectedTests(changes) {
  const filesByApp = { web: [], mobile: [] };
  for (const { status, file } of changes) {
    if (/^_bmad-output\/planning-artifacts\/ux-designs\/.*\/DESIGN\.md$/.test(file)) {
      return { fullReason: `${status} ${file}` };
    }
    if (/^(?:docs|_bmad-output)\/.*\.md$|^(?:README|AGENTS)\.md$/.test(file)) continue;
    if (status === "M" && file === "_bmad-output/implementation-artifacts/sprint-status.yaml") continue;
    const appSource = /^apps\/(web|mobile)\/((?:app|src)\/.*\.(?:[cm]?[jt]sx?|json|css))$/.exec(file);
    if (!appSource || !["A", "M"].includes(status) || file.startsWith("apps/mobile/src/test/")) {
      return { fullReason: `${status} ${file}` };
    }
    const [, app, localPath] = appSource;
    filesByApp[app].push(localPath);
  }
  return { filesByApp };
}

function affectedSteps(baseRef) {
  let changes;
  try {
    changes = changedFiles(baseRef);
  } catch (error) {
    return fullAffectedRun(error.message);
  }
  const { filesByApp, fullReason } = planAffectedTests(changes);
  if (fullReason) return fullAffectedRun(fullReason);
  const steps = [];
  for (const [app, files] of Object.entries(filesByApp)) {
    if (files.length) steps.push(vitestStep(app, files));
  }
  if (!steps.length) console.log("Выборочный прогон: изменений в приложениях нет.");
  return [...steps, defaultSteps()[1]];
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

function run(command, args, cwd = root) {
  const result = spawnSync(command, args ?? [], {
    cwd,
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
  const { values } = parseArgs({ options: { affected: { type: "boolean" }, base: { type: "string" } } });
  const steps = values.affected ? affectedSteps(values.base) : configuredSteps();
  const statuses = [];
  for (const [command, args, cwd] of steps) {
    statuses.push(run(command, args, cwd));
  }
  process.exit(firstFailure(statuses));
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  main();
}
