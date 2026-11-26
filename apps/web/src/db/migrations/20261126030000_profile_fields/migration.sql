-- CLE-129/T8.1, D-58, AD-29: profile fields on "User" — a birthday without a
-- year, gender, country (ISO 3166-1 alpha-2), «Обо мне» and the single switch
-- that lets accepted friends see them. Prisma does not model CHECK constraints,
-- so every invariant below is written here by hand: the day/month pair, the
-- calendar maximum of the day (29 February allowed, no year is stored), the
-- country shape and the text cap.

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "birthDay" INTEGER,
    ADD COLUMN "birthMonth" INTEGER,
    ADD COLUMN "gender" "Gender",
    ADD COLUMN "country" CHAR(2),
    ADD COLUMN "about" TEXT,
    ADD COLUMN "profileVisibleToFriends" BOOLEAN NOT NULL DEFAULT true;

-- The birthday is one pair: both columns are null or both are set (AD-23, AD-29).
ALTER TABLE "User" ADD CONSTRAINT "User_birth_date_pair_check" CHECK (
    ("birthDay" IS NULL) = ("birthMonth" IS NULL)
);

-- Ranges and the real last day of the month. February stops at 29 because the
-- year is not stored, so 29 February is a valid value (AD-23).
ALTER TABLE "User" ADD CONSTRAINT "User_birth_date_range_check" CHECK (
    "birthDay" IS NULL
    OR (
        "birthMonth" BETWEEN 1 AND 12
        AND "birthDay" BETWEEN 1 AND 31
        AND "birthDay" <= CASE "birthMonth"
            WHEN 2 THEN 29
            WHEN 4 THEN 30
            WHEN 6 THEN 30
            WHEN 9 THEN 30
            WHEN 11 THEN 30
            ELSE 31
        END
    )
);

-- Only the code is stored, always upper case; the client renders the name from
-- the ISO list (AD-29).
ALTER TABLE "User" ADD CONSTRAINT "User_country_code_check" CHECK (
    "country" IS NULL OR "country" ~ '^[A-Z]{2}$'
);

-- «Обо мне» is at most 500 characters after trimming (AD-29).
ALTER TABLE "User" ADD CONSTRAINT "User_about_length_check" CHECK (
    "about" IS NULL OR char_length("about") <= 500
);
