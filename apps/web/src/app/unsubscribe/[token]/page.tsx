import type { Metadata } from "next";
import { headers } from "next/headers";
import { getBrandName } from "@/lib/env";
import { requestLocale } from "@/lib/request-locale";
import { buildUnsubscribeMetadata, getUnsubscribePage } from "./unsubscribe-page";
import { UnsubscribeView } from "./unsubscribe-view";

/**
 * Story 7.2 (FR-36) / AD-26: the server page of an unsubscribe link. It lives
 * without a session and names no account: a mail client and a person both reach
 * the same answer. Opening the link turns the switch of its type off; the
 * `restored` query is the return of the «Вернуть» form and turns it back on.
 *
 * AD-16: this page depends on `Accept-Language` and writes, so the server never
 * caches it (`next.config.ts` keeps `/unsubscribe` private, `no-store`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = requestLocale((await headers()).get("accept-language"));
  return buildUnsubscribeMetadata(locale, getBrandName());
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: PageProps<"/unsubscribe/[token]">) {
  const { token } = await params;
  const { restored } = await searchParams;
  const page = await getUnsubscribePage(token, restored === "1");

  return <UnsubscribeView view={page.view} locale={page.locale} token={token} />;
}

UnsubscribePage.displayName = "UnsubscribePage";
