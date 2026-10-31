import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "../..");
const mobileRoot = path.join(repoRoot, "apps/mobile");
const exportDir = path.join(mobileRoot, ".spa-export");
const publicDir = path.join(webRoot, "public");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const stagingDir = `${publicDir}.staging`;

await rm(exportDir, { recursive: true, force: true });
await rm(stagingDir, { recursive: true, force: true });
await mkdir(exportDir, { recursive: true });

run(
  "npm",
  ["exec", "-w", "@gift-list/mobile", "--", "expo", "export", "--platform", "web", "--output-dir", exportDir],
  repoRoot,
);

await cp(exportDir, stagingDir, { recursive: true });

const indexPath = path.join(stagingDir, "index.html");
const html = absolutizeAssetUrls(await readFile(indexPath, "utf8"));
await writeFile(path.join(stagingDir, "spa-index.html"), html);
await rm(indexPath);
await rm(publicDir, { recursive: true, force: true });
await rename(stagingDir, publicDir);

/** Root-relative asset URLs so the single-page shell works on every SPA route. */
function absolutizeAssetUrls(source) {
  return source.replace(/(\s(?:src|href)=)(["'])([^"']+)\2/g, (match, attr, quote, url) => {
    if (/^(?:[a-z]+:|\/\/|#|\/)/i.test(url)) return match;
    return `${attr}${quote}/${url.replace(/^\.\//, "")}${quote}`;
  });
}
