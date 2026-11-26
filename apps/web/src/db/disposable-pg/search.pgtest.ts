import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtempDisposable, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { USER_SEARCH_LIMIT, normalizeForSearch } from "@gift-list/contracts";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { searchUsers } from "../../actions/search-users";
import { updateName } from "../../actions/update-name";
import { PrismaClient } from "../generated/client";
import { checkDisposableCluster } from "./cluster-preflight";
import { resolveDisposableTarget } from "./guard";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      async getSession({ headers }: { headers: Headers }) {
        return { user: { id: headers === renameHeaders ? newProfileNick : viewerId } };
      },
    },
  },
}));
vi.mock("@/db/client", () => ({
  get prisma() {
    return prisma;
  },
}));

const migrations = new URL("../migrations/", import.meta.url);
const webDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const prismaSchema = fileURLToPath(new URL("../schema.prisma", import.meta.url));
const prismaCli = fileURLToPath(new URL("build/index.js", import.meta.resolve("prisma/package.json")));
const originalNameMigration = "20261112120000_user_search_name_normalized";
const legacyNames = ["JOSE\u0301", "ÉMILIE", "Е\u0308ЛКА И И\u0306", "ЁЖ И ЙОД", "ΟΣ", "İPEK", "Луи"];
const viewerId = "viewer";
const newProfileNick = "newprofile";
const unicodeUppercase = "\u1c89";
const unicodeLowercase = "\u1c8a";
const unicodeLegacyNick = "unicodelegacy";
const unicodeCurrentNick = "unicodecurrent";
const headers = new Headers({ "accept-language": "ru" });
const renameHeaders = new Headers();

let sql: Client | undefined;
let prisma: PrismaClient;

function searchPerson(nick: string, name: string, hideFromSearch = false) {
  return {
    id: nick,
    nick,
    nickNormalized: nick,
    email: `${nick}@search.invalid`,
    name,
    nameNormalized: normalizeForSearch(name),
    hideFromSearch,
  };
}

function numberedRows<T>(count: number, createRow: (number: string) => T): T[] {
  return Array.from({ length: count }, function numberedRow(_, index) {
    return createRow(String(index).padStart(2, "0"));
  });
}

async function search(q: string) {
  const result = await searchUsers({ q }, headers);
  if (!result.ok) throw new Error(`Поиск завершился ошибкой ${result.code}`);
  return result.data.users;
}

function runCli(args: string[], env: NodeJS.ProcessEnv) {
  execFileSync(process.execPath, args, { cwd: webDirectory, env, stdio: "pipe", timeout: 60_000 });
}

async function profileVersions(connection: Client) {
  const { rows } = await connection.query<{ id: string; version: string }>(`
    SELECT "id", xmin::text AS version FROM "User" ORDER BY "id"
  `);
  return rows;
}

