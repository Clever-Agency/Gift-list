import { apiRequest, type ClientResult } from "@/api/client";

/**
 * CLE-86: public `GET /api/v1/app-version` through the shared `apiRequest`
 * transport: the envelope (AD-12) and the 10 s timeout are already handled
 * there, so this module does not fetch or parse anything on its own.
 *
 * The answer is returned untouched. Validation with `appVersionDataSchema`
 * lives in `@/app-version/check`, where a malformed body is the same fail open
 * as a network failure (the policy may be extended later, so parsing belongs
 * next to the decision).
 */
export function fetchAppVersionPolicy(): Promise<ClientResult<unknown>> {
  return apiRequest<unknown>("/api/v1/app-version");
}
