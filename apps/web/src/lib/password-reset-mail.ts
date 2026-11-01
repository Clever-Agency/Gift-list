import "server-only";

import { createTranslator } from "next-intl";
import { Resend } from "resend";
import { getMessages, negotiateLocale } from "@gift-list/contracts";
import { getBrandName, getEnv } from "@/lib/env";

/** `https://{host}/reset?token=` from `BETTER_AUTH_URL`. Never the `/api/auth` callback. */
export function passwordResetLink(betterAuthUrl: string, token: string): string {
  const base = new URL(betterAuthUrl);
  const href = new URL("/reset", `https://${base.host}`);
  href.searchParams.set("token", token);
  return href.toString();
}

/** Same-origin page Better Auth checks before it stores the token. Protocol follows `BETTER_AUTH_URL`. */
export function passwordResetRedirectTo(betterAuthUrl: string): string {
  return new URL("/reset", betterAuthUrl).toString();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildPasswordResetMessage(locale: string | null, token: string, betterAuthUrl: string) {
  const resolved = negotiateLocale(locale ? [locale] : []);
  const t = createTranslator({
    locale: resolved,
    messages: getMessages(resolved),
    namespace: "email",
  });
  const brand = getBrandName();
  const href = passwordResetLink(betterAuthUrl, token);
  const textBody = t("passwordReset.text");
  const action = t("passwordReset.action");
  return {
    href,
    subject: t("passwordReset.subject", { brand }),
    text: `${textBody}\n\n${href}`,
    html: `<!DOCTYPE html><html lang="${escapeHtml(resolved)}"><body><p>${escapeHtml(textBody)}</p><p><a href="${escapeHtml(href)}">${escapeHtml(action)}</a></p></body></html>`,
  };
}

/**
 * Sends the reset letter. Resend failures are logged and not rethrown:
 * the forgot response stays the same whether or not the letter went out.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  locale: string | null;
  token: string;
}): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.error("Password reset email is not configured");
    return;
  }
  const message = buildPasswordResetMessage(input.locale, input.token, env.BETTER_AUTH_URL);
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (error) console.error("Password reset email failed", error);
  } catch (error) {
    console.error("Password reset email failed", error);
  }
}
