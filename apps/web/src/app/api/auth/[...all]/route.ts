import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { stripAuthTokenForBrowser } from "@/lib/auth-token";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  return stripAuthTokenForBrowser(request, await handler.GET(request));
}

export async function POST(request: Request) {
  return stripAuthTokenForBrowser(request, await handler.POST(request));
}
