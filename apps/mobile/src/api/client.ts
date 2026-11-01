import type { ActionError, ActionResult } from "@gift-list/contracts";
import { getLocales } from "expo-localization";
import { Platform } from "react-native";
import { getApiBaseUrl } from "@/config/env";
import { readSessionToken, writeSessionToken } from "@/platform/session-token";

export type ClientResult<T> = ActionResult<T> | { ok: false; network: true };

function languageTag(): string {
  const tag = getLocales()
    .map((item) => item.languageTag)
    .find((value): value is string => typeof value === "string" && value.length > 0);
  return tag ?? "ru";
}

function isActionResult(value: unknown): value is ActionResult<unknown> {
  if (!value || typeof value !== "object" || !("ok" in value)) return false;
  const record = value as { ok: unknown; code?: unknown; data?: unknown };
  if (record.ok === true) return "data" in record;
  return record.ok === false && typeof record.code === "string";
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
    const token = await readSessionToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
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
    if (token) await writeSessionToken(token);
  }

  let json: unknown;
  try {
    json = (await response.json()) as unknown;
  } catch {
    return { ok: false, network: true };
  }
  if (!isActionResult(json)) return { ok: false, network: true };
  return json as ClientResult<T>;
}

export function isActionError(result: ClientResult<unknown>): result is ActionError {
  return result.ok === false && !("network" in result);
}
