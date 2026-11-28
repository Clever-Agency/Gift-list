import { emailChangeBodySchema } from "@gift-list/contracts";
import { Button, focusField, Text, YStack } from "@gift-list/ui";
import { useEffect, useRef, useState } from "react";
import type { TextInputInstance } from "react-native";
import { useTranslations } from "use-intl";
import { cancelEmailChange, requestEmailChange } from "@/api/me";
import { issueFromError } from "@/session/form-issue";
import { TextField } from "@/ui/text-field";

/** Where the email block is: the read-only row, the new-address field or the waiting notice. */
export type EmailChangeMode = "idle" | "form" | "sent";

/** One toast at a time; a cancelled request is neutral, a failed one is destructive. */
type ToastNote = (message: string, tone: "info" | "error") => void;

/** The change of the account address (FR-56, D-58, Story 6.8). */
export type EmailChangeBlockProps = {
  /** The address the account has right now; it stays active until the link is opened. */
  email: string;
  mode: EmailChangeMode;
  /** The typed new address; kept while the form is open. */
  value: string;
  /** The reason under the field or under the waiting notice. */
  error?: string;
  /** The address the letter went to; only the waiting notice uses it. */
  sentTo?: string;
  /** A send, a resend or a cancel is in flight. */
  busy: boolean;
  onChange: (value: string) => void;
  /** «Изменить» opens the field. */
  onEdit: () => void;
  /** «Отправить письмо» of the form. */
  onSubmit: () => void;
  /** «Отмена» of the form: closes it without a request. */
  onClose: () => void;
  /** «Отправить ещё раз» of the waiting notice. */
  onResend: () => void;
  /** «Отменить» of the waiting notice: drops the pending request on the server. */
  onCancel: () => void;
  testIDPrefix?: string;
};

/**
 * The email row of «Профиль» in all three states. It is presentational on
 * purpose: the catalogue states that are hard to reach from a story (a failed
 * send, a live rate limit) stay story-able, and the screen keeps the requests.
 * The current address is always visible, because the account keeps it until the
 * one-time link is opened (FR-56).
 */
