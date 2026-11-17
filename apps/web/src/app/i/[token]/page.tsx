import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBrandName } from "@/lib/env";
import { buildInviteMetadata, getInvitePage } from "./invite-page";
import { InvitePreviewView } from "./invite-preview-view";

/**
 * Story 4.7 / AD-21, AD-26: the first view of an invite link, rendered by the
 * server for anonymous visitors and for messenger previews. A real session never
 * sees this page: it is handed to the SPA route `/invite/{token}`, built from the
 * validated segment only, where the own link, existing friends and the
 * confirmation are shown. The page reads only: a preview never creates an edge.
 *
 * An unknown or malformed token and a `Block` render the segment `not-found.tsx`
 * through `notFound()`: a real HTTP 404 before streaming starts, one page for
 * every hidden cause (CLE-103).
 */
export async function generateMetadata({
  params,
}: PageProps<"/i/[token]">): Promise<Metadata> {
  const { token } = await params;
  const page = await getInvitePage(token);
  return buildInviteMetadata(page, getBrandName());
}

export default async function InvitePreviewPage({ params }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const page = await getInvitePage(token);
  if (page.view.kind === "redirect") redirect(page.view.to);
  if (page.view.kind === "not_found") notFound();

  return (
    <InvitePreviewView view={page.view} locale={page.locale} brand={getBrandName()} />
  );
}

InvitePreviewPage.displayName = "InvitePreviewPage";
