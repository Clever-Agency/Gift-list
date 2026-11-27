-- CLE-143 (Story 10.1, AD-22, FR-49, D-32): the ADMIN role and editorial
-- collections of gift ideas. Only an ADMIN opens `/admin`; the role is assigned
-- by hand in the database and never reaches the app clients. Collections are
-- filled manually (no AI, no blogger recommendations) and stay invisible until
-- an editor publishes them. Prisma does not model CHECK constraints, so the
-- non-empty titles are enforced here by hand.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
-- The default makes this safe for existing rows: every account becomes a
-- regular user without a data backfill, and a new account is a USER as well.
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "EditorialCollection" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EditorialCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "linkUrl" TEXT,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EditorialItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EditorialItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "EditorialCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
-- The app reads only published collections, newest first (Story 10.1).
CREATE INDEX "EditorialCollection_publishedAt_idx" ON "EditorialCollection"("publishedAt");

-- CreateIndex
-- The one read of a collection's ideas orders them by their manual position.
CREATE INDEX "EditorialItem_collectionId_position_idx" ON "EditorialItem"("collectionId", "position");

-- A title is never empty: the write path trims it, and the database refuses a
-- blank or all-spaces value as well (the same rule as `UserDate.title`).
ALTER TABLE "EditorialCollection" ADD CONSTRAINT "EditorialCollection_title_check" CHECK (
    char_length(btrim("title")) BETWEEN 1 AND 120
);

ALTER TABLE "EditorialItem" ADD CONSTRAINT "EditorialItem_title_check" CHECK (
    char_length(btrim("title")) BETWEEN 1 AND 120
);
