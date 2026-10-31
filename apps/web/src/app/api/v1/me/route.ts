import { getCurrentUser } from "@/actions/current-user";
import { toResponse } from "@/lib/api-v1";

export async function GET(request: Request) {
  return toResponse(await getCurrentUser(request.headers));
}
