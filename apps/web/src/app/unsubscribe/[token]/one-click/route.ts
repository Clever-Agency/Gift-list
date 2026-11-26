import { applyUnsubscribe } from "@/actions/unsubscribe";

/**
 * RFC 8058 (Story 7.2, FR-36): the one-click target of `List-Unsubscribe`.
 * The mail client posts `List-Unsubscribe=One-Click`, and the same token turns
 * its own reminder switch off; the body is not trusted for anything else.
 *
 * The answer is always `200` with no page body: a genuine token and a forged one
 * are indistinguishable, so the route never confirms whether an account exists
 * and a mail client never retries a token it cannot use. `no-store` keeps the
 * capability out of shared caches.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  await applyUnsubscribe(token, false);

  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
