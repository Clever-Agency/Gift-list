import "server-only";

import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createTranslator } from "next-intl";
import { getMessages, type SupportedLocale } from "@gift-list/contracts";
import { applyUnsubscribe } from "@/actions/unsubscribe";
import { requestLocale } from "@/lib/request-locale";
import { verifyUnsubscribeToken, type UnsubscribeType } from "@/lib/unsubscribe-token";

/**
 * CLE-137 (Story 7.2, FR-36): what `/unsubscribe/{token}` may show. One closed
 * answer `invalid` covers a forged token and a deleted account, so the page
 * never tells a stranger whether an account exists.
 */
export type UnsubscribeView =
  | { kind: "done"; type: UnsubscribeType }
  | { kind: "restored" }
  | { kind: "invalid" };

export type UnsubscribePage = { locale: SupportedLocale; view: UnsubscribeView };

/**
 * Story 7.2: opening the letter link turns the switch of its own type off.
 * `restored` is the return of the «Вернуть» form, and the POST has already
 * turned the switch back on: here the page only verifies the token and picks
 * the sentence, so a GET with `?restored=1` writes nothing (Design:
 * `/unsubscribe/{token}`, FR-36).
 */
export async function loadUnsubscribePage(
  token: string,
  restored: boolean,
): Promise<UnsubscribePage> {
  const locale = requestLocale((await headers()).get("accept-language"));

  if (restored) {
    if (verifyUnsubscribeToken(token) === null) return { locale, view: { kind: "invalid" } };
    return { locale, view: { kind: "restored" } };
  }

  const result = await applyUnsubscribe(token, false);
  if (!result.ok) return { locale, view: { kind: "invalid" } };
  return { locale, view: { kind: "done", type: result.type } };
}

/** One answer per request, so the page and its metadata never disagree. */
export const getUnsubscribePage = cache(loadUnsubscribePage);

/** A capability link is never an indexable document, in any state. */
const NO_INDEX = { index: false, follow: false } as const;

/**
 * DESIGN.md → Next-страницы: «Отписка — {BRAND}». The document names only the
 * product and the purpose: no type, no user, no account data.
 */
export function buildUnsubscribeMetadata(locale: SupportedLocale, brand: string): Metadata {
  const messages = getMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "web.unsubscribe" });
  const web = createTranslator({ locale, messages, namespace: "web" });

  return {
    title: t("pageTitle", { brand }),
    description: web("description"),
    robots: NO_INDEX,
  };
}
