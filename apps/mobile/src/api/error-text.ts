import type { ApiFailure } from "./client";

/** Key in the `common` namespace for a failed call; `message` is never shown (AD-27). */
export function errorTextKey(failure: ApiFailure): string {
  if (failure.kind === "network") return "errors.network";
  const { reason, code } = failure.error;
  return reason ? `errors.reason.${reason}` : `errors.code.${code}`;
}
