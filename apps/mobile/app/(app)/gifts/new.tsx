import type { GiftInputDraft } from "@gift-list/contracts";
import { Column, Heading, PageContainer, PageScroll, Screen, spacing, Text, YStack } from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { createGift } from "@/api/my-gifts";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { useDiscardGuard } from "@/session/use-discard-guard";
import { pageGutter } from "@/ui/card-grid";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import {
  GiftForm,
  type GiftFormHandle,
  type GiftFormServerError,
  type GiftFormValues,
} from "@/ui/gift-form";
import { giftTagInputs } from "@/ui/gift-form-tags";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { ToastHost } from "@/ui/toast";
import { useTagCatalog } from "@/ui/use-tag-catalog";

/**
 * «Новое желание» (Story 2.2): the create screen behind `/gifts/new`. The form owns
 * the fields and the client rules; this screen only maps its values onto the
 * contract's create draft (`GiftInputDraft`, AD-12), keeps the request state and
 * reports the outcome.
 *
 * `EXPERIENCE.md` → State Patterns: an expired session leaves for login with the
 * return path and the «Сессия закончилась» reason (the login screen owns that toast);
 * a network failure never loses the draft, so the form stays exactly as it was and
 * only a toast reports it.
 *
 * A successful save leaves for the list with `?toast=gift_created`: this screen
 * unmounts on the way back, so a toast set here would never be seen (the same
 * hand-over as the login screen's `?reason=`).
 *
 * «Отмена» leaves immediately on a clean form and asks «Сохранить изменения?»
 * once the draft differs from what the screen opened with (`EXPERIENCE.md` →
 * Esc / scrim / системное «назад»). The same step offers «Сохранить», which runs
 * the form's own submit, and «Не сохранять», which leaves at once; the cross,
 * Esc and the scrim return to the form. The system back is caught by
 * `useDiscardGuard` and asks the same question. A save never asks: it leaves
 * through the list's toast param.
 */
export default function NewGiftScreen() {
  const t = useTranslations("app");
  const giftForm = useTranslations("app.giftForm");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const gutter = pageGutter(width);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<GiftFormServerError | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  // `GiftForm` reports only flips, so this mirrors «черновик отличается от исходного».
  const [dirty, setDirty] = useState(false);
  // «Сохранить изменения?» is shown before a dirty draft is thrown away.
  const [discardOpen, setDiscardOpen] = useState(false);
  // Bumped when the dialog's «Сохранить» asks the form to run its own submit.
  const [submitRequest, setSubmitRequest] = useState(0);
  // The disabled button follows a state update, which flushes after the handler:
  // a second tap in the same frame must not send a second POST.
  const inFlight = useRef(false);
  // The form's «Отмена» opened the question, so focus goes back to it afterwards.
  const formRef = useRef<GiftFormHandle>(null);
  // System back (Android hardware key, swipe) asks before a dirty draft is lost.
  // Our own ways out open the guard's synchronous bypass instead of touching this.
  const guard = useDiscardGuard(dirty && !submitting, openDiscard);
  // Story 2.5: the fixed catalogue is independent of the draft: a failed or
  // empty fetch never clears what the owner already chose.
  const tagCatalog = useTagCatalog();

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous") {
      router.replace({
        pathname: "/login",
        params: sessionExpired
          ? { next: "/gifts/new", reason: "session_expired" }
          : { next: "/gifts/new" },
      });
    }
  }, [auth.state.status, sessionExpired]);

  if (auth.state.status === "error") {
    return <SessionErrorScreen size="form" onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen size="form" />;

  async function save(values: GiftFormValues) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    // The screen owns the prop: the next submit drops the previous server error.
    setServerError(null);

    const result = await createGift(toGiftInput(values));
    inFlight.current = false;
    setSubmitting(false);

    if (result.ok) {
      // `dismissTo` pops back to the list without leaving a duplicate behind, and
      // replaces this screen when a direct link left nothing to pop. The list shows
      // the confirmation from the param and refetches on focus. The saved draft is
      // gone with the request, so this exit must never be met with the question.
      guard.allowNextLeave();
      router.dismissTo({ pathname: "/", params: { toast: "gift_created" } });
      return;
    }
    if ("network" in result) {
      setToast(t("form.network"));
      return;
    }
    if ("invalid" in result) {
      setToast(common("errors.generic"));
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      // Same as «Мой вишлист»: clear the dead session and let the guard above open
      // login with the reason and a return to this screen. Login owns the way out,
      // so the draft guard must not ask about a draft that is already gone.
      guard.allowNextLeave();
      setSessionExpired(true);
      const signedOut = await auth.signOut();
      // A failed sign-out leaves the screen mounted: report it like any other
      // network failure instead of silently pretending the session is gone.
      if (!signedOut.ok) {
        // No hand-over happened: guard the still mounted form again.
        guard.revokeLeave();
        setSessionExpired(false);
        setToast(t("form.network"));
      }
      return;
    }
    if (result.code === "VALIDATION") {
      // `GiftForm` shows the error under the field; phrase stays in the catalog.
      setServerError({ field: result.field, message: result.message });
      return;
    }
    setToast(common("errors.generic"));
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
    openDiscard();
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

  function dismissToast() {
    setToast(null);
  }

  /** The layer has left the tree: the form's «Отмена» gets focus back. */
  function restoreFormFocus() {
    formRef.current?.focusCancel();
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <Stack.Screen options={{ title: giftForm("pageTitle.create", { brand }) }} />
        {/* A form reads best narrow: `DESIGN.md` → Layout → max-form. */}
        <PageScroll testID="gift-new-page" keyboardShouldPersistTaps="handled">
          <PageContainer>
            <Column
              size="form"
              flexGrow={1}
              paddingHorizontal={gutter}
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <Heading level={1}>{giftForm("title.create")}</Heading>
              <YStack
                flexGrow={1}
                paddingTop={spacing["grid-gap"] / 2}
                paddingBottom={spacing["section-gap"]}
              >
                <GiftForm
                  ref={formRef}
                  submitting={submitting}
                  onSubmit={submit}
                  submitLabel={giftForm("action.create")}
                  serverError={serverError}
                  submitRequest={submitRequest}
                  onDirtyChange={setDirty}
                  onCancel={cancel}
                  tagCatalog={tagCatalog.state}
                  onRetryTagCatalog={tagCatalog.retry}
                />
              </YStack>
            </Column>
          </PageContainer>
        </PageScroll>
        {toast ? <ToastHost message={toast} onDismiss={dismissToast} /> : null}
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
    </Screen>
  );
}

NewGiftScreen.displayName = "NewGiftScreen";

/**
 * `GiftFormValues` names the link `link`; the API body names it `linkUrl` (AD-12).
 * The form seeds `quantity` from the contract's `DEFAULT_QUANTITY` and sends the
 * selected value, so this screen holds no `SINGLE` literal of its own.
 *
 * Story 2.5: an empty tag set is not sent at all — the create contract defaults
 * it to `[]`, and a body without the key cannot clear anything on create.
 */
function toGiftInput(values: GiftFormValues): GiftInputDraft {
  return {
    title: values.title,
    description: values.description,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency,
    linkUrl: values.link,
    visibility: values.visibility,
    quantity: values.quantity,
    ...(values.tags.length > 0 ? { tags: giftTagInputs(values.tags) } : {}),
  };
}
