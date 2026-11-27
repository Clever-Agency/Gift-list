-- CLE-141 (Story 7.5, AD-23, FR-38/FR-43, D-22): personal dates of a profile.
-- The birthday is not stored here (D-58): it stays a day and a month on "User"
-- without a year. A personal date always has a day and a month, an optional
-- year, and two separate visibility switches — one for the date, one for the
-- year (an «все» date never opens its year by itself). Prisma does not model
-- CHECK constraints, so every invariant below is written here by hand.

-- CreateEnum
CREATE TYPE "UserDateKind" AS ENUM ('CUSTOM');

-- CreateEnum
CREATE TYPE "DateVisibility" AS ENUM ('ONLY_ME', 'FRIENDS', 'EVERYONE');

-- CreateTable
CREATE TABLE "UserDate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserDateKind" NOT NULL DEFAULT 'CUSTOM',
    "title" VARCHAR(40) NOT NULL,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER,
    "visibility" "DateVisibility" NOT NULL DEFAULT 'FRIENDS',
    "yearVisibility" "DateVisibility" NOT NULL DEFAULT 'ONLY_ME',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserDate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserDate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserDate_userId_idx" ON "UserDate"("userId");

-- The title is never empty: the write path trims it, and the database refuses a
-- blank or all-spaces value as well (AD-23, Story 7.5).
ALTER TABLE "UserDate" ADD CONSTRAINT "UserDate_title_check" CHECK (
    char_length(btrim("title")) BETWEEN 1 AND 40
);

-- The day exists in the stored month. Without a year February stops at 29
-- (29 February is a valid date); with a year the leap rule applies, so
-- 29 February 2023 is refused and 29 February 2024 is accepted.
ALTER TABLE "UserDate" ADD CONSTRAINT "UserDate_day_month_check" CHECK (
    "month" BETWEEN 1 AND 12
    AND "day" >= 1
    AND "day" <= CASE "month"
        WHEN 2 THEN CASE
            WHEN "year" IS NULL THEN 29
            WHEN ("year" % 4 = 0 AND "year" % 100 <> 0) OR ("year" % 400 = 0) THEN 29
            ELSE 28
        END
        WHEN 4 THEN 30
        WHEN 6 THEN 30
        WHEN 9 THEN 30
        WHEN 11 THEN 30
        ELSE 31
    END
);

-- A year outside this range is a typo, not a date (AD-23). "Not in the future"
-- is checked by the contract, because it depends on today's date.
ALTER TABLE "UserDate" ADD CONSTRAINT "UserDate_year_check" CHECK (
    "year" IS NULL OR "year" BETWEEN 1900 AND 9999
);

-- A new reminder kind for Story 7.6: a reminder about a personal date. The value
-- is added now and stays unused until that story wires it (AD-23).
ALTER TYPE "ReminderKind" ADD VALUE 'DATE_CUSTOM';
