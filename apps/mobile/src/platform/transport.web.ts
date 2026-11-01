import { getApiBaseUrl } from "@/config/env";

export type PreparedRequest = {
  headers: Record<string, string>;
  credentials?: "include";
};

/** Same domain when the base URL is empty (AD-26). */
export function resolveUrl(path: string): string | null {
  return `${getApiBaseUrl().replace(/\/+$/, "")}${path}`;
}

/** The browser session is a cookie: no `Authorization`, no `expo-origin`, no token in JS. */
export async function prepareRequest(
  path: string,
  headers: Record<string, string>,
): Promise<PreparedRequest> {
  void path;
  return { headers, credentials: "include" };
}

export async function readResponse(path: string, response: Response): Promise<void> {
  void path;
  void response;
}
