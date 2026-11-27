import { applyUnsubscribe } from "@/actions/unsubscribe";

/**
 * CLE-137 (Story 7.2, FR-36): the «Вернуть» form of `/unsubscribe/{token}`.
 * The form is a plain HTML POST without JavaScript, and the switch is turned
 * back on here, by the POST: a GET never writes. A link preview, a mail scanner
 * or a crawler that opens `/unsubscribe/{token}?restored=1` changes nothing.
 *
 * The answer is the same 303 for a genuine and a forged token: the page with
 * `restored=1` only verifies the token and either confirms or says the link is
 * invalid, so the route never tells a stranger whether an account exists.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  await applyUnsubscribe(token, true);

  const target = new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url);
  target.searchParams.set("restored", "1");

  return Response.redirect(target, 303);
}
