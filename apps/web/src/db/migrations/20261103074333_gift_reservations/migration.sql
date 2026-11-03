-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('OPEN', 'RESERVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GiftVisibility" AS ENUM ('PUBLIC', 'FRIENDS', 'SECRET');

-- CreateEnum
CREATE TYPE "GiftQuantity" AS ENUM ('SINGLE', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "GiftCurrency" AS ENUM ('USD', 'EUR', 'CNY', 'BYN', 'RUB');

-- CreateEnum
CREATE TYPE "ReservationPhase" AS ENUM ('ACTIVE', 'AWAITING_GIVER', 'AWAITING_OWNER', 'GIVEN');

-- CreateEnum
CREATE TYPE "GiftClosedFromStatus" AS ENUM ('OPEN', 'RESERVED');

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceAmount" INTEGER,
    "priceCurrency" "GiftCurrency",
    "linkUrl" TEXT,
    "visibility" "GiftVisibility" NOT NULL DEFAULT 'PUBLIC',
    "quantity" "GiftQuantity" NOT NULL DEFAULT 'SINGLE',
    "expiresOn" DATE,
    "archivedAt" TIMESTAMPTZ(3),
    "status" "GiftStatus" NOT NULL DEFAULT 'OPEN',
    "reservedById" TEXT,
    "reservedAt" TIMESTAMPTZ(3),
    "reservationDueAt" TIMESTAMPTZ(3),
    "reservationTimeZone" TEXT,
    "reservationPhase" "ReservationPhase",
    "reservationPhaseAt" TIMESTAMPTZ(3),
    "reservationBought" BOOLEAN NOT NULL DEFAULT false,
    "holderVisibleToOwner" BOOLEAN NOT NULL DEFAULT false,
    "holderVisibleToOthers" BOOLEAN NOT NULL DEFAULT true,
    "titleSnapshotOnReserve" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "closedFromStatus" "GiftClosedFromStatus",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gift_listId_idx" ON "Gift"("listId");

-- CreateIndex
CREATE INDEX "Gift_reservedById_status_idx" ON "Gift"("reservedById", "status");

-- CreateIndex
CREATE INDEX "Gift_status_reservationPhase_reservationDueAt_idx" ON "Gift"("status", "reservationPhase", "reservationDueAt");

-- CreateIndex
CREATE INDEX "Gift_status_reservationPhase_reservationPhaseAt_idx" ON "Gift"("status", "reservationPhase", "reservationPhaseAt");

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
