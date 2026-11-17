import { headers } from "next/headers";
import { getMessages } from "@gift-list/contracts";
import { PublicNotFound } from "@/components/public-not-found";
import { requestLocale } from "@/lib/request-locale";

/**
 * The page-level 404 of `/i/[token]` (CLE-103): an unknown or malformed token and
 * a `Block` all land here through `notFound()`. The sentence and the footer are
 * the shared ones, so the 404 looks like the rest of the public shell (AD-12 ред.
 * 2026-11-17).
 */
export default async function InviteNotFound() {
  const locale = requestLocale((await headers()).get("accept-language"));

  return <PublicNotFound locale={locale} message={getMessages(locale).web.invite.notFound} />;
}

InviteNotFound.displayName = "InviteNotFound";
