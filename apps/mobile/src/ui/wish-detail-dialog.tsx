import {
  detailCopy,
  getMessages,
  toDetailFacts,
  type DetailViewer,
  type GiftCard,
} from "@gift-list/contracts";
import { Button, DetailDialog, focusInLayer, type FocusTarget } from "@gift-list/ui";
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

/**
 * A step inside the details layer (`DESIGN.md` → BottomSheet / Dialog: confirm —
 * шаг в том же слое, не больше одного слоя). The screen owns the step's data and
 * its lifecycle; this dialog only swaps the layer's title, body and actions, so a
 * later story adds its own step as another object instead of a second layer and
 * without a new branch here.
 */
export type WishDetailStep = {
  /** Stable id, e.g. `release`; a change of the key moves focus into the step. */
  key: string;
  title: string;
  /** The warning line under the title, from the catalog. */
  body?: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Coral confirm: for removing someone else's data (`DESIGN.md` → Colors → Destructive). */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  /** «Отмена», Esc, the cross: back to the details of the same wish. */
  onCancel: () => void;
};

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
  /**
   * Owner only (Story 5.2): asks the screen to run the preflight of a release of
   * someone else's reservation. The owner's «Снять бронь» is coral, because it
   * removes another person's action.
   */
  onRelease?: () => void;
  /**
   * The step shown instead of the details (Story 5.2). Absent or `null` shows the
   * details; the screen sets it once the preflight has answered.
   */
  step?: WishDetailStep | null;
};

/**
 * Подробности пожелания (CLE-84). Поля берёт `toDetailFacts`: владелец не
 * получает блок брони, гость не получает видимость. Сеть — дословный текст
 * `app.form.network`. Шаг подтверждения (Story 5.2) — тот же слой.
 */
export function WishDetailDialog({
  open,
  viewer,
  snapshot,
  load,
  onClose,
  onClosed,
  onEdit,
  onRelease,
  step,
}: WishDetailDialogProps) {
  const tGift = useTranslations("app.gift");
  const tRelease = useTranslations("app.gift.release");
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

  // The destructive step lands on the safe «Отмена»; leaving it puts focus back on
  // the coral action that opened it, so the Tab order does not fall to <body>.
  const stepKey = step?.key ?? null;
  const stepCancelRef = useRef<FocusTarget>(null);
  const releaseRef = useRef<FocusTarget>(null);
  const previousStep = useRef<string | null>(stepKey);

  useEffect(
    function moveFocusForStep() {
      const previous = previousStep.current;
      previousStep.current = stepKey;
      if (stepKey !== null && previous !== stepKey) {
        focusInLayer(stepCancelRef.current);
        return;
      }
      if (stepKey === null && previous !== null) {
        focusInLayer(releaseRef.current);
      }
    },
    [stepKey],
  );

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

  if (step) {
    return (
      <DetailDialog
        open={open}
        title={step.title}
        notice={step.body}
        closeLabel={tGift("detail.close")}
        onClose={step.onCancel}
        onClosed={onClosed}
        actions={
          <>
            <Button
              ref={stepCancelRef as never}
              label={step.cancelLabel}
              variant="ghost"
              onPress={step.onCancel}
              disabled={step.busy}
            />
            <Button
              label={step.confirmLabel}
              variant={step.destructive ? "destructive" : "primary"}
              onPress={step.onConfirm}
              busy={step.busy}
            />
          </>
        }
        testID="wish-detail"
      />
    );
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
        viewer === "owner" && gift && (onEdit || onRelease) ? (
          <>
            {onEdit ? (
              <Button label={tGift("detail.edit")} variant="secondary" onPress={onEdit} />
            ) : null}
            {onRelease && gift.status === "RESERVED" ? (
              <Button
                ref={releaseRef as never}
                label={tRelease("confirm")}
                variant="destructive"
                onPress={onRelease}
              />
            ) : null}
          </>
        ) : undefined
      }
      testID="wish-detail"
    />
  );
}

WishDetailDialog.displayName = "WishDetailDialog";
