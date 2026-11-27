-- CLE-138 (Story 7.3/7.4, AD-23, FR-34/FR-35): one row per date reminder
-- actually sent, so a repeated hourly cron run writes no second notification.
-- The UNIQUE key is (recipientId, subjectId, year, kind); `subjectId` is the
-- `User.id` of the birthday (personal dates will use `UserDate.id`) and `year`
-- is the year of the birthday occurrence.

CREATE TYPE "ReminderKind" AS ENUM ('BIRTHDAY_FRIEND', 'BIRTHDAY_OWN');

CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReminderLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReminderLog_recipientId_subjectId_year_kind_key" ON "ReminderLog"("recipientId", "subjectId", "year", "kind");
