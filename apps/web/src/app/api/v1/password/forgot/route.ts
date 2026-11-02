import { passwordForgotBodySchema } from "@gift-list/contracts";
import { requestPasswordReset } from "@/actions/password-reset";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, passwordForgotBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await requestPasswordReset(parsed.data, request.headers));
}

export const GET = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
