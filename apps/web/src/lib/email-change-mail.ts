import "server-only";

import { AUTHOR_EMAIL, negotiateLocale } from "@gift-list/contracts";
import { getWebMessages } from "@gift-list/contracts/web-messages";
import { createTranslator } from "next-intl";
import { Resend } from "resend";
import { getBrandName, getEnv } from "@/lib/env";
import { escapeHtml } from "@/lib/password-reset-mail";

/**
 * CLE-129/T9.1 (FR-56, D-58, AD-3): the two letters of an email change.
 * `emailChange` goes to the **new** address and carries the one-time link; the
 * address is applied only when that link is opened. `emailChanged` goes to the
 * **old** address after the change has been committed, so a hijack is noticed.
 * Both reuse the catalog of letters (`email` namespace), like the reset letter.
 */
function translator(locale: string | null) {
  const resolved = negotiateLocale(locale ? [locale] : []);
  const t = createTranslator({
    locale: resolved,
    messages: getWebMessages(resolved),
    namespace: "email",
  });
  return { resolved, t };
}

export function buildEmailChangeMessage(locale: string | null, url: string) {
  const { resolved, t } = translator(locale);
  const brand = getBrandName();
  const textBody = t("emailChange.text");
  const action = t("emailChange.action");
  return {
    href: url,
    subject: t("emailChange.subject", { brand }),
    text: `${textBody}\n\n${url}`,
    html: `<!DOCTYPE html><html lang="${escapeHtml(resolved)}"><body><p>${escapeHtml(textBody)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p></body></html>`,
  };
}

export function buildEmailChangedMessage(locale: string | null, newEmail: string) {
  const { resolved, t } = translator(locale);
  const brand = getBrandName();
  const textBody = t("emailChanged.text", { email: newEmail, support: AUTHOR_EMAIL });
  const support = t("writeToSupport");
  const mailto = `mailto:${AUTHOR_EMAIL}`;
  return {
    subject: t("emailChanged.subject", { brand }),
    text: textBody,
    html: `<!DOCTYPE html><html lang="${escapeHtml(resolved)}"><body><p>${escapeHtml(textBody)}</p><p><a href="${escapeHtml(mailto)}">${escapeHtml(support)}</a></p></body></html>`,
  };
}

/**
 * Resend failures are logged and never thrown: a mail problem must not fail the
 * change request (the answer stays the same) or a committed change.
 */
async function sendLetter(
  message: { subject: string; text: string; html: string },
  to: string,
  failure: string,
  notConfigured: string,
): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.error(notConfigured);
    return;
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    if (error) console.error(failure, error);
  } catch (error) {
    console.error(failure, error);
  }
}

/** The confirmation link is the one Better Auth built; it must not be rewritten. */
export async function sendEmailChangeEmail(input: {
  to: string;
  locale: string | null;
  url: string;
}): Promise<void> {
  await sendLetter(
    buildEmailChangeMessage(input.locale, input.url),
    input.to,
    "Email change email failed",
    "Email change email is not configured",
  );
}

export async function sendEmailChangedNotice(input: {
  to: string;
  locale: string | null;
  newEmail: string;
}): Promise<void> {
  await sendLetter(
    buildEmailChangedMessage(input.locale, input.newEmail),
    input.to,
    "Email change notification failed",
    "Email change notification is not configured",
  );
}
