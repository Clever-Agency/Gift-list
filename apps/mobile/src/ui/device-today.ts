/**
 * The device's calendar day, `YYYY-MM-DD`: the `min` of a date field. It is a
 * convenience only; the final check against `User.timeZone` is the server's.
 */
export function deviceToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
