import { getMyGifts } from "@/actions/my-gifts";
import { notFoundResponse, toResponse } from "@/lib/api-v1";

export async function GET(request: Request) {
  return toResponse(await getMyGifts(request.headers));
}

export const POST = notFoundResponse;
export const PUT = notFoundResponse;
export const PATCH = notFoundResponse;
export const DELETE = notFoundResponse;
