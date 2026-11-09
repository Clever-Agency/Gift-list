import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { measureJsGzip } from "./measure-web-size.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/measure-web-size.mjs");
const dirs = [];

after(async function cleanUp() {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

async function fixture(files) {
  const dir = await mkdtemp(path.join(tmpdir(), "gift-list-web-js-"));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(dir, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  return dir;
}

function run(env) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("measure-web-size", () => {
  it("суммирует gzip только *.js и совпадает с gzipSync по умолчанию", async () => {
    const source = "console.log(1)";
    const other = "export const x = 1\n";
    const dir = await fixture({
      "static/app.js": source,
      "static/app.js.map": "{".repeat(400),
      "style.css": "body{color:red}",
      "notes.mjs": "export {}",
      "root.js": other,
    });
    const measured = await measureJsGzip(dir);
    assert.equal(measured.files, 2);
    assert.equal(
      measured.total,
      gzipSync(Buffer.from(source)).length + gzipSync(Buffer.from(other)).length,
    );
  });

  it("на границе бюджета код 0 и в выводе запас 0", async () => {
    const dir = await fixture({ "app.js": "ok" });
    const measured = await measureJsGzip(dir);
    const result = run({
      GIFT_LIST_WEB_JS_DIR: dir,
      GIFT_LIST_WEB_JS_BASE: "0",
      GIFT_LIST_WEB_JS_BUDGET: String(measured.total),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`gzip: ${measured.total} байт`));
    assert.match(result.stdout, /запас: 0 байт/);
  });

  it("прирост больше бюджета: код 1 и превышение", async () => {
    const dir = await fixture({ "app.js": "ok" });
    const measured = await measureJsGzip(dir);
    const result = run({
      GIFT_LIST_WEB_JS_DIR: dir,
      GIFT_LIST_WEB_JS_BASE: "0",
      GIFT_LIST_WEB_JS_BUDGET: String(measured.total - 1),
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /превышение: 1 байт/);
  });

  it("нет каталога: код 1", () => {
    const missing = path.join(tmpdir(), "gift-list-web-js-missing", "no-such-dir");
    const result = run({ GIFT_LIST_WEB_JS_DIR: missing });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Нет каталога/);
  });
});
