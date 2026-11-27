-- Story 7.6 (FR-38, AD-23): the T-14 reminder about a Friend's personal date.
-- The reminder journal already has its own value (`ReminderKind.DATE_CUSTOM` was
-- added by the user-dates migration); the in-app notice needs a kind of its own
-- so the feed and the letter can name a personal date instead of a birthday.
-- The value follows `DATE_OWN`: PostgreSQL appends it to the existing type.

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DATE_CUSTOM';
