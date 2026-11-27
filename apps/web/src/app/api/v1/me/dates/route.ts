import { personalDateCreateBodySchema } from "@gift-list/contracts";
import { createMyDate, listMyDates } from "@/actions/personal-dates";
import { notFoundResponse, parseJsonBody, toResponse } from "@/lib/api-v1";

/**
 * Story 7.5 (FR-38, AD-23): the owner's personal dates on `/profile`.
 * `GET` answers every stored field, switches included; `POST` creates the next
 * date and answers 201 with the row (AD-12). The body is checked by the shared
 * contract, the use-case owns the session and the atomic limit of ten.
 */
export async function GET(request: Request) {
  return toResponse(await listMyDates(request.headers));
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, personalDateCreateBodySchema);
  if (!parsed.ok) return toResponse(parsed);
  return toResponse(await createMyDate(request.headers, parsed.data), 201);
}

export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
export const HEAD = notFoundResponse;
