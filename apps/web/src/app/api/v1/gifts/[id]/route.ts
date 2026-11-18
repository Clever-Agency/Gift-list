import { getViewerGift } from "@/actions/gift-viewer";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

/** Story 5.1: a non-owner reads one wish for the detail and reserve screen. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const listToken = new URL(request.url).searchParams.get("listToken");
  return toResponse(await getViewerGift(request.headers, id, listToken));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;