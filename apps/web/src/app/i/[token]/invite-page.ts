import "server-only";

import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { createTranslator } from "next-intl";
import { getMessages, type SupportedLocale } from "@gift-list/contracts";
import { getInvitePreview } from "@/actions/invite-link";
import { auth } from "@/lib/auth";
import { invitePathForToken } from "@/lib/public-token";
import { requestLocale } from "@/lib/request-locale";

/** The two public owner fields a link read may name (the same as `/l`). */
export type InviteOwner = { displayName: string; nick: string };

/**
 * What the page may render, after the one gate has run. `not_found` covers an
 * unknown token, a malformed segment and a `Block`: the page maps it to the real
 * HTTP 404 (`notFound()`), and the HTML and the metadata are the same for all
 * three. `invite.to` is the one-segment app address built from the validated
 * segment (`/invite/{token}`), never the request pathname.
 */
export type InviteView =
  | { kind: "redirect"; to: string }
  | { kind: "not_found" }
  | { kind: "invite"; inviter: InviteOwner; to: string };

export type InvitePage = { locale: SupportedLocale; view: InviteView };

/**
 * Story 4.7 / AD-21, AD-26: everything the page and its metadata need, loaded
 * once.
 *
 * - A malformed segment is the closed `not_found` before the session or database.
 * - A real session redirects only to the one-segment `/invite/{token}` built
 *   from the validated segment; the request pathname is never used as a target.
 *   Own link, existing friends and a `Block` are shown by the app screen.
 * - Without a session the page reads the preview action, which writes nothing:
 *   a page load or a messenger prefetch never creates a friendship.
 */
export async function loadInvitePage(token: string): Promise<InvitePage> {
  const requestHeaders = await headers();
  const locale = requestLocale(requestHeaders.get("accept-language"));

  const to = invitePathForToken(token);
  if (to === null) return { locale, view: { kind: "not_found" } };

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session) return { locale, view: { kind: "redirect", to } };

  const preview = await getInvitePreview(token, requestHeaders);
  // An unknown token and a `Block` are the same closed answer without a name.
  if (!preview.ok) return { locale, view: { kind: "not_found" } };

  return {
    locale,
    view: { kind: "invite", inviter: preview.data.inviter, to },
  };
}

/**
 * One load per request: `generateMetadata` and the page share the same filtered
 * answer, so metadata never asks the database for a different invite.
 */
export const getInvitePage = cache(loadInvitePage);

/**
 * Story 4.7: preview metadata names only the inviter and the product (the same
 * shape as `/l`). The token, the nick and the viewer's relation never reach it,
 * so a `not_found` metadata is indistinguishable for unknown, malformed and
 * blocked tokens. Next applies this page metadata on the 404 response and
 * injects `noindex` itself, so the title stays `Приглашение не найдено — {brand}`.
 */
export function buildInviteMetadata(page: InvitePage, brand: string): Metadata {
  const messages = getMessages(page.locale);
  const t = createTranslator({ locale: page.locale, messages, namespace: "web.invite" });
  const web = createTranslator({ locale: page.locale, messages, namespace: "web" });
  const description = web("description");

  if (page.view.kind !== "invite") {
    return {
      title: t("notFoundTitle", { brand }),
      description,
    };
  }

  const title = t("pageTitle", { name: page.view.inviter.displayName, brand });
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}