export function EmailChangeBlock({
  email,
  mode,
  value,
  error,
  sentTo,
  busy,
  onChange,
  onEdit,
  onSubmit,
  onClose,
  onResend,
  onCancel,
  testIDPrefix = "profile-email",
}: EmailChangeBlockProps) {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const input = useRef<TextInputInstance | null>(null);

  // The pressed «Изменить» puts the cursor into the new field: the block is one
  // press away from typing, as the name and nick forms are.
  useEffect(
    function focusNewAddress() {
      if (mode !== "form") return;
      focusField(input.current);
    },
    [mode],
  );

  return (
    <YStack alignItems="center" gap="$2" width="100%" testID={`${testIDPrefix}-change`}>
      <YStack alignItems="center">
        <Text kind="caption" tone="muted">
          {t("form.email")}
        </Text>
        <Text testID={testIDPrefix}>{email}</Text>
      </YStack>
      {mode === "idle" ? (
        <Button
          variant="outline"
          label={profile("emailChange.change")}
          ariaLabel={profile("emailChange.changeLabel")}
          onPress={onEdit}
          testID={`${testIDPrefix}-edit`}
        />
      ) : null}
      {mode === "form" ? (
        <YStack gap="$grid-gap" width="100%" alignItems="stretch">
          <TextField
            label={profile("emailChange.newEmail")}
            value={value}
            onChangeText={onChange}
            error={error}
            inputRef={input}
            input={{
              autoCapitalize: "none",
              autoComplete: "email",
              autoCorrect: false,
              editable: !busy,
              inputMode: "email",
              keyboardType: "email-address",
              textContentType: "emailAddress",
              onSubmitEditing: onSubmit,
            }}
          />
          <Button
            label={profile("emailChange.send")}
            onPress={onSubmit}
            busy={busy}
            testID={`${testIDPrefix}-send`}
          />
          <Button
            variant="ghost"
            label={profile("emailChange.cancel")}
            onPress={onClose}
            disabled={busy}
            testID={`${testIDPrefix}-close`}
          />
        </YStack>
      ) : null}
      {mode === "sent" ? (
        <YStack gap="$grid-gap" width="100%" alignItems="stretch">
          <Text aria-live="polite" testID={`${testIDPrefix}-sent`}>
            {profile("emailChange.sent", { email: sentTo ?? "" })}
          </Text>
          {error ? (
            <Text kind="caption" tone="destructive" role="alert">
              {error}
            </Text>
          ) : null}
          <Button
            variant="outline"
            label={profile("emailChange.resend")}
            onPress={onResend}
            busy={busy}
            testID={`${testIDPrefix}-resend`}
          />
          <Button
            variant="ghost"
            label={profile("emailChange.waitingCancel")}
            onPress={onCancel}
            disabled={busy}
            testID={`${testIDPrefix}-cancel`}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

EmailChangeBlock.displayName = "EmailChangeBlock";

/**
 * The email block of «Профиль» with its requests (CLE-129/T9.2, FR-56).
 *
 * The address is validated with the shared contract rule first, so an invalid
 * or current address never reaches the server. A sent request opens the waiting
 * notice: the account still signs in with the old address, and the notice only
 * promises the letter. The waiting state lives on this screen — nothing about a
 * pending request is stored on the client — and «Отменить» asks the server to
 * forget the wish.
 */
export function EmailChangeSection({
  email,
  onToast,
  onExpired,
}: {
  email: string;
  onToast: ToastNote;
  onExpired: () => Promise<void>;
}) {
  const t = useTranslations("app");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const [mode, setMode] = useState<EmailChangeMode>("idle");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  function startEdit() {
    setValue("");
    setError(undefined);
    setMode("form");
  }

  function changeValue(next: string) {
    setValue(next);
    setError(undefined);
  }

  function closeForm() {
    if (inFlight.current) return;
    setValue("");
    setError(undefined);
    setMode("idle");
  }

  function submit() {
    if (inFlight.current) return;
    const parsed = emailChangeBodySchema.safeParse({ email: value });
    if (!parsed.success) {
      setError(common("errors.code.VALIDATION"));
      return;
    }
    if (parsed.data.email === email.trim().toLowerCase()) {
      setError(profile("emailChange.same"));
      return;
    }
    void send(parsed.data.email);
  }

  function resend() {
    if (inFlight.current || sentTo === "") return;
    void send(sentTo);
  }

  async function send(address: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);

    const result = await requestEmailChange(address);

    inFlight.current = false;
    setBusy(false);

    if (result.ok) {
      setSentTo(address);
      setValue("");
      setMode("sent");
      return;
    }
    if ("network" in result) {
      onToast(t("form.network"), "error");
      return;
    }
    if ("invalid" in result) {
      onToast(common("errors.generic"), "error");
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      await onExpired();
      return;
    }
    // A live rate limit keeps the notice and names the wait in the same words as
    // the rest of auth (`errors.code.RATE_LIMITED`).
    setError(issueFromError(result, t, common, "profile").text);
  }

  async function cancel() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);

    const result = await cancelEmailChange();

    inFlight.current = false;
    setBusy(false);

    if (result.ok) {
      setSentTo("");
      setMode("idle");
      onToast(profile("emailChange.cancelled"), "info");
      return;
    }
    if ("network" in result) {
      onToast(t("form.network"), "error");
      return;
    }
    if ("invalid" in result) {
      onToast(common("errors.generic"), "error");
      return;
    }
    if (result.code === "UNAUTHENTICATED") {
      await onExpired();
      return;
    }
    setError(issueFromError(result, t, common, "profile").text);
  }

  function handleEdit() {
    startEdit();
  }

  function handleSubmit() {
    submit();
  }

  function handleClose() {
    closeForm();
  }

  function handleResend() {
    resend();
  }

  function handleCancel() {
    void cancel();
  }

  return (
    <EmailChangeBlock
      email={email}
      mode={mode}
      value={value}
      error={error}
      sentTo={sentTo}
      busy={busy}
      onChange={changeValue}
      onEdit={handleEdit}
      onSubmit={handleSubmit}
      onClose={handleClose}
      onResend={handleResend}
      onCancel={handleCancel}
    />
  );
}

EmailChangeSection.displayName = "EmailChangeSection";

/**
 * The clear sentence of a failed confirmation link. Better Auth appends its own
 * `error` code to the callback; an unknown one (or a missing one) still says
 * what to do next, never an English API code.
 */
export function emailChangeLinkError(
  code: string | undefined,
  profile: (key: string) => string,
): string {
  if (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN" || code === "USER_NOT_FOUND") {
    return profile(`emailChange.linkError.${code}`);
  }
  return profile("emailChange.linkError.other");
}
