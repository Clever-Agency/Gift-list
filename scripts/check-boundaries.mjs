import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css"]);

const SKIP_DIRS = new Set(["node_modules", ".expo", "dist", ".spa-export", "public", ".next"]);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "package-lock.json" || entry.name.startsWith("dist-")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (TEXT.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const failures = [];

const mobileEnv = path.join(root, "apps/mobile/src/config/env.ts");
// Expo evaluates app.config.ts with Node require, before Metro, so it cannot
// import src/config/env.ts. It may read EXPO_PUBLIC_API_BASE_URL itself.
const mobileAppConfig = path.join(root, "apps/mobile/app.config.ts");
// Metro evaluates metro.config.js with Node too; it is build-time config, not
// bundled into the app, so it may read the build-time KEEP_FNAMES flag.
const mobileMetroConfig = path.join(root, "apps/mobile/metro.config.js");
// The SPA export CLI is build-time tooling, not bundled into the app: it reads
// EXPO_PUBLIC_API_BASE_URL and writes the per-target export.
const mobileBuildScript = path.join(root, "apps/mobile/scripts/build-spa.mjs");

for await (const file of walk(path.join(root, "apps/mobile"))) {
  const text = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (
    text.includes("apps/web") ||
    text.includes("@gift-list/web") ||
    /["'](?:\.\.\/)+web(?:\/|["'])/.test(text)
  ) {
    failures.push(`${relative}: must not reference apps/web`);
  }
  if (
    file !== mobileEnv &&
    file !== mobileAppConfig &&
    file !== mobileMetroConfig &&
    file !== mobileBuildScript &&
    /\bprocess\.env\b/.test(text)
  ) {
    failures.push(`${relative}: reads process.env outside src/config/env.ts`);
  }
  if (/import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*["']react-native-safe-area-context["']/.test(text)) {
    failures.push(
      `${relative}: imports SafeAreaView from react-native-safe-area-context; use SafeArea from @gift-list/ui (AD-2, 2026-11-10)`,
    );
  }
}

const bannedSpecifier =
  /(?:import\s*(?:[^"'()]*?\sfrom\s*)?|export\s+[^"'()]*?\sfrom\s*|require\s*\(\s*|import\s*\(\s*)["'](react(?:\/[^"']*)?|react-dom(?:\/[^"']*)?|@prisma\/client(?:\/[^"']*)?|prisma(?:\/[^"']*)?)["']/;
const envRead = /process\s*(?:\?\.)?\s*(?:\.\s*env|\[\s*["']env["']\s*\])/;

for await (const file of walk(path.join(root, "packages/contracts/src"))) {
  const text = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (envRead.test(text)) failures.push(`${relative}: reads process.env`);
  if (bannedSpecifier.test(text)) failures.push(`${relative}: imports React or Prisma`);
}

// packages/ui is pure presentation: no env, Prisma, server or contracts imports.
const uiBanned =
  /(?:import\s*(?:[^"'()]*?\sfrom\s*)?|export\s+[^"'()]*?\sfrom\s*|require\s*\(\s*|import\s*\(\s*)["'](@prisma\/client(?:\/[^"']*)?|prisma(?:\/[^"']*)?|@gift-list\/(?:web|contracts)(?:\/[^"']*)?|next(?:\/[^"']*)?|expo(?:-[a-z-]+)?(?:\/[^"']*)?|@better-auth\/[^"']+|better-auth(?:\/[^"']*)?)["']/;
for await (const file of walk(path.join(root, "packages/ui/src"))) {
  const text = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (envRead.test(text)) failures.push(`${relative}: reads process.env`);
  if (uiBanned.test(text)) failures.push(`${relative}: imports Prisma, web, contracts, Next, Expo or better-auth`);
}

// AD-2: Tamagui is imported by subpath only (`@tamagui/core`, `tamagui/dialog` ...),
// never from the bare "tamagui" entry that pulls in every component.
const bareTamagui =
  /(?:import\s*(?:[^"'()]*?\sfrom\s*)?|export\s+[^"'()]*?\sfrom\s*|require\s*\(\s*|import\s*\(\s*|vi\.(?:mock|doMock|importActual)\s*\(\s*)["']tamagui["']/;

for (const dir of ["apps/mobile", "apps/web/src", "packages/ui/src"]) {
  for await (const file of walk(path.join(root, dir))) {
    // Comments may mention "tamagui" in prose; drop whole-line and block comments first.
    const text = (await readFile(file, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (bareTamagui.test(text)) {
      failures.push(
        `${path.relative(root, file)}: imports from "tamagui"; use subpaths (@tamagui/core, tamagui/dialog ...)`,
      );
    }
  }
}

// AD-28: one copy of React and Tamagui in package-lock.json. A nested
// node_modules/<...>/node_modules/<pkg> (or a workspace-local one) means a duplicate.
// GIFT_LIST_LOCKFILE lets a test point the check at a doctored copy of the lock.
const lockPath = process.env.GIFT_LIST_LOCKFILE ?? path.join(root, "package-lock.json");
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const singletons = /^(?:react|react-dom|tamagui|@tamagui\/[^/]+)$/;
const copies = new Map();
for (const [key, meta] of Object.entries(lock.packages ?? {})) {
  const at = key.lastIndexOf("node_modules/");
  if (at === -1) continue;
  const name = key.slice(at + "node_modules/".length);
  if (!singletons.test(name) || meta.link) continue;
  if (!copies.has(name)) copies.set(name, []);
  copies.get(name).push({ key, version: meta.version });
}
for (const [name, list] of copies) {
  if (list.length > 1) {
    failures.push(
      `package-lock.json: duplicate copies of ${name} (${list.map((c) => `${c.key}@${c.version}`).join(", ")}); keep one, see AD-28`,
    );
  }
}
const tamaguiVersions = new Set(
  [...copies].filter(([name]) => name !== "react" && name !== "react-dom").flatMap(([, list]) => list.map((c) => c.version)),
);
if (tamaguiVersions.size > 1) {
  failures.push(
    `package-lock.json: tamagui and @tamagui/* must share one version, found ${[...tamaguiVersions].join(", ")} (AD-28)`,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
