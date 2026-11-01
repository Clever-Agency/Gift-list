import { loginBodySchema } from "@gift-list/contracts";
import { signInUser } from "@/actions/sign-in";
import { signOutUser } from "@/actions/sign-out";
import { parseJsonBody, toResponse } from "@/lib/api-v1";
import { withAuthSession } from "@/lib/auth-session";

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, loginBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  const outcome = await signInUser(parsed.data, request.headers);
  if (outcome.session) return withAuthSession(request, outcome.session, outcome.result);
  return toResponse(outcome.result);
}

export async function DELETE(request: Request) {
  const outcome = await signOutUser(request.headers);
  if (outcome.session) return withAuthSession(request, outcome.session, outcome.result);
  return toResponse(outcome.result);
}
