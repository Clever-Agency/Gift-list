import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneApp = path.join(webRoot, ".next/standalone/apps/web");

await mkdir(path.join(standaloneApp, ".next"), { recursive: true });
await cp(path.join(webRoot, "public"), path.join(standaloneApp, "public"), { recursive: true });
await cp(path.join(webRoot, ".next/static"), path.join(standaloneApp, ".next/static"), {
  recursive: true,
});
