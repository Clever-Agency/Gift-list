import { PRODUCT_NAME } from "@gift-list/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { buildPasswordResetMessage, escapeHtml, passwordResetLink, sendPasswordResetEmail } from "./password-reset-mail";

afterEach(() => {
  send.mockReset();
  vi.restoreAllMocks();
});

describe("link-shape", () => {
  it("keeps http on loopback hosts and forces https on a real host", () => {
    expect(passwordResetLink("http://localhost:3000", "tok")).toBe(
      "http://localhost:3000/reset?token=tok",
    );
    expect(passwordResetLink("http://127.0.0.1:3000", "tok")).toBe(
      "http://127.0.0.1:3000/reset?token=tok",
    );
    expect(passwordResetLink("http://[::1]:3000", "tok")).toBe("http://[::1]:3000/reset?token=tok");
    expect(passwordResetLink("http://app.localhost:3000", "tok")).toBe(
      "http://app.localhost:3000/reset?token=tok",
    );
    expect(passwordResetLink("https://localhost:3000", "tok")).toBe(
      "https://localhost:3000/reset?token=tok",
    );
    const href = passwordResetLink("http://example.com/api/auth", "tok");
    expect(href).toBe("https://example.com/reset?token=tok");
    expect(href.startsWith("https://")).toBe(true);
    expect(href).not.toContain("/api/auth");
    expect(passwordResetLink("http://127.0.0.2:3000", "tok")).toBe(
      "https://127.0.0.2:3000/reset?token=tok",
    );
    expect(passwordResetLink("http://localhost.example.com", "tok")).toBe(
      "https://localhost.example.com/reset?token=tok",
    );
    expect(passwordResetLink("http://example.com:8443/api/auth", "tok")).toBe(
      "https://example.com:8443/reset?token=tok",
    );
  });

  it("escapes the url and the letter before they enter html", () => {
    expect(escapeHtml(`https://host/reset?token=a&b"<`)).toBe(
      "https://host/reset?token=a&amp;b&quot;&lt;",
    );
    delete process.env.BRAND_NAME;
    const message = buildPasswordResetMessage("ru", "tok", "http://127.0.0.1:3000");
    expect(message.href).toBe("http://127.0.0.1:3000/reset?token=tok");
    expect(message.html).toContain(`href="${escapeHtml(message.href)}"`);
    expect(message.html).not.toContain("/api/auth");
    expect(message.text).toContain(message.href);
    expect(message.subject).toBe(`Сброс пароля — ${PRODUCT_NAME}`);
    expect(message.html).toContain("Задать новый пароль");
  });
});

describe("sendPasswordResetEmail", () => {
  function setMailEnv() {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "List <noreply@example.com>";
    process.env.BRAND_NAME = "Paper";
  }

  it("logs a Resend error and does not throw", async () => {
    setMailEnv();
    vi.resetModules();
    send.mockResolvedValue({ data: null, error: { message: "rejected", name: "validation_error" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendPasswordResetEmail: sendMail } = await import("./password-reset-mail");
    await expect(
      sendMail({ to: "a@example.com", locale: "ru", token: "tok" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Password reset email failed", expect.anything());
    const payload = send.mock.calls[0]?.[0] as { from: string; subject: string; html: string };
    expect(payload.from).toBe("List <noreply@example.com>");
    expect(payload.subject).toBe("Сброс пароля — Paper");
    expect(payload.html).toContain("http://127.0.0.1:3000/reset?token=tok");
    expect(payload.html).not.toContain("/api/auth");
  });

  it("logs and returns when Resend is not configured", async () => {
    setMailEnv();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.resetModules();
    send.mockClear();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendPasswordResetEmail: sendMail } = await import("./password-reset-mail");
    await expect(sendMail({ to: "a@example.com", locale: "ru", token: "tok" })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Password reset email is not configured");
    expect(send).not.toHaveBeenCalled();
  });

  it("logs a thrown Resend failure and does not throw", async () => {
    setMailEnv();
    send.mockRejectedValue(new Error("network"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendPasswordResetEmail({ to: "a@example.com", locale: null, token: "tok" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("Password reset email failed", expect.any(Error));
  });
});
