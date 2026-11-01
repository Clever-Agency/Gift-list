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
  if (file !== mobileEnv && file !== mobileAppConfig && /\bprocess\.env\b/.test(text)) {
    failures.push(`${relative}: reads process.env outside src/config/env.ts`);
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

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
