/**
 * CLE-137 (Story 7.2, FR-36): the «Вернуть» form of `/unsubscribe/{token}`.
 * The form is a plain HTML POST without JavaScript, so the switch is never
 * changed by a GET (a link preview or a crawler cannot re-enable reminders).
 *
 * The route writes nothing itself: it redirects to the page with `restored=1`,
 * where the one page loader turns the switch back on and renders the
 * confirmation. A 303 makes the browser follow with a GET.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const target = new URL(`/unsubscribe/${encodeURIComponent(token)}`, request.url);
  target.searchParams.set("restored", "1");

  return Response.redirect(target, 303);
}
