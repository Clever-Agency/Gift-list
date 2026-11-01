import { getLocales } from "expo-localization";
import type { z } from "zod";
import {
  DEFAULT_LOCALE,
  actionResultSchema,
  errorCodeSchema,
  errorReasonSchema,
  type ActionError,
  type ActionResult,
} from "@gift-list/contracts";
import { prepareRequest, readResponse, resolveUrl } from "@/platform/transport";

export type ApiFailure =
  | { ok: false; kind: "api"; error: ActionError }
  | { ok: false; kind: "network" };

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export type ApiRequestInit = {
  method?: string;
  body?: unknown;
};

/** Language tags with descending `q`; the default locale when the device reports none. */
export function buildAcceptLanguage(tags: readonly string[]): string {
  const unique = tags.filter((tag, index) => tag.length > 0 && tags.indexOf(tag) === index);
  if (unique.length === 0) return DEFAULT_LOCALE;
  return unique
    .map((tag, index) => {
      if (index === 0) return tag;
      const q = Math.max(1 - index * 0.1, 0.1);
      return `${tag};q=${q.toFixed(1)}`;
    })
    .join(",");
}

function deviceLanguageTags(): string[] {
  return getLocales()
    .map((item) => item.languageTag)
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
}

/** Newer server, older build: an unknown `reason` or extra field is dropped, a known `code`, `reason` and `field` stay. */
function degradedApiError(body: unknown): ApiFailure {
  if (typeof body !== "object" || body === null) return NETWORK;
  const { ok, code, message, reason, field } = body as Record<string, unknown>;
  const known = errorCodeSchema.safeParse(code);
  if (ok !== false || !known.success) return NETWORK;
  const knownReason = errorReasonSchema.safeParse(reason);
  const error: ActionError = {
    ok: false,
    code: known.data,
    message: typeof message === "string" ? message : "",
  };
  if (knownReason.success) error.reason = knownReason.data;
  if (typeof field === "string") error.field = field;
  return { ok: false, kind: "api", error };
}

const NETWORK: ApiFailure = { ok: false, kind: "network" };

/** One request: platform transport, envelope parsed by the contracts schema (AD-12). */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  dataSchema: S,
  init: ApiRequestInit = {},
): Promise<ApiResult<z.infer<S>>> {
  const url = resolveUrl(path);
  if (url === null) return NETWORK;

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Language": buildAcceptLanguage(deviceLanguageTags()),
    };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const prepared = await prepareRequest(path, headers);

    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: prepared.headers,
      credentials: prepared.credentials,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    await readResponse(path, response);

    const body: unknown = await response.json();
    const parsed = actionResultSchema(dataSchema).safeParse(body);
    if (!parsed.success) return degradedApiError(body);
    const result = parsed.data as ActionResult<z.infer<S>>;
    if (result.ok) return { ok: true, data: result.data };
    return { ok: false, kind: "api", error: result };
  } catch {
    return NETWORK;
  }
}
