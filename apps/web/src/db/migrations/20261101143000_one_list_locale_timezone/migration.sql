-- One list per user (D-23). No production data; collapse any dev duplicates first.
DELETE FROM "List" AS extra
USING "List" AS keep
WHERE extra."ownerId" = keep."ownerId"
  AND (
    extra."createdAt" > keep."createdAt"
    OR (extra."createdAt" = keep."createdAt" AND extra."id" > keep."id")
  );

DROP INDEX "List_ownerId_type_key";

ALTER TABLE "List" DROP COLUMN "type";

DROP TYPE "ListType";

CREATE UNIQUE INDEX "List_ownerId_key" ON "List"("ownerId");

ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru';

ALTER TABLE "User" ADD COLUMN "timeZone" TEXT;
