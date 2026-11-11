import {
  GIFT_DESCRIPTION_MAX,
  GIFT_LINK_URL_MAX,
  GIFT_TITLE_MAX,
  textLength,
  type GiftCard,
  type GiftUpdate,
} from "@gift-list/contracts";
import { Column, Heading, LoadingCards, PageContainer, PageScroll, Pressable, SafeArea, Screen, Text, YStack } from "@gift-list/ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { useTranslations } from "use-intl";
import type { ClientResult } from "@/api/client";
import { deleteGift, fetchGift, previewGiftVisibility, updateGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { mutationErrorMessage } from "@/session/form-issue";
import { paramValue } from "@/session/return-path";
import { useDiscardGuard } from "@/session/use-discard-guard";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { restoreFocus } from "@/ui/focus";
import {
  GiftForm,
  type GiftFormHandle,
  type GiftFormServerError,
  type GiftFormValues,
} from "@/ui/gift-form";
import {
  giftTagFromCard,
  giftTagInputs,
  giftTagsEqual,
} from "@/ui/gift-form-tags";
import { PrimaryButton } from "@/ui/primary-button";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";
import { useTagCatalog } from "@/ui/use-tag-catalog";

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
 * A failed request of this screen: the transport, the envelope, or a body that broke
 * the shared contract. `invalid` is the client's own outcome, so it is not part of
 * `ClientResult`.
 */
type FailedRequest =
  | { ok: false; invalid: true }
  | Exclude<ClientResult<unknown>, { ok: true }>;

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
 * is no longer open offers no delete.
 *
 * CLE-82/S23.3: a reserved wish may still change its visibility, and only a change
 * that would take the holder's access away asks first — the preflight answers
 * whether the reservation would be released, then the confirm «Бронирующий
 * потеряет доступ, бронь снимется» runs the one PATCH with every field. A `CLOSED`
 * or archived wish is read-only (`GiftForm` → `readOnly`).
 */
export default function EditGiftScreen() {
  const t = useTranslations("app");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = paramValue(params.id) ?? "";
  // The guard sends a dead session back here after login, so the id travels along.
  const returnTo = `/gifts/${id}/edit`;

  const [state, setState] = useState<ScreenState>(function initialScreenState() {
    return id === "" ? { status: "missing" } : { status: "loading" };
  });
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
  // CLE-82/S23.3: a visibility change on a reserved wish may ask before it saves.
  // The pending values wait here while the confirm is open.
  const [visibilityDraft, setVisibilityDraft] = useState<GiftFormValues | null>(null);
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
  const guard = useDiscardGuard(
    dirty && !submitting && !confirmingDelete && visibilityDraft === null,
    openDiscard,
  );
  // Story 2.5: the catalogue only offers fixed tags; it never resets the stored
  // selection when the request fails or the server has no seed yet.
  const tagCatalog = useTagCatalog();

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

  if (auth.state.status === "error") {
    return <SessionErrorScreen size="form" onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") {
    return <SessionLoadingScreen size="form" />;
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

  /**
   * The save, opened by the form's button (or by the discard step's «Сохранить»).
   * CLE-82/S23.3: when a reserved wish changes its visibility, the preflight runs
   * first — a change that would release the reservation waits for the confirm, and
   * every other case saves right away. `approved` is the confirm's answer, so the
   * same rule is not asked twice.
   */
  async function save(values: GiftFormValues, approved = false) {
    // The form only exists in `ready`; this narrows the state for the values below.
    if (state.status !== "ready") return;
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    // The screen owns the prop: the next submit drops the previous server error.
    setServerError(null);

    if (!approved && needsVisibilityConfirm(state.gift, values)) {
      const preview = await previewGiftVisibility(id, values.visibility);
      inFlight.current = false;
      setSubmitting(false);
      if (!preview.ok) {
        await reportIssue(preview);
        return;
      }
      if (preview.preview.wouldCancelReservation) {
        // Nothing is written until the person accepts the loss of the reservation.
        setVisibilityDraft(values);
        return;
      }
      await save(values, true);
      return;
    }

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
      if (result.reason !== undefined) {
        // Not a field problem: the reason has its own sentence — an oversized body,
        // or a wish that is archived or closed now (CLE-82/S23.3).
        setToast({ message: mutationErrorMessage(result, common), tone: "error" });
        if (result.reason === "GIFT_ARCHIVED" || result.reason === "GIFT_CLOSED") {
          // Re-read it so the form becomes the read-only one it really is.
          reloadGift();
        }
        return;
      }
      // `GiftForm` shows the error under the field; phrase stays in the catalog.
      setServerError({ field: result.field });
      return;
    }
    if (result.code === "CONFLICT") {
      // It was reserved (or released) while the form was open: say so and re-read
      // the wish instead of saving over a state the owner has not seen (S23.2b).
      setToast({ message: common("errors.code.CONFLICT"), tone: "error" });
      reloadGift();
      return;
    }
    setToast({ message: common(`errors.code.${result.code}`), tone: "error" });
  }

  function submit(values: GiftFormValues) {
    void save(values);
  }

  /** «Подтвердить»: the person accepted the loss, so the one PATCH runs with every field. */
  async function confirmVisibility() {
    const values = visibilityDraft;
    if (!values) return;
    // The dialog stays up with its busy confirmation while the request runs; a
    // successful save leaves for the list, a failure closes it back onto the form.
    await save(values, true);
    setVisibilityDraft(null);
  }

  /** «Отмена», Esc, the scrim and Android back: nothing is saved, the draft stays. */
  function cancelVisibility() {
    if (submitting) return;
    setVisibilityDraft(null);
  }

  /** The confirm step has left the tree: «Сохранить» gets focus back. */
  function restoreSubmitFocus() {
    formRef.current?.focusSubmit();
  }

  /** Re-reads the wish: the form then shows its real status (read-only or reserved). */
  function reloadGift() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  /**
   * A failed preflight: nothing is written, so the draft stays and the same sentences
   * the save uses are shown. A wish that is archived, closed or gone by now is a state
   * of the screen, not of the form, so it re-reads the wish (or stops pretending there
   * is one to edit).
   */
  async function reportIssue(issue: FailedRequest): Promise<void> {
    if ("network" in issue) {
      setToast({ message: t("form.network"), tone: "error" });
      return;
    }
    if ("invalid" in issue) {
      setToast({ message: common("errors.generic"), tone: "error" });
      return;
    }
    if (issue.code === "UNAUTHENTICATED") {
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
    if (issue.code === "NOT_FOUND") {
      setState({ status: "missing" });
      setToast({ message: common("errors.code.NOT_FOUND"), tone: "error" });
      return;
    }
    if (issue.code === "VALIDATION") {
      setToast({ message: mutationErrorMessage(issue, common), tone: "error" });
      reloadGift();
      return;
    }
    setToast({ message: common(`errors.code.${issue.code}`), tone: "error" });
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
    // The delete step and the visibility confirm are the other layers of this form.
    setConfirmingDelete(false);
    setVisibilityDraft(null);
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
    setVisibilityDraft(null);
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
    <Screen>
      <SafeArea>
        <Stack.Screen options={{ title: giftForm("pageTitle.edit", { brand }) }} />
        {/* A form reads best narrow: `DESIGN.md` → Layout → max-form. The gutter is
            the Tamagui media clause `$page-gutter medium:$page-gutter-lg`, so the
            window width is never read in JS: there is no card grid here. */}
        <PageScroll testID="gift-edit-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{giftForm("title.edit")}</Heading>
              <YStack
                flexGrow={1}
                paddingTop="$2"
                paddingBottom="$section-gap"
              >
                {state.status === "loading" ? (
                  // The same named busy region as the list, with one form-width card:
                  // a percentage fills the column's `max-form` box, so the skeleton no
                  // longer needs the window width either.
                  <LoadingCards
                    testID="gift-edit-loading"
                    label={giftForm("loading")}
                    width="100%"
                    count={1}
                  />
                ) : state.status === "error" ? (
                  <YStack width="100%" paddingVertical="$4" gap="$grid-gap">
                    <Text tone="muted" textAlign="center">
                      {state.kind === "network"
                        ? giftForm("loadError")
                        : giftForm("loadErrorGeneric")}
                    </Text>
                    <PrimaryButton label={giftForm("retry")} onPress={retry} />
                  </YStack>
                ) : state.status === "missing" ? (
                  <YStack width="100%" paddingVertical="$4" gap="$grid-gap">
                    <Text tone="muted" textAlign="center">
                      {giftForm("giftNotFound")}
                    </Text>
                    <PrimaryButton label={giftForm("backToList")} onPress={backToList} />
                  </YStack>
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
                      // Story 2.3: only an open wish offers deletion; Story 5.4 owns RESERVED.
                      // An archived wish is read-only (CLE-82/S23.3), so it offers none either.
                      // The destructive action rides in the form's own button row (first, left),
                      // text only, 44×44 (`DESIGN.md` → buttons); the ref keeps the focus return.
                      secondaryAction={
                        state.gift.status === "OPEN" && state.gift.archivedAt === null ? (
                          <Pressable
                            ref={deleteButtonRef}
                            role="button"
                            aria-label={giftForm("delete.action")}
                            onPress={startDelete}
                            justifyContent="center"
                            minHeight="$touch-target"
                            minWidth="$touch-target"
                            paddingHorizontal="$3"
                          >
                            <Text kind="button" tone="destructive">
                              {giftForm("delete.action")}
                            </Text>
                          </Pressable>
                        ) : undefined
                      }
                      // CLE-82/S23.3: a closed or archived wish is one read-only form;
                      // a reserved one still changes its visibility, only quantity is frozen.
                      readOnly={
                        state.gift.status === "CLOSED" || state.gift.archivedAt !== null
                      }
                      quantityLocked={state.gift.status !== "OPEN"}
                      tagCatalog={tagCatalog.state}
                      onRetryTagCatalog={tagCatalog.retry}
                    />
                  </>
                )}
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
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
          <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
        ) : null}
        {/* CLE-82/S23.3: a reserved wish loses its holder only after this answer. The
            busy state is the same one the submit button shows while the PATCH runs. */}
        <ConfirmDialog
          variant="confirm"
          visible={visibilityDraft !== null}
          title={t("gift.visibilityConfirm.title")}
          confirmLabel={t("gift.visibilityConfirm.confirm")}
          cancelLabel={t("gift.visibilityConfirm.cancel")}
          busy={submitting}
          onConfirm={confirmVisibility}
          onCancel={cancelVisibility}
          onClosed={restoreSubmitFocus}
        />
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
      </SafeArea>
    </Screen>
  );
}

