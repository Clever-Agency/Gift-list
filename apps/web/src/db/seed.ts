// AD-22 / AD-27: the fixed tag catalog is database data. This seed is the
// starting set from Story 2.5; ADMIN adds more rows in Story 10.2. `slug` is the
// stable key, `labels` must cover every `SUPPORTED_LOCALES` entry.
//
// The normal deploy path does not run this seed: `prisma migrate deploy` applies
// the additive data migration `20261106120000_fixed_tags_catalog`, which
// initializes the same starting rows. This seed stays for local development and
// manual repair; it is idempotent and never overwrites ADMIN labels.
//
// Entry point: `prisma db seed` (configured in `prisma.config.ts`), which loads
// `apps/web/.env` first. A direct `node src/db/seed.ts` works for Node 24 when
// `DIRECT_URL` or `DATABASE_URL` is already in the environment. Only a type-only
// import from `@gift-list/contracts` is allowed here: a value import would pull
// extensionless TypeScript that bare Node cannot resolve.

import { createId } from "@paralleldrive/cuid2";
import type { SupportedLocale } from "@gift-list/contracts";
import { Pool } from "pg";
import { pathToFileURL } from "node:url";

export type FixedTagSeed = {
  /** Immutable catalog key; clients never translate it (AD-27). */
  readonly slug: string;
  readonly labels: Readonly<Record<SupportedLocale, string>>;
};

/**
 * Story 2.5 starting catalog. Slugs follow the identifiers named in CLE-52
 * (`dream`, `need-now`, `someday`); labels are the Russian source strings.
 */
export const FIXED_TAGS = [
  { slug: "dream", labels: { ru: "мечта" } },
  { slug: "need-now", labels: { ru: "нужно сейчас" } },
  { slug: "someday", labels: { ru: "когда-нибудь" } },
] as const satisfies readonly FixedTagSeed[];

/** Minimal query surface so tests can run the seed without PostgreSQL. */
export type SeedQuery = (sql: string, values: readonly unknown[]) => Promise<unknown>;

const UPSERT_TAG_SQL = `
INSERT INTO "Tag" ("id", "slug", "labels", "createdAt", "updatedAt")
VALUES ($1, $2, $3::jsonb, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE
SET "labels" = EXCLUDED."labels" || "Tag"."labels",
    "updatedAt" = NOW()
WHERE "Tag"."labels" IS DISTINCT FROM (EXCLUDED."labels" || "Tag"."labels")
`;

/**
 * Idempotent seed: every run upserts by `slug`, so a rerun neither duplicates
 * rows nor removes tags added by ADMIN. Existing labels win over the seed, so an
 * ADMIN edit made in Story 10.2 survives a reseed; missing locale keys (a language
 * added to `SUPPORTED_LOCALES`) are filled from the seed and only that change
 * touches `updatedAt`.
 */
export async function seedFixedTags(query: SeedQuery): Promise<void> {
  for (const tag of FIXED_TAGS) {
    await query(UPSERT_TAG_SQL, [createId(), tag.slug, JSON.stringify(tag.labels)]);
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(entry).href === import.meta.url;
}

async function main(): Promise<void> {
  // Same precedence as `prisma.config.ts`: a direct connection wins when set.
  const connectionString = (process.env.DIRECT_URL ?? process.env.DATABASE_URL)?.trim();
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required to seed fixed tags.");
  }

  const pool = new Pool({ connectionString });
  try {
    await seedFixedTags(function runQuery(sql, values) {
      return pool.query(
        sql,
        values as unknown[],
      );
    });
    console.log(`Seeded ${FIXED_TAGS.length} fixed tags.`);
  } finally {
    await pool.end();
  }
}

if (isDirectRun()) {
  void main().catch(function fail(error: unknown) {
    console.error("Tag seed failed", error);
    process.exitCode = 1;
  });
}
