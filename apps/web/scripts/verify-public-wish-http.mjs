/**
 * CLE-130 / Story 3.3: first HTTP responses for a public wish on the built app.
 * Run after npm run build with DISPOSABLE_DATABASE_URL, DISPOSABLE_DIRECT_URL
 * and DISPOSABLE_PG_CONFIRM pointing at a fresh, empty loopback database.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { resolveDisposableTarget } from "../src/db/disposable-pg/guard.ts";

const WEB_DIR = fileURLToPath(new URL("../", import.meta.url));
const SERVER_JS = join(WEB_DIR, ".next", "standalone", "apps", "web", "server.js");
const PRISMA_CLI = join(WEB_DIR, "..", "..", "node_modules", "prisma", "build", "index.js");
const HOST = "127.0.0.1";
const WISH_TITLE = "Тестовое желание CLE-130";
const CLOSED_TITLE = "Желание не найдено — WishMoon";

function freePort() {
  return new Promise(function reservePort(resolve, reject) {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, HOST, function onListening() {
      const { port } = probe.address();
      probe.close(function onClosed() {
        resolve(port);
      });
    });
  });
}

function request(baseUrl, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(20_000),
    ...options,
    redirect: "manual",
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    assert(child.exitCode === null, `Standalone завершился с кодом ${child.exitCode}`);
    try {
      const response = await request(baseUrl, "/", { signal: AbortSignal.timeout(3_000) });
      await response.body?.cancel();
      if (response.status === 200) return;
    } catch {
      // Standalone ещё не начал принимать запросы.
    }
    await delay(250);
  }
  throw new Error("Standalone не начал отвечать за 60 с");
}

async function register(baseUrl, role) {
  const response = await request(baseUrl, "/api/v1/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": HOST },
    body: JSON.stringify({
      email: `${role}@cle130.invalid`,
      password: `synthetic-${randomUUID()}`,
      displayName: `CLE-130 ${role}`,
      nick: `cle130_${role}`,
    }),
  });
  assert.equal(response.status, 200, `Регистрация: ${role}`);
  const result = await response.json();
  assert(result.ok && result.data?.user?.id, `Регистрация не вернула ID: ${role}`);
  const cookie = response.headers.getSetCookie().map(function cookiePair(value) {
    return value.split(";", 1)[0];
  }).join("; ");
  assert(cookie, `Регистрация не выдала сессию: ${role}`);
  return { id: result.data.user.id, cookie };
}

async function checkClosed(baseUrl, path, label, headers) {
  const response = await request(baseUrl, path, {
    headers: { "accept-language": "ru", ...headers },
  });
  assert.equal(response.status, 404, label);
  assert(!response.headers.has("location"), `${label}: в ответе 404 есть Location`);
  assert(response.headers.get("content-type")?.startsWith("text/html"), `${label}: ожидался HTML`);
  const html = await response.text();
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? "";
  assert(!html.includes(WISH_TITLE), `${label}: в HTML есть название желания`);
  assert(head.includes(`<title>${CLOSED_TITLE}</title>`), `${label}: неверный title в <head>`);
  assert(/<meta name="description" content="[^"]+"/.test(head), `${label}: в <head> нет description`);
  assert(/<meta name="robots" content="noindex(?:,[^"]*)?"/.test(head), `${label}: в <head> нет noindex`);
  console.log(`✓ ${label}: HTTP 404 без Location`);
}

async function checkSignedInWish(baseUrl, path, appPath, giftId, headers) {
  const signedIn = await request(baseUrl, path, { headers });
  await signedIn.body?.cancel();
  assert.equal(signedIn.status, 307, "Публичное желание для вошедшего зрителя");
  const location = signedIn.headers.get("location");
  assert(location === appPath, "Редирект ведёт не на выбранное желание");

  const appPage = await request(baseUrl, location, { headers });
  await appPage.body?.cancel();
  assert.equal(appPage.status, 200, "Адрес приложения из Location");
  assert(appPage.headers.get("content-type")?.startsWith("text/html"), "Приложение должно вернуть HTML");

  const appGift = await request(baseUrl, `/api/v1${location}`, { headers });
  assert.equal(appGift.status, 200, "Карточка доступна вошедшему зрителю по токену списка");
  const result = await appGift.json();
  assert(
    result.ok && result.data?.id === giftId && result.data.title === WISH_TITLE,
    "API карточки вернуло неверный ID или название",
  );
  console.log("✓ Публичное желание для вошедшего: HTTP 307 на доступную карточку приложения");
}

async function verifyWishes(baseUrl, database) {
  const owner = await register(baseUrl, "owner");
  const viewer = await register(baseUrl, "viewer");
  const { rows: [list] } = await database.query(
    'SELECT id, "publicToken" FROM "List" WHERE "ownerId" = $1',
    [owner.id],
  );
  assert(list?.publicToken, "У тестового владельца нет публичного списка");
  const giftId = randomUUID();
  await database.query(
    `INSERT INTO "Gift" (id, "listId", title, "updatedAt")
     VALUES ($1, $2, $3, now())`,
    [giftId, list.id, WISH_TITLE],
  );
  const token = encodeURIComponent(list.publicToken);
  const path = `/l/${token}/${giftId}`;
  const appPath = `/gifts/${giftId}?listToken=${token}`;
  const headers = { cookie: viewer.cookie };

  const anonymous = await request(baseUrl, path);
  assert.equal(anonymous.status, 200, "Публичное желание для анонима");
  assert(anonymous.headers.get("content-type")?.startsWith("text/html"), "Ожидался HTML");
  assert((await anonymous.text()).includes(WISH_TITLE), "В HTML отсутствует название желания");
  console.log("✓ Публичное желание для анонима: HTTP 200 и название в HTML");

  await checkSignedInWish(baseUrl, path, appPath, giftId, headers);

  await database.query('UPDATE "Gift" SET visibility = \'SECRET\' WHERE id = $1', [giftId]);
  const missing = `/l/${token}/${randomUUID()}`;
  await checkClosed(baseUrl, path, "Скрытое желание для анонима");
  await checkClosed(baseUrl, path, "Скрытое желание для вошедшего", headers);
  await checkClosed(baseUrl, missing, "Отсутствующее желание для анонима");
  await checkClosed(baseUrl, missing, "Отсутствующее желание для вошедшего", headers);
  await database.query('UPDATE "Gift" SET visibility = \'PUBLIC\' WHERE id = $1', [giftId]);

  for (const [blocker, blocked, label] of [
    [owner, viewer, "Владелец заблокировал зрителя"],
    [viewer, owner, "Зритель заблокировал владельца"],
  ]) {
    await checkSignedInWish(baseUrl, path, appPath, giftId, headers);
    const blockId = randomUUID();
    await database.query(
      `INSERT INTO "Block" (id, "blockerId", "blockedId") VALUES ($1, $2, $3)`,
      [blockId, blocker.id, blocked.id],
    );
    await checkClosed(baseUrl, path, label, headers);
    await database.query('DELETE FROM "Block" WHERE id = $1', [blockId]);
  }
}

async function main() {
  assert(existsSync(SERVER_JS), "Сначала выполните npm run build");
  const target = resolveDisposableTarget();
  const database = new Client({
    connectionString: target.directUrl,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 11_000,
  });
  await database.connect();
  try {
    const { rows: [identity] } = await database.query(
      `SELECT current_database() AS name,
              EXISTS (
                SELECT 1 FROM pg_catalog.pg_namespace AS namespace
                WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
                  AND (nspname <> 'public' OR EXISTS (
                    SELECT 1 FROM pg_catalog.pg_depend
                    WHERE refclassid = 'pg_catalog.pg_namespace'::regclass
                      AND refobjid = namespace.oid
                  ))
              ) AS used`,
    );
    assert(identity.name === target.database && !identity.used, "Ожидалась пустая одноразовая база");

    const databaseEnv = { DATABASE_URL: target.databaseUrl, DIRECT_URL: target.directUrl };
    const migration = spawnSync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
      cwd: WEB_DIR,
      env: {
        ...process.env,
        ...databaseEnv,
        // prisma.config.ts imports dotenv/config. Skip the developer's .env.
        DOTENV_CONFIG_PATH: join(WEB_DIR, `unused-${randomUUID()}.env`),
      },
      encoding: "utf8",
      timeout: 120_000,
    });
    if (migration.status !== 0) {
      const diagnostics = [migration.error?.message, migration.stdout, migration.stderr]
        .filter(Boolean)
        .join("\n")
        .replaceAll(target.databaseUrl, "[URL скрыт]")
        .replaceAll(target.directUrl, "[URL скрыт]")
        .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[URL скрыт]")
        .trim();
      throw new Error(`Не удалось применить миграции (код ${migration.status})\n${diagnostics}`);
    }

    const port = await freePort();
    const baseUrl = `http://${HOST}:${port}`;
    const server = spawn(process.execPath, [SERVER_JS], {
      env: {
        PATH: process.env.PATH,
        ...databaseEnv,
        NODE_ENV: "production",
        HOSTNAME: HOST,
        PORT: String(port),
        BETTER_AUTH_URL: baseUrl,
        BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
        CRON_SECRET: randomUUID() + randomUUID(),
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: "inherit",
    });
    const closed = once(server, "close").catch(function serverSpawnFailed(error) {
      console.error("Ошибка запуска standalone:", error.message);
    });
    try {
      await waitForServer(baseUrl, server);
      await verifyWishes(baseUrl, database);
    } finally {
      server.kill();
      await closed;
    }
  } finally {
    await database.end();
  }
}

await main();
