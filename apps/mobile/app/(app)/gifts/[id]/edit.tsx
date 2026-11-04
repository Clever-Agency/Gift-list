import type { GiftCard, GiftUpdate } from "@gift-list/contracts";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { deleteGift, fetchGift, updateGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { useDiscardGuard } from "@/session/use-discard-guard";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { pageGutter } from "@/ui/card-grid";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { restoreFocus } from "@/ui/focus";
import {
  GiftForm,
  type GiftFormHandle,
  type GiftFormServerError,
  type GiftFormValues,
} from "@/ui/gift-form";
import { PrimaryButton } from "@/ui/primary-button";
import { WishCardSkeleton } from "@/ui/skeleton";
import { ToastHost } from "@/ui/toast";

/**
 * The edit screen's reads follow the list's states: a failed read offers the retry
 * view, a missing wish is its own state, and only a broken connection claims a
 * network problem (EXPERIENCE → State Patterns).
 */
type ScreenState =
  | { status: "loading" }
  | { status: "ready"; gift: GiftCard }
  | { status: "missing" }
  | { status: "error"; kind: "network" | "generic" };

/** One toast at a time; every notice this screen raises on its own is destructive. */
type ToastState = { message: string; tone: "info" | "error" };

/**
 * «Изменить желание» (Story 2.2): the edit screen behind `/gifts/{id}/edit`. It
 * reads one own card (`fetchGift`), prefills the shared `GiftForm` and maps its
 * values back onto `GiftUpdate` (AD-12); the form owns the fields and the client
 * rules, this screen only owns the request state and reports the outcome.
 *
 * `EXPERIENCE.md` → State Patterns: an expired session leaves for login with the
 * return path and the «Сессия закончилась» reason (the login screen owns that
 * toast); a missing wish is «Желание не найдено.» with the way back to the list;
 * a network failure never loses the draft, so the form stays exactly as it was
 * and only a toast reports it.
 *
 * A successful save leaves for the list with `?toast=gift_updated`: this screen
 * unmounts on the way back, so a toast set here would never be seen (the same
 * hand-over the create screen does with `?toast=gift_created`).
 *
 * «Отмена» leaves immediately while the form is unchanged and asks «Сохранить
 * изменения?» once it differs from the wish it opened with; the same step offers
 * «Сохранить» (the form's own submit) and «Не сохранять», while the cross, Esc
 * and the scrim return to the form. The system back is caught by
 * `useDiscardGuard` and asks the same question. A save never asks.
 *
 * Story 2.3 lives next to it as a second, independent step: an open wish offers
 * «Удалить желание», which confirms in the same dialog of this form; a wish that
 * is no longer open keeps its visibility frozen and offers no delete. Only one of
 * the two steps can be open at a time.
 */
export default function EditGiftScreen() {
  const t = useTranslations("app");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);
  const skeletonWidth = Math.max(0, Math.min(width, spacing["max-form"]) - gutter * 2);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = paramValue(params.id) ?? "";
  // The guard sends a dead session back here after login, so the id travels along.
  const returnTo = `/gifts/${id}/edit`;

  const [state, setState] = useState<ScreenState>(() =>
    id === "" ? { status: "missing" } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<GiftFormServerError | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // `GiftForm` reports only flips, so this mirrors «черновик отличается от исходного».
  const [dirty, setDirty] = useState(false);
  // «Сохранить изменения?» is shown before a dirty draft is thrown away.
  const [discardOpen, setDiscardOpen] = useState(false);
  // Bumped when the dialog's «Сохранить» asks the form to run its own submit.
  const [submitRequest, setSubmitRequest] = useState(0);
  // Story 2.3: deleting is a confirm step of this form, not a separate layer.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The disabled button follows a state update, which flushes after the handler:
  // a second tap in the same frame must not send a second PATCH.
  const inFlight = useRef(false);
  // Same guard for DELETE: two taps before the first answer must delete once.
  const deleteInFlight = useRef(false);
  // The button the confirm layer was opened from, and whether focus should go back to
  // it when the layer closes: a successful delete leaves the screen, so it must not.
  const deleteButtonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const pendingDeleteFocus = useRef(false);
  // The form's «Отмена» opened the discard step, so focus goes back to it afterwards.
  const formRef = useRef<GiftFormHandle>(null);
  // System back (Android hardware key, swipe, the browser's Back) asks before a
  // dirty draft is lost. The delete step owns the back while it is open, so the
  // guard sleeps then: its own modal closes like any other layer.
  const guard = useDiscardGuard(dirty && !submitting && !confirmingDelete, openDiscard);

  const ownerId = auth.state.status === "ready" ? auth.state.user.id : null;

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous") {
      router.replace({
        pathname: "/login",
        params: sessionExpired
          ? { next: returnTo, reason: "session_expired" }
          : { next: returnTo },
      });
    }
  }, [auth.state.status, sessionExpired, returnTo]);

  useEffect(function loadGift() {
    if (!ownerId || id === "") return;
    let cancelled = false;

    async function requestGift() {
      const result = await fetchGift(id);
      if (cancelled) return;
      if (result.ok) {
        setState({ status: "ready", gift: result.gift });
        return;
      }
      if ("code" in result && result.code === "UNAUTHENTICATED") {
        // Same as «Мой вишлист»: clear the dead session and let the guard above
        // open login with the reason and a return to this screen.
        setSessionExpired(true);
        const signedOut = await auth.signOut();
        // A failed sign-out leaves the screen mounted: show the retry view, not a skeleton.
        if (!signedOut.ok && !cancelled) {
          setSessionExpired(false);
          setState({ status: "error", kind: "network" });
          setToast({ message: t("form.network"), tone: "error" });
        }
        return;
      }
      if ("code" in result && result.code === "NOT_FOUND") {
        // The wish behind the id is gone or not the owner's: its own state, not a form.
        setState({ status: "missing" });
        return;
      }
      // UX-DR6: a failure is never silent — the retry view and a toast. A body that
      // breaks the contract is not a network problem, so it gets the generic text.
      const network = "network" in result;
      setState({ status: "error", kind: network ? "network" : "generic" });
      setToast({
        message: network
          ? t("form.network")
          : "invalid" in result
            ? common("errors.generic")
            : common(`errors.code.${result.code}`),
        tone: "error",
      });
    }

    void requestGift();
    return function stopLoad() {
      cancelled = true;
    };
    // `auth` is only read on the expired-session branch; re-running the fetch on
    // every auth context update would refetch the wish for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, id, attempt]);

  if (auth.state.status !== "ready") {
    return null;
  }

  function retry() {
    setToast(null);
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  function backToList() {
    // `dismissTo` pops back to the list without leaving a duplicate behind, and
    // replaces this screen when a direct link left nothing to pop. The form is
    // already gone (missing wish), so a draft the user can no longer see must not
    // hold this exit: the bypass goes on like any other deliberate way out.
    guard.allowNextLeave();
    router.dismissTo({ pathname: "/" });
  }

  async function save(values: GiftFormValues) {
    // The form only exists in `ready`; this narrows the state for the values below.
    if (state.status !== "ready") return;
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    // The screen owns the prop: the next submit drops the previous server error.
    setServerError(null);

    const result = await updateGift(id, toGiftUpdate(values, state.gift));
    inFlight.current = false;
    setSubmitting(false);

    if (result.ok) {
      // The list shows the confirmation from the param and refetches on focus.
      // The saved draft is gone with the request, so this exit must never be met
      // with the question.
      guard.allowNextLeave();
      router.dismissTo({ pathname: "/", params: { toast: "gift_updated" } });
      return;
    }
    if ("network" in result) {
      // The draft is not lost: the form stays exactly as it was.
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as on load: clear the dead session and let the guard open login.
      guard.allowNextLeave();
      setSessionExpired(true);
      const signedOut = await auth.signOut();
      if (!signedOut.ok) {
        // No hand-over happened: guard the still mounted form again.
        guard.revokeLeave();
        setSessionExpired(false);
        setToast({ message: t("form.network"), tone: "error" });
      }
      return;
    }
    if (result.code === "NOT_FOUND") {
      // The wish disappeared while the owner was editing: report it and stop
      // pretending there is a form to save (EXPERIENCE → «Желание не найдено»).
      setState({ status: "missing" });
      setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
      return;
    }
    if (result.code === "VALIDATION") {
      // `GiftForm` shows the error under the field; phrase stays in the catalog.
      setServerError({ field: result.field, message: result.message });
      return;
    }
    setToast({ message: common(`errors.code.${result.code}`), tone: "error" });
  }

  function submit(values: GiftFormValues) {
    void save(values);
  }

  /** Leaves the form: back when something is behind, the list otherwise. */
  function leave() {
    // The user accepted the loss (or lost nothing): the guard lets this exit pass.
    guard.allowNextLeave();
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.dismissTo({ pathname: "/" });
  }

  /** System back asked to leave a dirty draft: the question opens. */
  function openDiscard() {
    setDiscardOpen(true);
  }

  function cancel() {
    // A clean form loses nothing: no dialog (EXPERIENCE → Esc / scrim / «назад»).
    if (!dirty) {
      leave();
      return;
    }
    // The delete step is the only layer of this form at a time.
    setConfirmingDelete(false);
    setDiscardOpen(true);
  }

  /** «Сохранить»: the form's own submit runs; a successful save leaves by itself. */
  function saveDiscard() {
    setDiscardOpen(false);
    // The blocked system-back action must not replay on top of the save.
    guard.cancel();
    setSubmitRequest((value) => value + 1);
  }

  /** «Не сохранять»: the draft goes and the way out the user asked for is repeated. */
  function leaveDiscard() {
    setDiscardOpen(false);
    // A system back repeats its own action; the form's «Отмена» opened the step without one.
    if (!guard.proceed()) leave();
  }

  /** Cross, Esc, scrim and Android back: back to the form, draft kept. */
  function closeDiscard() {
    setDiscardOpen(false);
    guard.cancel();
  }

  /**
   * Story 2.3: only an open wish can be deleted (`EXPERIENCE.md` → Правка
   * забронированного желания, Story 5.4 owns `RESERVED`). The request runs from
   * the confirm step; the list shows «Желание удалено.» from the param, the same
   * hand-over the save uses.
   */
  async function remove() {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleting(true);

    const result = await deleteGift(id);
    deleteInFlight.current = false;
    setDeleting(false);
    setConfirmingDelete(false);

    if (result.ok) {
      // The wish is gone and the screen leaves for the list: nothing to return to,
      // and the draft guard must not hold that exit.
      pendingDeleteFocus.current = false;
      guard.allowNextLeave();
      router.dismissTo({ pathname: "/", params: { toast: "gift_deleted" } });
      return;
    }
    if ("network" in result) {
      // The wish is still there: the form stays exactly as it was.
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in result) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as save: clear the dead session and let the guard open login.
      guard.allowNextLeave();
      setSessionExpired(true);
      const signedOut = await auth.signOut();
      if (!signedOut.ok) {
        guard.revokeLeave();
        setSessionExpired(false);
        setToast({ message: t("form.network"), tone: "error" });
      }
      return;
    }
    if (result.code === "NOT_FOUND") {
      setState({ status: "missing" });
      setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
      return;
    }
    if (result.code === "CONFLICT") {
      // It was reserved while the confirm was open: reload the wish so the
      // screen shows the real status and drops the delete action.
      setToast({ message: common("errors.code.CONFLICT"), tone: "error" });
      setState({ status: "loading" });
      setAttempt((value) => value + 1);
      return;
    }
    setToast({ message: common(`errors.code.${result.code}`), tone: "error" });
  }

  /** The confirm step's «Удалить»: the DELETE runs and reports its outcome. */
  function confirmDelete() {
    void remove();
  }

  function cancelDelete() {
    if (deleting) return;
    setConfirmingDelete(false);
  }

  function startDelete() {
    setToast(null);
    // Only one step of this form is open at a time.
    setDiscardOpen(false);
    // «Удалить желание» gets focus back once the confirm layer has closed — unless the
    // delete goes through and the screen leaves for the list.
    pendingDeleteFocus.current = true;
    setConfirmingDelete(true);
  }

  /**
   * `DESIGN.md` → Dialog: the confirm layer reports its closing, the «Удалить желание»
   * button gets focus back. A failed delete keeps the form on screen, so the button is
   * still there to return to.
   */
  function restoreDeleteFocus() {
    if (!pendingDeleteFocus.current) return;
    pendingDeleteFocus.current = false;
    restoreFocus(deleteButtonRef.current);
  }

  function dismissToast() {
    setToast(null);
  }

  /** The discard layer has left the tree: the form's «Отмена» gets focus back. */
  function restoreFormFocus() {
    formRef.current?.focusCancel();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: giftForm("pageTitle.edit", { brand }) }} />
      <View style={[styles.column, { paddingHorizontal: gutter }]}>
        <Text style={styles.logo}>{common("brandName", { brand })}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {giftForm("title.edit")}
        </Text>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {state.status === "loading" ? (
            // The list's skeleton, announced the same way (EXPERIENCE → «Загрузка»).
            <View
              accessible
              accessibilityState={{ busy: true }}
              accessibilityLabel={giftForm("loading")}
            >
              <WishCardSkeleton width={skeletonWidth} />
            </View>
          ) : state.status === "error" ? (
            <View style={styles.retry}>
              <Text style={styles.retryText}>
                {state.kind === "network"
                  ? giftForm("loadError")
                  : giftForm("loadErrorGeneric")}
              </Text>
              <PrimaryButton label={giftForm("retry")} onPress={retry} />
            </View>
          ) : state.status === "missing" ? (
            <View style={styles.retry}>
              <Text style={styles.retryText}>{giftForm("giftNotFound")}</Text>
              <PrimaryButton label={giftForm("backToList")} onPress={backToList} />
            </View>
          ) : (
            <>
              <GiftForm
                // `GiftForm` reads `initialValues` once, so another wish needs a remount.
                key={state.gift.id}
                ref={formRef}
                initialValues={toFormValues(state.gift)}
                submitting={submitting}
                onSubmit={submit}
                submitLabel={giftForm("action.save")}
                serverError={serverError}
                submitRequest={submitRequest}
                onDirtyChange={setDirty}
                onCancel={cancel}
                visibilityLocked={state.gift.status !== "OPEN"}
              />
              {/* Story 2.3: only an open wish offers deletion; Story 5.4 owns RESERVED. */}
              {state.gift.status === "OPEN" ? (
                <Pressable
                  ref={deleteButtonRef}
                  accessibilityRole="button"
                  accessibilityLabel={giftForm("delete.action")}
                  onPress={startDelete}
                  style={({ pressed }) => [
                    styles.deleteAction,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={styles.deleteLabel}>{giftForm("delete.action")}</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
      {state.status === "ready" ? (
        <ConfirmDialog
          variant="confirm"
          visible={confirmingDelete}
          title={giftForm("delete.confirmTitle", { title: state.gift.title })}
          body={giftForm("delete.confirmBody")}
          confirmLabel={deleting ? giftForm("delete.deleting") : giftForm("delete.confirm")}
          cancelLabel={giftForm("delete.cancel")}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          onClosed={restoreDeleteFocus}
        />
      ) : null}
      {toast ? (
        <ToastHost
          message={toast.message}
          tone={toast.tone}
          onDismiss={dismissToast}
        />
      ) : null}
      <ConfirmDialog
        variant="discard"
        visible={discardOpen}
        title={giftForm("discard.title")}
        confirmLabel={giftForm("discard.confirm")}
        declineLabel={giftForm("discard.decline")}
        closeLabel={t("toast.close")}
        busy={submitting}
        onConfirm={saveDiscard}
        onDecline={leaveDiscard}
        onClose={closeDiscard}
        onClosed={restoreFormFocus}
      />
    </SafeAreaView>
  );
}

/** The stored AD-12 card back into the fields the form edits. */
function toFormValues(gift: GiftCard): GiftFormValues {
  return {
    title: gift.title,
    description: gift.description,
    link: gift.linkUrl,
    priceAmount: gift.priceAmount,
    priceCurrency: gift.priceCurrency,
    visibility: gift.visibility,
  };
}

/**
 * `GiftFormValues` names the link `link`; the API body names it `linkUrl` (AD-12).
 * Visibility is frozen once the wish is no longer open (`EXPERIENCE.md` → Правка
 * забронированного желания): the server rejects a change, so the body leaves the
 * field out instead of repeating the stored value.
 */
function toGiftUpdate(values: GiftFormValues, gift: GiftCard): GiftUpdate {
  const body: GiftUpdate = {
    title: values.title,
    description: values.description,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    linkUrl: values.link,
  };
  return gift.status === "OPEN" ? { ...body, visibility: values.visibility } : body;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: "100%",
    // A form reads best narrow: `DESIGN.md` → Layout → max-form.
    maxWidth: spacing["max-form"],
    alignSelf: "center",
    paddingTop: spacing["page-gutter"],
    gap: spacing["grid-gap"] / 2,
  },
  logo: {
    ...textStyle("display-sm"),
    color: colors.primary,
    textAlign: "center",
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  scrollArea: {
    flex: 1,
  },
  scroll: {
    paddingTop: spacing["grid-gap"] / 2,
    paddingBottom: spacing["section-gap"],
  },
  retry: {
    width: "100%",
    paddingVertical: spacing["section-gap"] / 2,
    gap: spacing["grid-gap"],
  },
  retryText: {
    ...textStyle("body"),
    color: colors["muted-foreground"],
    textAlign: "center",
  },
  // Secondary destructive action under the form: text only, 44×44 (`DESIGN.md` → buttons).
  deleteAction: {
    alignSelf: "flex-start",
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  deleteLabel: {
    ...textStyle("button"),
    color: colors.destructive,
  },
  pressed: {
    opacity: 0.9,
  },
});
