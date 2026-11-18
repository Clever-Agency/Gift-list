import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// База — gzip всех *.js в apps/web/public/_expo на dc10567, до Story 1.9.
// 2026-11-07 бюджет был 150 КиБ (153 600). После историй на main прирост стал
// 156 480 даже без словаря из 4055 Material Symbols (его заменил список из
// четырёх имён в apps/mobile). 160 КиБ (163 840) держался до CLE-70/CLE-89:
// кнопки подписки в поиске подняли прирост до 164 528 (превышение 688 байт
// в CI PR #73). 165 КиБ (168 960) держался до CLE-72: экран /friends поднял
// прирост до 174 206 (превышение 5 246 байт в CI PR #77). 175 КиБ (179 200)
// закрывает этот замер с запасом около 5 КиБ.
// 176 КиБ (180 224) — CLE-75 / Story 4.5.3: «Заблокировать» в строках людей и
// профиле поднял прирост до 179 693 (превышение 493 байта). Новых зависимостей
// и целых библиотек нет: +1 558 байт gzip на пункт меню, общий confirm (он же
// в поиске) и оптимистичный откат строк; запас 531 байт.
// 177 КиБ (181 248) — CLE-75 / Story 4.5.4: секция «Заблокированные» в настройках
// подняла прирост до 180 698 (превышение 474 байта). Новых зависимостей и
// библиотек нет: +963 байта gzip на секцию (строки PersonRow, «Разблокировать»,
// пусто/ошибка, «Показать ещё») и +44 байта новых строк в общем чанке; запас
// 550 байт. Чанков по-прежнему 18.
// 178 КиБ (182 272) — CLE-73 / Story 4.7.2: контракты ссылки-приглашения
// (`packages/contracts/src/invite-link.ts` + реэкспорт из `index.ts`) подняли
// прирост с 181 184 до 181 409 (превышение 161 байт). Новых зависимостей и
// библиотек нет: barrel-файл контрактов попадает в `__common-*.js` целиком, и
// новый закрытый словарь (`inviteLinkPreviewSchema`, `inviteLinkDataSchema`,
// `inviteLinkAcceptDataSchema`) добавил ~225 байт gzip. Чанков по-прежнему 18,
// новых файлов JS нет; клиент приложения (`apps/mobile/src/api/invite-link.ts`)
// в бандл не попал — экраны его пока не импортируют (4.7.4).
// 180 КиБ (184 320) — CLE-73 / Story 4.7.4: экран приглашения, передача
// `inviteToken` в регистрации и «Скопировать ссылку-приглашение» подняли прирост
// с 181 640 до 184 266 (превышение 1 994 байта над 178 КиБ). Новых зависимостей
// и целых библиотек нет: новый чанк маршрута `/invite` — 2 378 байт gzip
// (четыре состояния, панель, копирование), остальное — регистрация,
// «Мой вишлист» и строки каталога. Чанков по-прежнему 18. Потолок поднят на два
// минимальных шага по 1024 байта; запас 54 байта.
// 181 КиБ (185 344) — CLE-105: ключ `web.skipToContent` («Перейти к
// содержимому») добавлен в каталог `web` контрактов, а каталог целиком лежит в
// `__common-*.js` SPA-сборки, поэтому прирост 184 320 → 184 352 (+32 байта,
// превышение 32 байта). Новых зависимостей, чанков и файлов JS нет: сам
// skip-link живёт только на Next-страницах (`apps/web`) и в SPA не попадает.
// Потолок поднят на один минимальный шаг 1024 байта; запас 992 байта.
// В epics.md по-прежнему «150 КБ».
export const BASE_GZIP_BYTES = 487_792;
export const BUDGET_GROWTH_BYTES = 185_344;

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
