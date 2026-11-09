#!/usr/bin/env node
/**
 * Expo web export with an explicit API target (R2).
 *
 *   node scripts/build-spa.mjs --mode web      same-origin (normal Next build)
 *   node scripts/build-spa.mjs --mode lan      LAN address in EXPO_PUBLIC_API_BASE_URL
 *   node scripts/build-spa.mjs --mode emulator Android emulator, 10.0.2.2 allowed
 *
 * `web` clears EXPO_PUBLIC_API_BASE_URL before Expo runs, so a local `.env`
 * written for the emulator cannot leak the emulator-only 10.0.2.2 into a bundle
 * served from localhost or a domain. Every non-emulator mode checks the baked
 * bundle after export and fails if 10.0.2.2 is still there.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { containsEmulatorOrigin } from "../../../scripts/emulator-origin.mjs";
import { validateBuildOrigins } from "../src/build/api-origin.ts";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = path.join(mobileRoot, ".spa-export");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const mode = argValue("--mode") ?? "web";
if (mode !== "web" && mode !== "lan" && mode !== "emulator") {
  console.error(`Unknown --mode "${mode}": use web, lan or emulator.`);
  process.exit(2);
}

const outputDir = path.resolve(mobileRoot, argValue("--output-dir") ?? defaultOutput);

// Validate what the caller gave us before replacing anything. A local `.env` is
// loaded later by the Expo CLI; the post-export scan catches that case too.
const check = validateBuildOrigins(mode, {
  apiBase: process.env.EXPO_PUBLIC_API_BASE_URL,
  webOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN,
});
for (const warning of check.warnings) console.warn(`warning: ${warning}`);
if (check.errors.length > 0) {
  for (const error of check.errors) console.error(`error: ${error}`);
  process.exit(1);
}

const env = { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" };
if (mode === "web") {
  // Next serves the SPA and /api/v1 from one origin (AD-26); an empty base makes
  // every request relative. This also overrides a developer `.env` value.
  env.EXPO_PUBLIC_API_BASE_URL = "";
}
if (mode === "lan" && !env.EXPO_PUBLIC_WEB_ORIGIN) {
  env.EXPO_PUBLIC_WEB_ORIGIN = env.EXPO_PUBLIC_API_BASE_URL;
}

const expoCli = resolveBin(mobileRoot, "expo", "expo");
const result = spawnSync(
  process.execPath,
  [expoCli, "export", "--platform", "web", "--output-dir", outputDir],
  { cwd: mobileRoot, stdio: "inherit", env },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

if (mode !== "emulator") {
  const hit = await findEmulatorOrigin(outputDir);
  if (hit !== null) {
    console.error(
      `error: the ${mode} bundle at ${hit} contains the emulator origin 10.0.2.2. ` +
        "Rebuild with --mode emulator or set a reachable EXPO_PUBLIC_API_BASE_URL.",
    );
    process.exit(1);
  }
}

console.log(`web build (${mode}) written to ${outputDir}`);

/** Recursively looks for the emulator host in the exported JS. */
async function findEmulatorOrigin(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findEmulatorOrigin(full);
      if (found !== null) return found;
    } else if (entry.name.endsWith(".js")) {
      const source = await readFile(full, "utf8");
      if (containsEmulatorOrigin(source)) return full;
    }
  }
  return null;
}

/** Absolute path of a package bin, resolved from `fromDir` the way npm would. */
function resolveBin(fromDir, pkg, bin) {
  const require = createRequire(path.join(fromDir, "package.json"));
  const manifestPath = require.resolve(`${pkg}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const relative = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[bin];
  if (!relative) throw new Error(`${pkg} has no "${bin}" bin`);
  return path.join(path.dirname(manifestPath), relative);
}