async function prepareAndUpgrade(connection: Client, directUrl: string) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Запустите тесты командой npm run verify:search-postgres.");

  const fixture = await mkdtempDisposable(join(tmpdir(), "gift-search-migrations-"));
  try {
    const history = join(fixture.path, "migrations");
    const config = join(fixture.path, "prisma.config.mjs");
    const emptyEnv = join(fixture.path, "empty.env");
    const conflictingEnv = join(fixture.path, "conflicting.env");
    const alternateUrl = new URL(directUrl);
    alternateUrl.searchParams.set("schema", "unused_search_test");
    const env = {
      ...process.env,
      DATABASE_URL: alternateUrl.href,
      DIRECT_URL: directUrl,
      DOTENV_CONFIG_PATH: emptyEnv,
      PGSSLMODE: undefined,
      PGSSLNEGOTIATION: undefined,
    };
    await mkdir(history);
    await writeFile(emptyEnv, "");
    await writeFile(config, `export default {
      schema: ${JSON.stringify(prismaSchema)},
      migrations: { path: ${JSON.stringify(history)} },
      datasource: { url: process.env.DIRECT_URL },
    };\n`);
    await cp(new URL("migration_lock.toml", migrations), join(history, "migration_lock.toml"));
    const entries = await readdir(migrations, { withFileTypes: true });
    const earlierMigrations = entries.filter((entry) => entry.isDirectory() && entry.name < originalNameMigration);
    for (const entry of earlierMigrations) {
      await cp(new URL(`${entry.name}/`, migrations), join(history, entry.name), { recursive: true });
    }
    const migrateFixture = [prismaCli, "migrate", "deploy", "--config", config];
    runCli(migrateFixture, env);

    const profiles = legacyNames.map((name, index) => ({ id: `legacy${index}`, name }));
    profiles.push({ id: unicodeLegacyNick, name: unicodeUppercase });
    for (const { id, name } of profiles) {
      await connection.query(
        `INSERT INTO "User" ("id", "name", "email", "nick", "nickNormalized", "updatedAt")
         VALUES ($1, $2, $3, $1, $1, CURRENT_TIMESTAMP)`,
        [id, name, `${id}@search.invalid`],
      );
    }

    await cp(new URL(`${originalNameMigration}/`, migrations), join(history, originalNameMigration), { recursive: true });
    runCli(migrateFixture, env);
    await connection.query(
      `INSERT INTO "User" ("id", "name", "email", "nick", "nickNormalized", "nameNormalized", "updatedAt")
       VALUES ($1, $2, $3, $1, $1, $4, CURRENT_TIMESTAMP)`,
      [unicodeCurrentNick, unicodeUppercase, `${unicodeCurrentNick}@search.invalid`, unicodeLowercase],
    );
    // Первую порцию занимают профили с корректными ключами. Исправления нужны дальше.
    const batchFixtureName = "Проверка порций";
    await connection.query(
      `INSERT INTO "User" ("id", "name", "email", "nick", "nickNormalized", "nameNormalized", "updatedAt")
       SELECT nick, $1, nick || '@search.invalid', nick, nick, $2, CURRENT_TIMESTAMP
       FROM (SELECT 'batch' || sequence AS nick FROM generate_series(1, 501) AS sequence) AS batch`,
      [batchFixtureName, normalizeForSearch(batchFixtureName)],
    );

    const currentVersion = (await profileVersions(connection)).find((row) => row.id === unicodeCurrentNick);
    const deploy = [npmCli, "run", "migrate:deploy"];
    const preferUrl = new URL(directUrl);
    preferUrl.searchParams.set("sslmode", "prefer");
    runCli(deploy, { ...env, DIRECT_URL: preferUrl.href });
    const firstRun = await profileVersions(connection);
    expect(firstRun).toContainEqual(currentVersion);

    await writeFile(conflictingEnv, `DIRECT_URL=${alternateUrl.href}\n`);
    runCli(deploy, {
      ...env,
      DIRECT_URL: undefined,
      DATABASE_URL: directUrl,
      DOTENV_CONFIG_PATH: conflictingEnv,
      DOTENV_CONFIG_OVERRIDE: "true",
    });
    const { rows: [alternate] } = await connection.query(`SELECT to_regnamespace('unused_search_test') AS schema`);
    expect(alternate.schema).toBeNull();
    expect(await profileVersions(connection)).toEqual(firstRun);
  } finally {
    await fixture.remove();
  }
}

beforeAll(async function migrateDisposableDatabase() {
  const target = resolveDisposableTarget();
  const connection = new Client({ connectionString: target.directUrl });
  sql = connection;
  await connection.connect();

  const { rows: [settings] } = await connection.query<{
    database: string; version: string; encoding: string; ctype: string; collate: string;
  }>(`
    SELECT current_database() AS database, current_setting('server_version') AS version,
           current_setting('server_encoding') AS encoding, datctype AS ctype, datcollate AS collate
    FROM pg_database WHERE datname = current_database()
  `);
  expect(settings.database).toBe(target.database);
  checkDisposableCluster({
    serverVersion: settings.version,
    serverEncoding: settings.encoding,
    pinnedMajor: process.env.DISPOSABLE_PG_MAJOR,
  });
  expect(settings.ctype, "Для проверки старого преобразования требуется LC_CTYPE=C").toBe("C");
  expect(settings.collate, "Фикстуры зависят от порядка сортировки LC_COLLATE=C").toBe("C");
  console.log(`PostgreSQL ${settings.version}, ${settings.encoding}, LC_CTYPE=${settings.ctype}, LC_COLLATE=${settings.collate}`);

  const userSchemas = await connection.query(`
    SELECT nspname FROM pg_namespace
    WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
      AND (nspname <> 'public'
        OR EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = pg_namespace.oid)
        OR EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = pg_namespace.oid)
        OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = pg_namespace.oid))
  `);
  expect(userSchemas.rows, "Для проверки нужна пустая одноразовая база").toEqual([]);

  await prepareAndUpgrade(connection, target.directUrl);

  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.databaseUrl }) });
  await prisma.user.create({ data: searchPerson(viewerId, "Наблюдатель") });
});

afterAll(async function closeDisposableConnections() {
  await prisma?.$disconnect();
  await sql?.end();
});

