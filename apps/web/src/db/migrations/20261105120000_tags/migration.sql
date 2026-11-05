-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftTag" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "tagId" TEXT,
    "customText" VARCHAR(30),
    "aggregateEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "GiftTag_tagId_idx" ON "GiftTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftTag_giftId_tagId_key" ON "GiftTag"("giftId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftTag_giftId_customText_key" ON "GiftTag"("giftId", "customText");

-- AddForeignKey
ALTER TABLE "GiftTag" ADD CONSTRAINT "GiftTag_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftTag" ADD CONSTRAINT "GiftTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Story 2.5/AD-27: `labels` is a locale-to-label object, not an array or scalar.
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_labels_object_check" CHECK (jsonb_typeof("labels") = 'object');

-- Story 2.5/AD-22: a tag row must identify something, and only a row linked to
-- the catalog may enter aggregates. Prisma does not model CHECK constraints, so
-- this part of the migration is written by hand.
ALTER TABLE "GiftTag" ADD CONSTRAINT "GiftTag_shape_check" CHECK (
    ("tagId" IS NOT NULL OR ("customText" IS NOT NULL AND btrim("customText") <> ''))
    AND ("aggregateEligible" = false OR "tagId" IS NOT NULL)
);
