import { getApiBaseUrl } from "@/config/env";
import { getSessionToken, setSessionToken } from "./session-token.native";

export type PreparedRequest = {
  headers: Record<string, string>;
  credentials?: "include";
};

const NATIVE_ORIGIN = "giftlist://";

/** No base URL on a phone means nothing to call: the caller reports `network`. */
export function resolveUrl(path: string): string | null {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  return base.length > 0 ? `${base}${path}` : null;
}

/** Bearer token when stored; `expo-origin` on `/api/auth/*` so the server returns `set-auth-token`. */
export async function prepareRequest(
  path: string,
  headers: Record<string, string>,
): Promise<PreparedRequest> {
  const next = { ...headers };
  const token = await getSessionToken();
  if (token) next.Authorization = `Bearer ${token}`;
  if (path.startsWith("/api/auth/")) next["expo-origin"] = NATIVE_ORIGIN;
  return { headers: next };
}

export async function readResponse(path: string, response: Response): Promise<void> {
  void path;
  const token = response.headers.get("set-auth-token");
  if (token) await setSessionToken(token);
}
