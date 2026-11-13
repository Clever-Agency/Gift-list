import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// База — gzip всех *.js в apps/web/public/_expo на dc10567, до Story 1.9.
// 2026-11-07 бюджет был 150 КиБ (153 600). После историй на main прирост стал
// 156 480 даже без словаря из 4055 Material Symbols (его заменил список из
// четырёх имён в apps/mobile). 160 КиБ (163 840) держался до CLE-70/CLE-89:
// кнопки подписки в поиске подняли прирост до 164 528 (превышение 688 байт
// в CI PR #73). 165 КиБ (168 960) закрывает этот замер с запасом около 4 КиБ.
// В epics.md по-прежнему «150 КБ».
export const BASE_GZIP_BYTES = 487_792;
export const BUDGET_GROWTH_BYTES = 168_960;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Сумма gzip (zlib по умолчанию) каждого `*.js` в каталоге. `null`, если каталога нет. */
export async function measureJsGzip(dir) {
  const files = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && path.extname(entry.name) === ".js") files.push(full);
    }
  }
  try {
    await walk(dir);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
    throw error;
  }
  files.sort();
  let total = 0;
  for (const file of files) total += gzipSync(await readFile(file)).length;
  return { files: files.length, total };
}

function readCount(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) {
    console.error(`${name} должно быть целым числом байт, получено ${JSON.stringify(raw)}`);
    process.exit(1);
  }
  return Number(raw);
}

function report(measured, base, budget) {
  const growth = measured.total - base;
  const over = growth - budget;
  const lines = [
    `Файлов JS: ${measured.files}`,
    `gzip: ${measured.total} байт`,
    `база: ${base} байт`,
    `прирост: ${growth} байт`,
    `бюджет прироста: ${budget} байт`,
    over > 0 ? `превышение: ${over} байт` : `запас: ${budget - growth} байт`,
  ];
  console.log(lines.join("\n"));
  return over > 0 ? 1 : 0;
}

async function main() {
  const dir = process.env.GIFT_LIST_WEB_JS_DIR ?? path.join(root, "apps/web/public/_expo");
  const base = readCount("GIFT_LIST_WEB_JS_BASE", BASE_GZIP_BYTES);
  const budget = readCount("GIFT_LIST_WEB_JS_BUDGET", BUDGET_GROWTH_BYTES);
  const measured = await measureJsGzip(dir);
  if (!measured) {
    console.error(`Нет каталога ${dir}. Сначала соберите веб: npm run build.`);
    process.exit(1);
  }
  if (measured.files === 0) {
    console.error(`В ${dir} нет файлов *.js.`);
    process.exit(1);
  }
  process.exit(report(measured, base, budget));
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  await main();
}
