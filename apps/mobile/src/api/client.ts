import {
  actionErrorSchema,
  errorCodeSchema,
  errorReasonSchema,
  type ActionError,
  type ActionResult,
} from "@gift-list/contracts";
import { getLocales } from "expo-localization";
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/config/env";
import { readSessionToken, writeSessionToken } from "@/platform/session-token";

export type ClientResult<T> = ActionResult<T> | { ok: false; network: true };

function languageTag(): string {
  const tag = getLocales()
    .map((item) => item.languageTag)
    .find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
  return tag ?? "ru";
}

/** Returns a normalized result, or null when the body is not an API envelope. */
function parseEnvelope(value: unknown): ActionResult<unknown> | null {
  if (!value || typeof value !== "object" || !("ok" in value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ok === true)
    return "data" in record ? (value as ActionResult<unknown>) : null;
  if (record.ok !== false) return null;
  const code = errorCodeSchema.safeParse(record.code);
  if (!code.success) return null;
  const error: ActionError = {
    ok: false,
    code: code.data,
    message: typeof record.message === "string" ? record.message : "",
  };
  const reason = errorReasonSchema.safeParse(record.reason);
  if (reason.success) error.reason = reason.data;
  if (typeof record.field === "string") error.field = record.field;
  const params = actionErrorSchema.shape.params.safeParse(record.params);
  if (params.success && params.data !== undefined) error.params = params.data;
  return error;
}

/** Requests that create a session never read the stored token: a broken store must not block sign-in. */
function createsSession(method: string, path: string): boolean {
  if (path.startsWith("/api/auth/")) return true;
  return (
    method === "POST" &&
    (path === "/api/v1/session" || path === "/api/v1/register")
  );
}

export async function apiRequest<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ClientResult<T>> {
  const headers = new Headers();
  headers.set("accept", "application/json");
  headers.set("accept-language", languageTag());
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  if (Platform.OS !== "web") {
    headers.set("expo-origin", "giftlist://");
    if (!createsSession(init?.method ?? "GET", path)) {
      try {
        // A failed read must not look like "no token": an anonymous request would drop a working session.
        const token = await readSessionToken();
        if (token) headers.set("authorization", `Bearer ${token}`);
      } catch {
        return { ok: false, network: true };
      }
    }
  }

  let response: Response;
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    response = await fetch(`${base}${path}`, {
      method: init?.method ?? "GET",
      headers,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "include",
    });
  } catch {
    return { ok: false, network: true };
  }

  if (Platform.OS !== "web") {
    const token = response.headers.get("set-auth-token");
    if (token) {
      try {
        await writeSessionToken(token);
      } catch {
        return { ok: false, network: true };
      }
    }
  }

  let json: unknown;
  try {
    json = (await response.json()) as unknown;
  } catch {
    return { ok: false, network: true };
  }
  const result = parseEnvelope(json);
  if (!result) return { ok: false, network: true };
  return result as ClientResult<T>;
}

export function isActionError(
  result: ClientResult<unknown>,
): result is ActionError {
  return result.ok === false && !("network" in result);
}
