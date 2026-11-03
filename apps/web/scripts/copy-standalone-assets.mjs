import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(webRoot, ".next/standalone");
const standaloneApp = path.join(standaloneRoot, "apps/web");

await mkdir(path.join(standaloneApp, ".next"), { recursive: true });
await cp(path.join(webRoot, "public"), path.join(standaloneApp, "public"), { recursive: true });
await cp(path.join(webRoot, ".next/static"), path.join(standaloneApp, ".next/static"), {
  recursive: true,
});

// next build копирует .env* в standalone вне трассировки; конфигурация идёт только из process.env.
async function removeEnvFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") await removeEnvFiles(full);
    } else if (entry.name.startsWith(".env")) {
      await rm(full, { force: true });
      console.log(`Удалён ${path.relative(webRoot, full)}`);
    }
  }
}

await removeEnvFiles(standaloneRoot);
