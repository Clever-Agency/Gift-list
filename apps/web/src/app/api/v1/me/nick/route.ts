import { nickUpdateBodySchema } from "@gift-list/contracts";
import { updateNick } from "@/actions/update-nick";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

export async function PUT(request: Request) {
  const parsed = await parseJsonBody(request, nickUpdateBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await updateNick(parsed.data, request.headers));
}

export const GET = notFoundResponse;
export const POST = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