EditGiftScreen.displayName = "EditGiftScreen";

/** The stored AD-12 card back into the fields the form edits. */
function toFormValues(gift: GiftCard): GiftFormValues {
  return {
    title: gift.title,
    description: gift.description,
    link: gift.linkUrl,
    priceAmount: gift.priceAmount,
    priceCurrency: gift.priceCurrency,
    visibility: gift.visibility,
    quantity: gift.quantity,
    tags: gift.tags.map(giftTagFromCard),
  };
}

/**
 * `GiftFormValues` names the link `link`; the API body names it `linkUrl` (AD-12).
 * Story 2.5 froze `quantity` once the wish is no longer open; CLE-82/S23.3 lets the
 * owner change `visibility` on a `RESERVED` wish too, so only `quantity` stays out
 * of a reserved body. A closed or archived wish is read-only and never submits.
 * An unchanged `OPEN` edit sends the stored values, which the server treats as a
 * no-op.
 *
 * A stored text value longer than the current cap is legacy data (the contract
 * has always capped these fields, so only a direct database write can produce
 * one). Such an untouched value is left out of the body: the server would reject
 * it as VALIDATION, while an absent key keeps it, so the owner can still change
 * another field and save. The form does not report an untouched legacy value
 * either — see `GiftFormBaseline`.
 *
 * Story 2.5: `tags` is a full replacement, so the key is sent only when the set
 * actually changed. An unchanged edit omits it (the server keeps the stored
 * rows); removing the last tag sends `[]` and clears them.
 */
