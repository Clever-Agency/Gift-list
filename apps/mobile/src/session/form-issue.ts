import type { ActionError, ErrorCode, ErrorReason } from "@gift-list/contracts";
import type { ClientResult } from "@/api/client";

export type FormIssue = {
  field?: string;
  text: string;
  reason?: ErrorReason;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Maps an API error onto catalog copy.
 * NOTE FOR UX: пустое имя, формат email и длина пароля не имеют отдельных строк в EXPERIENCE — на поле показывается errors.code.VALIDATION.
 */
export function formIssue(
  result: Exclude<ClientResult<unknown>, { ok: true }>,
  t: Translate,
  common: Translate,
  screen: "login" | "register" | "forgot" | "reset",
): FormIssue {
  if ("network" in result) return { text: t("form.network") };
  return issueFromError(result, t, common, screen);
}

export function issueFromError(
  error: ActionError,
  t: Translate,
  common: Translate,
  screen: "login" | "register" | "forgot" | "reset",
): FormIssue {
  if (screen === "login" && error.code === "UNAUTHENTICATED") {
    return { text: t("login.invalid") };
  }
  if (error.reason === "RESET_LINK_STALE") {
    return { reason: error.reason, text: common(`errors.reason.${error.reason}`) };
  }
  if (error.reason === "EMAIL_TAKEN" || error.reason === "NICK_TAKEN") {
    return {
      field: error.field,
      reason: error.reason,
      text: common(`errors.reason.${error.reason}`),
    };
  }
  if (error.code === "VALIDATION" && error.field === "nick") {
    return { field: "nick", text: t("register.nickRules") };
  }
  if (error.field) {
    return { field: error.field, text: common(`errors.code.${error.code as ErrorCode}`) };
  }
  return { text: common(`errors.code.${error.code as ErrorCode}`) };
}

export function firstZodField(path: readonly PropertyKey[] | undefined): string | undefined {
  const head = path?.[0];
  return typeof head === "string" ? head : undefined;
}
