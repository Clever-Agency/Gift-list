/**
 * Prisma answers `P2021` for a missing table (for example `ReminderLog`) and
 * `P2022` for a missing column (for example `remindFriendDates`). Until the
 * migrations reach a deployment, the date-reminders cron answers 200 with a
 * fixed marker instead of a 500, so a scheduler running from the staging branch
 * does not report the production deployment as broken (Story 7.3, AD-16).
 */
export function isSchemaNotMigrated(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2021" || code === "P2022";
}
