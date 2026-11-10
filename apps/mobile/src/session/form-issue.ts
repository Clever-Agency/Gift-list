import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  type ActionError,
  type ErrorCode,
  type ErrorReason,
} from "@gift-list/contracts";
import type { ClientResult } from "@/api/client";

export type FormIssue = {
  field?: string;
  text: string;
  reason?: ErrorReason;
};

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Maps an API error onto catalog copy.
 * NOTE FOR UX: пустое имя и формат email не имеют отдельных строк в EXPERIENCE — на поле показывается errors.code.VALIDATION.
 * Длины пароля в «Ошибки форм» нет: короткий пароль на регистрации и новом пароле показывает form.passwordRules (passwordFieldIssue), как register.nickRules.
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
  if (error.code === "RATE_LIMITED") {
    return { text: common("errors.code.RATE_LIMITED", rateLimitValues(error.params) ?? { unit: "other" }) };
  }
  if (error.field) {
    return { field: error.field, text: common(`errors.code.${error.code as ErrorCode}`) };
  }
  return { text: common(`errors.code.${error.code as ErrorCode}`) };
}

function rateLimitValues(
  params: ActionError["params"],
): Record<string, string | number> | undefined {
  const unit = params?.unit;
  const count = params?.count;
  if ((unit !== "second" && unit !== "minute") || typeof count !== "number") return undefined;
  return { unit, count };
}

/**
 * Short and over-long passwords on register and reset: the catalog sentence of
 * the rule, never the generic "check your input". Both bounds come from the
 * contract and are counted the way the server counts a password — UTF-16 code
 * units (`PASSWORD_MIN`/`PASSWORD_MAX`), so an emoji is two. The value is only
 * measured: it is never trimmed or normalised here.
 */
export function passwordFieldIssue(password: string, t: Translate, common: Translate): FormIssue {
  if (password.length < PASSWORD_MIN) return { field: "password", text: t("form.passwordRules") };
  if (password.length > PASSWORD_MAX) {
    return { field: "password", text: t("form.passwordTooLong", { max: PASSWORD_MAX }) };
  }
  return { field: "password", text: common("errors.code.VALIDATION") };
}

/**
 * Sign-in keeps the stored lower bound at 1 (a legacy short password must pass
 * the length check), so only the upper bound has its own sentence. Everything
 * else stays the generic text of the screen.
 */
export function loginPasswordFieldIssue(
  password: string,
  t: Translate,
  common: Translate,
): FormIssue {
  return password.length > PASSWORD_MAX
    ? { field: "password", text: t("form.passwordTooLong", { max: PASSWORD_MAX }) }
    : { field: "password", text: common("errors.code.VALIDATION") };
}

export function firstZodField(path: readonly PropertyKey[] | undefined): string | undefined {
  const head = path?.[0];
  return typeof head === "string" ? head : undefined;
}
