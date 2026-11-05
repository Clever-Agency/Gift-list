import { EmptyState as UiEmptyState } from "@gift-list/ui";
import type { ReactNode } from "react";

/** `DESIGN.md` → EmptyState: display title, one body line, at most one primary CTA. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return <UiEmptyState title={title} body={body} action={action} />;
}

EmptyState.displayName = "EmptyState";
