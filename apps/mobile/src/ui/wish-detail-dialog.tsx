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
import { useUndoWindow } from "@/ui/use-undo-window";
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
  /**
   * Which details action gets focus once the step has closed. «Отметить полученным»
   * is the default; an «Изменить» step hands focus back to its own button.
   */
  returnTo?: "edit" | "received";
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
  /** Owner only: the existing edit route. A closed wish has no edit (Story 5.3). */
  onEdit?: () => void;
  /**
   * Owner only (Story 5.3): «Отметить полученным» on an `OPEN` or `RESERVED` wish.
   * The screen owns the confirm: its step comes back through `step`.
   */
  onMarkReceived?: () => void;
  /**
   * Owner only (Story 5.3): «Вернуть в открытые · ещё N мин» on a closed wish,
   * shown only while the server's undo window is open.
   */
  onUndoClose?: () => void;
  /**
   * Story 5.3: the list snapshot's `undoUntil`. The refreshed card wins when it
   * carries the key, so a reopened layer counts the rest of the window from the
   * server, never from a timer of its own.
   */
  undoUntil?: string | null;
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
  onMarkReceived,
  onUndoClose,
  undoUntil,
  step,
}: WishDetailDialogProps) {
  const tGift = useTranslations("app.gift");
  const tClosed = useTranslations("app.gift.closed");
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

  // The step lands on the safe «Отмена»; leaving it puts focus back on the action
  // that opened it, so the Tab order does not fall to <body>.
  const stepKey = step?.key ?? null;
  const stepCancelRef = useRef<FocusTarget>(null);
  const receivedRef = useRef<FocusTarget>(null);
  const editRef = useRef<FocusTarget>(null);
  const previousStep = useRef<WishDetailStep | null>(step ?? null);

  useEffect(
    function moveFocusForStep() {
      const previous = previousStep.current;
      previousStep.current = step ?? null;
      if (step && previous?.key !== step.key) {
        focusInLayer(stepCancelRef.current);
        return;
      }
      if (!step && previous) {
        focusInLayer(previous.returnTo === "edit" ? editRef.current : receivedRef.current);
      }
    },
    // The step object is rebuilt on every render of the screen; only its key and
    // its presence move focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const facts = gift
    ? toDetailFacts(gift, viewer, locale, detailCopy(getMessages(locale)))
    : [];
  // Story 5.3: the owner's closed card carries the server moment; the refreshed
  // card wins. Ten minutes are not repeated here — the hook counts what is left.
  const undoWindow = useUndoWindow(gift ? (gift.undoUntil ?? undoUntil) : undoUntil);

  const canEdit =
    viewer === "owner" && gift !== null && onEdit !== undefined && gift.status !== "CLOSED";
  const canMarkReceived =
    viewer === "owner" &&
    gift !== null &&
    onMarkReceived !== undefined &&
    gift.status !== "CLOSED";
  const canUndoClose =
    viewer === "owner" &&
    gift !== null &&
    onUndoClose !== undefined &&
    gift.status === "CLOSED" &&
    undoWindow.open;

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
              // Closing a wish is not a loss: the screen picks the tone, the step
              // only turns coral when the caller says so (`destructive`).
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
        canEdit || canMarkReceived || canUndoClose ? (
          <>
            {canEdit ? (
              <Button
                ref={editRef as never}
                label={tGift("detail.edit")}
                variant="secondary"
                onPress={onEdit}
              />
            ) : null}
            {canMarkReceived ? (
              <Button
                ref={receivedRef as never}
                label={tGift("close.menuAction")}
                variant="secondary"
                onPress={onMarkReceived}
              />
            ) : null}
            {canUndoClose ? (
              <Button
                label={tClosed("undoWithTime", { minutes: undoWindow.minutes })}
                variant="secondary"
                onPress={onUndoClose}
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
