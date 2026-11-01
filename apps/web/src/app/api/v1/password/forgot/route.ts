import { passwordForgotBodySchema } from "@gift-list/contracts";
import { requestPasswordReset } from "@/actions/password-reset";
import { parseJsonBody, toResponse } from "@/lib/api-v1";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, passwordForgotBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await requestPasswordReset(parsed.data, request.headers));
}
