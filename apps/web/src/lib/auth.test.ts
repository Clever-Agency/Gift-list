import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const secret = "01234567890123456789012345678901";

const send = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

function setAuthEnv() {
  process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
  process.env.BETTER_AUTH_SECRET = secret;
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "noreply@example.com";
  delete process.env.BRAND_NAME;
}

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.BRAND_NAME;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete (globalThis as { auth?: unknown }).auth;
});

describe("auth proxy", () => {
  it("exposes handler to toNextJsHandler's `in` check", async () => {
    setAuthEnv();
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    expect("handler" in auth).toBe(true);
    expect(typeof auth.handler).toBe("function");
  });

  it("registers expo, bearer and nextCookies (last) and trusts the app scheme", async () => {
    setAuthEnv();
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);
    expect(ids).toContain("expo");
    expect(ids).toContain("bearer");
    expect(ids.at(-1)).toBe("next-cookies");
    expect(auth.options.trustedOrigins).toContain("giftlist://");
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
    expect(auth.options.emailAndPassword?.resetPasswordTokenExpiresIn).toBe(3600);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
    const database = auth.options.database;
    expect(typeof database).toBe("function");
    if (typeof database === "function") {
      const adapter = database(auth.options) as {
        options?: { adapterConfig?: { transaction?: unknown } };
      };
      expect(typeof adapter.options?.adapterConfig?.transaction).toBe("function");
    }
  });

  it("link-shape sends https /reset?token= and swallows a mailer failure", async () => {
    setAuthEnv();
    process.env.BRAND_NAME = "Paper";
    vi.resetModules();
    send.mockResolvedValue({ data: { id: "e1" }, error: null });
    const { auth } = await import("@/lib/auth");
    const sendReset = auth.options.emailAndPassword?.sendResetPassword;
    expect(sendReset).toEqual(expect.any(Function));
    await sendReset?.(
      {
        user: { id: "u", email: "a@example.com", name: "Анна", locale: "ru" } as never,
        url: "http://127.0.0.1:3000/api/auth/reset-password/tok?callbackURL=",
        token: "tok",
      },
    );
    const payload = send.mock.calls[0]?.[0] as { html: string; text: string; subject: string };
    expect(payload.html).toContain("https://127.0.0.1:3000/reset?token=tok");
    expect(payload.text).toContain("https://127.0.0.1:3000/reset?token=tok");
    expect(payload.html).not.toContain("/api/auth");
    expect(payload.subject).toBe("Сброс пароля — Paper");

    send.mockRejectedValue(new Error("resend down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendReset?.(
        {
          user: { id: "u", email: "a@example.com", name: "Анна", locale: "ru" } as never,
          url: "http://127.0.0.1:3000/api/auth/reset-password/tok?callbackURL=",
          token: "tok",
        },
      ),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
});
