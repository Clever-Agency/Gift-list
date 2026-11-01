import { registerBodySchema } from "@gift-list/contracts";
import { registerUser } from "@/actions/register";
import { parseJsonBody, toResponse } from "@/lib/api-v1";
import { withAuthSession } from "@/lib/auth-session";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, registerBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  const outcome = await registerUser(parsed.data, request.headers);
  if (outcome.session) return withAuthSession(request, outcome.session, outcome.result);
  return toResponse(outcome.result);
}
