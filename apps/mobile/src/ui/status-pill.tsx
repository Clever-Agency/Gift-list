import type { GiftCard } from "@gift-list/contracts";
import { StatusPill as UiStatusPill } from "@gift-list/ui";
import { useTranslations } from "use-intl";

const STATUSES = { OPEN: "open", RESERVED: "reserved", CLOSED: "closed" } as const;

/**
 * AD-12 status, always spelled out (`DESIGN.md` → StatusPill). Not a button. The look is
 * `StatusPill` of `@gift-list/ui`; this wrapper maps the wire status and the catalogue text.
 */
export function StatusPill({ status }: { status: GiftCard["status"] }) {
  const t = useTranslations("app.gift.status");
  return <UiStatusPill status={STATUSES[status]} label={t(status)} />;
}

StatusPill.displayName = "StatusPill";
