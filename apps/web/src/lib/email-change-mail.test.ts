import { AUTHOR_EMAIL, PRODUCT_NAME } from "@gift-list/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import {
  buildEmailChangeMessage,
  buildEmailChangedMessage,
  sendEmailChangeEmail,
  sendEmailChangedNotice,
} from "./email-change-mail";

afterEach(() => {
  send.mockReset();
  vi.restoreAllMocks();
});

function setMailEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "List <noreply@example.com>";
  process.env.BRAND_NAME = "Paper";
}

describe("buildEmailChangeMessage", () => {
  it("keeps the Better Auth link as is and names the new-address action", () => {
    delete process.env.BRAND_NAME;
    const url = "http://127.0.0.1:3000/api/auth/verify-email?token=tok&callbackURL=%2Fprofile";
    const message = buildEmailChangeMessage("ru", url);

    expect(message.href).toBe(url);
    expect(message.text).toContain(url);
    expect(message.html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
    expect(message.subject).toBe(`Подтвердите новый email — ${PRODUCT_NAME}`);
    expect(message.html).toContain("Подтвердить новый адрес");
  });

  it("falls back to ru for an unknown locale", () => {
    expect(buildEmailChangeMessage("en", "https://host/x").subject).toBe(
      `Подтвердите новый email — ${PRODUCT_NAME}`,
    );
  });
});

describe("buildEmailChangedMessage", () => {
  it("names the new address and the support mailbox", () => {
    delete process.env.BRAND_NAME;
    const message = buildEmailChangedMessage("ru", "new@example.com");

    expect(message.subject).toBe(`Email учётной записи изменён — ${PRODUCT_NAME}`);
    expect(message.text).toContain("new@example.com");
    expect(message.text).toContain(AUTHOR_EMAIL);
    expect(message.html).toContain(`mailto:${AUTHOR_EMAIL}`);
    expect(message.html).toContain("Написать в техподдержку");
  });
});

describe("sendEmailChangeEmail", () => {
  it("sends the link to the new address from the configured sender", async () => {
    setMailEnv();
    send.mockResolvedValue({ data: { id: "e1" }, error: null });
    const url = "https://host/api/auth/verify-email?token=tok";

    await sendEmailChangeEmail({ to: "new@example.com", locale: "ru", url });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]?.[0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
    };
    expect(payload.from).toBe("List <noreply@example.com>");
    expect(payload.to).toBe("new@example.com");
    expect(payload.subject).toBe("Подтвердите новый email — Paper");
    expect(payload.html).toContain(url);
  });

  it("logs a Resend error and does not throw", async () => {
    setMailEnv();
    send.mockResolvedValue({ data: null, error: { message: "rejected", name: "validation_error" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendEmailChangeEmail({ to: "new@example.com", locale: "ru", url: "https://host/x" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Email change email failed", expect.anything());
  });

  it("logs and returns when Resend is not configured", async () => {
    setMailEnv();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    // `getEnv()` caches its parse per module instance, so the letter module is
    // re-imported after the variables are gone (same as the reset-letter test).
    vi.resetModules();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sendEmailChangeEmail: sendUnconfigured } = await import("./email-change-mail");
    await expect(
      sendUnconfigured({ to: "new@example.com", locale: "ru", url: "https://host/x" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Email change email is not configured");
    expect(send).not.toHaveBeenCalled();
  });

  it("logs a thrown Resend failure and does not throw", async () => {
    setMailEnv();
    send.mockRejectedValue(new Error("network"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendEmailChangeEmail({ to: "new@example.com", locale: null, url: "https://host/x" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Email change email failed", expect.any(Error));
  });
});

describe("sendEmailChangedNotice", () => {
  it("sends the notice to the old address with the new one in the body", async () => {
    setMailEnv();
    send.mockResolvedValue({ data: { id: "e2" }, error: null });

    await sendEmailChangedNotice({ to: "old@example.com", locale: "ru", newEmail: "new@example.com" });

    const payload = send.mock.calls[0]?.[0] as { to: string; text: string; html: string };
    expect(payload.to).toBe("old@example.com");
    expect(payload.text).toContain("new@example.com");
    expect(payload.html).toContain("new@example.com");
  });

  it("swallows a mailer failure after the change was committed", async () => {
    setMailEnv();
    send.mockRejectedValue(new Error("network"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendEmailChangedNotice({ to: "old@example.com", locale: "ru", newEmail: "new@example.com" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Email change notification failed", expect.any(Error));
  });
});
