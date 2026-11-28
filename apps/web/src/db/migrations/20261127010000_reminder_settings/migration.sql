-- CLE-137 (Story 7.2, FR-36): reminder type switches, both on by default.
ALTER TABLE "User" ADD COLUMN "remindFriendDates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "remindOwnList" BOOLEAN NOT NULL DEFAULT true;
