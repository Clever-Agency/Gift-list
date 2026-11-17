import { toNextJsHandler } from "better-auth/next-js";
import { guardRequestBody, notFoundResponse } from "@/lib/api-v1";
import { auth } from "@/lib/auth";
import { stripAuthTokenForBrowser } from "@/lib/auth-token";

const handler = toNextJsHandler(auth);

async function handle(request: Request, method: "GET" | "POST"): Promise<Response> {
  // POST is the only method here that carries a body; the byte guard runs before
  // better-auth, so an oversized payload never reaches its handler, hashing,
  // rate limits or the database. GET/HEAD pass through untouched.
  const guarded =
    method === "POST" ? await guardRequestBody(request) : { ok: true as const, request };
  if (!guarded.ok) return guarded.response;
  const response = stripAuthTokenForBrowser(
    guarded.request,
    await handler[method](guarded.request),
  );
  if (response.status !== 404) return response;
  // Текст `Not Found` и пустое тело — закрытый путь или неизвестный маршрут.
  // JSON 404 живого эндпоинта (например провайдер входа) не подменяем.
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("application/json")) return response;
  return notFoundResponse();
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}

export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
