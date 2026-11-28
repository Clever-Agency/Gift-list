-- CLE-144 (Story 10.2, AD-22, AD-27): ADMIN decisions on the custom tag texts
-- users write. A decision is keyed by the normalized text (trim, collapsed
-- spaces, lower case) and keeps no author and no wish. An approval points to the
-- catalog tag it created or picked; a rejection has no tag, so the text stays on
-- the wishes as their own caption and never enters aggregates. Prisma does not
-- model CHECK constraints, so the shape of a decision is enforced here by hand.

-- CreateEnum
CREATE TYPE "CustomTagDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CustomTagModeration" (
    "id" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "decision" "CustomTagDecision" NOT NULL,
    "tagId" TEXT,
    "decidedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomTagModeration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One decision per normalized text: a second decision cannot overwrite or
-- duplicate the first, and the queue hides decided texts.
CREATE UNIQUE INDEX "CustomTagModeration_normalizedText_key" ON "CustomTagModeration"("normalizedText");

-- CreateIndex
CREATE INDEX "CustomTagModeration_tagId_idx" ON "CustomTagModeration"("tagId");

-- AddForeignKey
-- A catalog tag that a decision points to cannot be deleted (the same RESTRICT
-- rule as `GiftTag.tagId`): the decision would lose its meaning.
ALTER TABLE "CustomTagModeration" ADD CONSTRAINT "CustomTagModeration_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Story 10.2: a normalized text is never blank, an approval always names the
-- catalog tag it became, and a rejection never names one. The text is shorter
-- than the raw custom text in practice; no length cap is enforced because lower
-- case mapping may expand a code point.
ALTER TABLE "CustomTagModeration" ADD CONSTRAINT "CustomTagModeration_shape_check" CHECK (
    btrim("normalizedText") <> ''
    AND (
        ("decision" = 'APPROVED' AND "tagId" IS NOT NULL)
        OR ("decision" = 'REJECTED' AND "tagId" IS NULL)
    )
);
