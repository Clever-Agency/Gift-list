import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { Client, escapeIdentifier } from "pg";
import prismaPackage from "prisma/package.json" with { type: "json" };
import { normalizeForSearch } from "../../../packages/contracts/src/i18n/format.ts";

const batchSize = 500;

function resolveDatabaseUrl() {
  const explicitUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const { parsed } = loadDotenv({ quiet: true, override: false });
  return parsed?.DIRECT_URL?.trim() || parsed?.DATABASE_URL?.trim();
}

async function connectForBackfill(connectionString, url) {
  const options = url.searchParams;
  const mode = options.getAll("sslmode").at(-1) ?? (process.env.PGSSLMODE || "prefer");
  const explicitTls = ["ssl", "sslcert", "sslkey", "sslrootcert"].some((key) => options.has(key));
  const preferTls = mode === "prefer" && !explicitTls;
  const client = new Client({ connectionString, ssl: preferTls ? true : undefined });
  try {
    await client.connect();
    return client;
  } catch (error) {
    // pg выдаёт эту ошибку только для ответа N на запрос SSLRequest.
    if (!preferTls || error.constructor !== Error || error.message !== "The server does not support SSL connections") {
      throw error;
    }
  }

  const plainUrl = new URL(url);
  plainUrl.searchParams.set("sslmode", "disable");
  const plainClient = new Client({ connectionString: plainUrl.href });
  await plainClient.connect();
  return plainClient;
}

async function backfillSearchNames(connectionString) {
  const url = new URL(connectionString);
  const schema = url.searchParams.get("schema") ?? "public";
  const users = `${escapeIdentifier(schema)}."User"`;
  const client = await connectForBackfill(connectionString, url);

  try {
    let cursor = null;
    let changed = 0;
    while (true) {
      const { rows } = await client.query(`
        SELECT "id", "name", "nameNormalized"
        FROM ${users}
        WHERE $1::text IS NULL OR "id" > $1
        ORDER BY "id"
        LIMIT $2
      `, [cursor, batchSize]);
      if (rows.length === 0) return changed;
      cursor = rows.at(-1).id;

      const pending = rows.map(function normalizeRow(row) {
        return { ...row, normalized: normalizeForSearch(row.name) };
      }).filter((row) => row.normalized !== row.nameNormalized);
      if (pending.length === 0) continue;

      // Сравнение с прочитанным именем защищает переименование между SELECT и UPDATE.
      const result = await client.query(`
        UPDATE ${users} AS profile
        SET "nameNormalized" = pending.normalized
        FROM unnest($1::text[], $2::text[], $3::text[]) AS pending(id, name, normalized)
        WHERE profile."id" = pending.id
          AND profile."name" COLLATE pg_catalog."C" = pending.name COLLATE pg_catalog."C"
          AND profile."nameNormalized" COLLATE pg_catalog."C" IS DISTINCT FROM pending.normalized COLLATE pg_catalog."C"
      `, [pending.map((row) => row.id), pending.map((row) => row.name), pending.map((row) => row.normalized)]);
      changed += result.rowCount;
    }
  } finally {
    await client.end();
  }
}

async function deployMigrations() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) throw new Error("Задайте DIRECT_URL или DATABASE_URL для миграций.");

  const prismaCli = fileURLToPath(new URL(prismaPackage.bin.prisma, import.meta.resolve("prisma/package.json")));
  // Prisma читает DIRECT_URL первым. Закрепляем тот же URL для обоих шагов.
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: connectionString, DOTENV_OVERRIDE: "false", DOTENV_CONFIG_OVERRIDE: "false" },
    stdio: "inherit",
  });

  const changed = await backfillSearchNames(connectionString);
  console.log(`Поисковые имена обновлены: ${changed}`);
}

await deployMigrations().catch(function reportFailure(error) {
  console.error(`Выкладка миграций завершилась ошибкой: ${error.message}`);
  process.exitCode = 1;
});
