import { getViewerGift } from "@/actions/gift-viewer";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/** Story 5.1: a non-owner reads one wish for the detail and reserve screen. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return toResponse(await getViewerGift(request.headers, id));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;