it("возвращает точный ник и буквальные префиксы с подчёркиванием на полной странице", async function searchByNick() {
  const exact = searchPerson("nick_", "Яков");
  const prefixes = numberedRows(USER_SEARCH_LIMIT + 3, function nickPrefix(number) {
    return searchPerson(`nick_z${number}`, `Имя ${number}`);
  });
  const falseMatches = numberedRows(USER_SEARCH_LIMIT + 3, function falseNick(number) {
    return searchPerson(`nick0${number}`, "Ложное совпадение");
  });
  const nameQuery = "маркер имени";
  const hidden = searchPerson("nick_hidden", `Аноним nick_ ${nameQuery}`, true);
  const blocked = searchPerson("nick_blocked", `Анна nick_ ${nameQuery}`);
  const blocker = searchPerson("nick_blocker", `Алёна nick_ ${nameQuery}`);
  const nameMatch = searchPerson("displaymatch", `Яна nick_ ${nameQuery}`);
  await prisma.user.createMany({
    data: [
      ...falseMatches,
      ...prefixes,
      exact,
      hidden,
      blocked,
      blocker,
      nameMatch,
    ],
  });
  await prisma.block.createMany({
    data: [
      { blockerId: viewerId, blockedId: blocked.id },
      { blockerId: blocker.id, blockedId: viewerId },
    ],
  });

  const users = await search("nick_");
  const nicks = users.map((user) => user.nick);
  for (const forbidden of [hidden, blocked, blocker]) {
    expect(nicks).not.toContain(forbidden.nick);
  }
  expect(nicks).toEqual([exact.nick, ...prefixes.slice(0, USER_SEARCH_LIMIT - 1).map((person) => person.nick)]);
  expect(users[0]).toEqual({ displayName: exact.name, nick: exact.nick, relationship: "NONE", subscribed: false });
  expect((await search(nameQuery)).map((user) => user.nick)).toEqual([nameMatch.nick]);
});

it("находит буквальную подстроку имени с подчёркиванием после ложных совпадений", async function searchByName() {
  const match = searchPerson("literalname", "Яна ab_cd");
  const falseMatches = numberedRows(USER_SEARCH_LIMIT + 3, function falseName(number) {
    return searchPerson(`falsename${number}`, `Аня ${number} ab0cd`);
  });
  await prisma.user.createMany({ data: [...falseMatches, match] });

  expect(await search("ab_cd")).toEqual([
    { displayName: match.name, nick: match.nick, relationship: "NONE", subscribed: false },
  ]);
});

it("понимает процент и обратную косую черту в запросе как текст", async function searchWithSpecialCharacters() {
  const percent = searchPerson("percent", "Яна xy%zz");
  const backslash = searchPerson("backslash", "Яна xy\\zz");
  const falseMatches = numberedRows(USER_SEARCH_LIMIT + 3, function falseName(number) {
    return searchPerson(`falsepercent${number}`, `Аня ${number} xy0zz`);
  });
  await prisma.user.createMany({ data: [...falseMatches, percent, backslash] });

  expect.soft((await search("xy%zz")).map((user) => user.nick)).toEqual([percent.nick]);
  expect.soft((await search("xy\\zz")).map((user) => user.nick)).toEqual([backslash.nick]);
  expect((await search("xy\\")).map((user) => user.nick)).toEqual([backslash.nick]);
});

it("сохраняет отображаемые имена старых профилей и приводит поисковое значение к контракту", async function verifyLegacyNames() {
  for (const [index, name] of legacyNames.entries()) {
    const existing = await prisma.user.findUniqueOrThrow({
      where: { id: `legacy${index}` },
      select: { name: true, nameNormalized: true },
    });
    expect.soft(existing, `Профиль legacy${index}`).toEqual({ name, nameNormalized: normalizeForSearch(name) });
  }

  await prisma.user.create({ data: searchPerson(newProfileNick, "Новое имя") });
  expect(await updateName({ name: legacyNames[0] }, renameHeaders)).toMatchObject({ ok: true });
  expect((await search("josé")).map((user) => user.nick).sort()).toEqual(["legacy0", newProfileNick]);
});

it("сохраняет регистр Unicode 16 в ключах поиска старых и новых профилей", async function verifyUnicodeLowercase() {
  expect(normalizeForSearch(unicodeUppercase)).toBe(unicodeLowercase);
  for (const nick of [unicodeLegacyNick, unicodeCurrentNick]) {
    const row = await prisma.user.findUniqueOrThrow({
      where: { nickNormalized: nick },
      select: { name: true, nameNormalized: true },
    });
    expect.soft(row, nick).toEqual({ name: unicodeUppercase, nameNormalized: unicodeLowercase });
  }
  expect((await search(unicodeLowercase)).map((user) => user.nick).sort()).toEqual([unicodeCurrentNick, unicodeLegacyNick]);
});
