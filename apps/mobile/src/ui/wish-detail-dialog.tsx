import {
  detailCopy,
  getMessages,
  toDetailFacts,
  type DetailViewer,
  type GiftCard,
} from "@gift-list/contracts";
import { Button, DetailDialog } from "@gift-list/ui";
import { openURL } from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useLocale, useTranslations } from "use-intl";
import type { DetailLoadResult } from "@/ui/wish-detail-load";

type View =
  | { status: "loading" }
  | { status: "ready"; gift: GiftCard }
  | { status: "not_found" }
  | { status: "network" }
  | { status: "unavailable" };

export type WishDetailDialogProps = {
  open: boolean;
  viewer: DetailViewer;
  /** The list card. Shown only when there is no refresh, or after a 401/403 fallback. */
  snapshot: GiftCard;
  /** Owner and signed-in guest refresh. Anonymous guest omits it. */
  load?: () => Promise<DetailLoadResult>;
  onClose: () => void;
  onClosed?: () => void;
  /** Owner only: the existing edit route. */
  onEdit?: () => void;
};

/**
 * Подробности пожелания (CLE-84). Поля берёт `toDetailFacts`: владелец не
 * получает блок брони, гость не получает видимость. Сеть — дословный текст
 * `app.form.network`.
 */
export function WishDetailDialog({
  open,
  viewer,
  snapshot,
  load,
  onClose,
  onClosed,
  onEdit,
}: WishDetailDialogProps) {
  const tGift = useTranslations("app.gift");
  const tForm = useTranslations("app.form");
  const locale = useLocale();
  const loadRef = useRef(load);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>(
    load ? { status: "loading" } : { status: "ready", gift: snapshot },
  );
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open && load) setView({ status: "loading" });
  }

  useEffect(
    function rememberLoad() {
      loadRef.current = load;
    },
    [load],
  );

  useEffect(
    function loadDetail() {
      if (!open) return;
      const current = loadRef.current;
      if (!current) {
        setView({ status: "ready", gift: snapshot });
        return;
      }
      let cancelled = false;
      setView({ status: "loading" });

      void current().then(function apply(result) {
        if (cancelled) return;
        if (result.ok) {
          setView({ status: "ready", gift: result.gift });
          return;
        }
        if (result.reason === "not_found") {
          setView({ status: "not_found" });
          return;
        }
        if (result.reason === "network") {
          setView({ status: "network" });
          return;
        }
        setView({ status: "unavailable" });
      });

      return function cancelLoad() {
        cancelled = true;
      };
    },
    [open, attempt, snapshot],
  );

  const notice =
    view.status === "loading"
      ? tGift("detail.loading")
      : view.status === "not_found"
        ? tGift("giftNotFound")
        : view.status === "network"
          ? tForm("network")
          : view.status === "unavailable"
            ? tGift("loadErrorGeneric")
            : undefined;
  const gift = view.status === "ready" ? view.gift : null;
  const facts = gift ? toDetailFacts(gift, viewer, locale, detailCopy(getMessages(locale))) : [];

  function retry() {
    setAttempt(function next(value) {
      return value + 1;
    });
  }

  return (
    <DetailDialog
      open={open}
      title={snapshot.title}
      facts={facts}
      notice={notice}
      retry={
        view.status === "network" || view.status === "unavailable"
          ? { label: tGift("retry"), onPress: retry }
          : undefined
      }
      closeLabel={tGift("detail.close")}
      onOpenHref={
        Platform.OS === "web"
          ? undefined
          : function openHref(href: string) {
              void openURL(href);
            }
      }
      onClose={onClose}
      onClosed={onClosed}
      actions={
        viewer === "owner" && onEdit && gift ? (
          <Button label={tGift("detail.edit")} variant="secondary" onPress={onEdit} />
        ) : undefined
      }
      testID="wish-detail"
    />
  );
}

WishDetailDialog.displayName = "WishDetailDialog";