function toGiftUpdate(values: GiftFormValues, gift: GiftCard): GiftUpdate {
  const tagsChanged = !giftTagsEqual(values.tags, gift.tags.map(giftTagFromCard));
  const body: GiftUpdate = {
    ...(keepsStoredText(values.title, gift.title, GIFT_TITLE_MAX)
      ? {}
      : { title: values.title }),
    ...(keepsStoredText(values.description ?? "", gift.description, GIFT_DESCRIPTION_MAX)
      ? {}
      : { description: values.description }),
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    ...(keepsStoredText(values.link ?? "", gift.linkUrl, GIFT_LINK_URL_MAX)
      ? {}
      : { linkUrl: values.link }),
    ...(tagsChanged ? { tags: giftTagInputs(values.tags) } : {}),
  };
  if (gift.status === "OPEN" || gift.status === "RESERVED") {
    body.visibility = values.visibility;
  }
  // Only an open wish changes its type: a reserved one keeps the stored `quantity`.
  if (gift.status === "OPEN") body.quantity = values.quantity;
  return body;
}

/**
 * A reserved wish changes its visibility: the preflight and the confirm are only
 * about a real change. An unchanged value is a no-op the server would accept
 * anyway, so it needs no question.
 */
function needsVisibilityConfirm(gift: GiftCard, values: GiftFormValues): boolean {
  return gift.status === "RESERVED" && values.visibility !== gift.visibility;
}

/**
 * The value is exactly the stored one and already over the cap: re-sending it
 * would fail the server's schema, so the key is omitted and the row keeps it.
 * The form shows no error for an untouched value either (`GiftFormBaseline`);
 * both compare the trimmed text, so surrounding spaces are not an edit.
 */
function keepsStoredText(
  value: string,
  stored: string | null,
  max: number,
): boolean {
  const text = value.trim();
  return text === (stored ?? "").trim() && textLength(text) > max;
}
