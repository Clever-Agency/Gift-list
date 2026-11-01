import { passwordResetBodySchema } from "@gift-list/contracts";
import { resetPassword } from "@/actions/password-reset";
import { parseJsonBody, toResponse } from "@/lib/api-v1";

const staleLink = {
  ok: false as const,
  code: "VALIDATION" as const,
  message: "Reset link is stale",
  reason: "RESET_LINK_STALE" as const,
};

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, passwordResetBodySchema);
  if (!parsed.ok) {
    if (parsed.field === "token") return toResponse(staleLink);
    return toResponse(parsed);
  }
  return toResponse(await resetPassword(parsed.data));
}
