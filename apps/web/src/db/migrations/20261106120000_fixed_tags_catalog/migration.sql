-- Story 2.5 / AD-22 / AD-27: initialize the fixed tag catalog in the normal
-- deploy path.
--
-- `prisma migrate deploy` applies migrations but never runs `prisma db seed`, so
-- a fresh environment would otherwise serve an empty catalog
-- (`GET /api/v1/tags` -> `{ tags: [] }`). This additive data migration is the
-- initialization step; the seed in `src/db/seed.ts` stays available for local
-- development and manual repair.
--
-- Idempotent by `slug`: repeated deploys and manual seed runs cannot create
-- duplicates. Existing rows are never deleted or overwritten: existing label
-- keys win, and missing keys (a locale added to `SUPPORTED_LOCALES`) are filled
-- from this starting set. An ADMIN edit made in Story 10.2 therefore survives.
--
-- This is a separate migration because `20261105120000_tags` may already be
-- applied remotely; an applied migration must never be edited.

INSERT INTO "Tag" ("id", "slug", "labels", "createdAt", "updatedAt")
VALUES
    ('bideno3f5ac1xl2s726njsdj', 'dream', '{"ru":"мечта"}'::jsonb, NOW(), NOW()),
    ('nusojgpyswwttbuh6f4qffj1', 'need-now', '{"ru":"нужно сейчас"}'::jsonb, NOW(), NOW()),
    ('ixze3k4xz0o6z71c9spqz250', 'someday', '{"ru":"когда-нибудь"}'::jsonb, NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE
SET "labels" = EXCLUDED."labels" || "Tag"."labels",
    "updatedAt" = NOW()
WHERE "Tag"."labels" IS DISTINCT FROM (EXCLUDED."labels" || "Tag"."labels");
