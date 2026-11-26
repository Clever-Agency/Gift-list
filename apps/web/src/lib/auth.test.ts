import { afterEach, describe, expect, it, vi } from "vitest";
import { parseUserInput } from "better-auth/db";
import { DISPLAY_NAME_MAX } from "@gift-list/contracts";

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

// auth.ts кеширует экземпляр в globalThis.auth вне production; resetModules его не сбрасывает.
const globalForAuth = globalThis as unknown as { auth?: unknown };

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.BRAND_NAME;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.AUTH_DEV_TRUSTED_ORIGINS;
  delete globalForAuth.auth;
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
    expect(ids).toContain("have-i-been-pwned");
    expect(ids.at(-1)).toBe("next-cookies");
    expect(auth.options.emailAndPassword?.minPasswordLength).toBe(12);
    expect(auth.options.emailAndPassword?.maxPasswordLength).toBe(128);
    expect(auth.options.trustedOrigins).toContain("giftlist://");
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
    expect(auth.options.disabledPaths).toEqual([
      "/sign-in/email",
      "/sign-up/email",
      "/request-password-reset",
      "/update-user",
      "/change-email",
      "/send-verification-email",
    ]);
    expect(auth.options.emailAndPassword?.resetPasswordTokenExpiresIn).toBe(3600);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
    expect(typeof auth.options.emailAndPassword?.onPasswordReset).toBe("function");
    const database = auth.options.database;
    expect(typeof database).toBe("function");
    if (typeof database === "function") {
      const adapter = database(auth.options) as {
        options?: { adapterConfig?: { transaction?: unknown } };
      };
      expect(typeof adapter.options?.adapterConfig?.transaction).toBe("function");
    }
  });

  /**
   * CLE-94: `input: false` не пускает ник в разбор входа Better Auth.
   * CLE-109: тот же разбор `name` не видит — обработчик снимает его с тела
   * раньше, — поэтому HTTP `/update-user` закрыт в `disabledPaths`.
   */
  it("keeps nick and nickNormalized out of Better Auth client input", async () => {
    setAuthEnv();
    delete globalForAuth.auth;
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    const fields = auth.options.user?.additionalFields ?? {};
    expect(fields.nick).toMatchObject({ input: false });
    expect(fields.nickNormalized).toMatchObject({ input: false });

    // The library seam: `/api/auth/update-user` parses its body with these flags.
    expect(() => parseUserInput(auth.options, { nick: "other" }, "update")).toThrow(
      /nick is not allowed to be set/,
    );
    expect(() => parseUserInput(auth.options, { nickNormalized: "other" }, "update")).toThrow(
      /nickNormalized is not allowed to be set/,
    );
    // A column the config does not declare is dropped, never written.
    expect(parseUserInput(auth.options, { nameNormalized: "other" }, "update")).toEqual({});
    // `name` is a core column, not an additional field, so this seam does not reject it.
    expect(parseUserInput(auth.options, { name: "Новое имя" }, "update")).toEqual({});
  });

  it("link-shape sends loopback http /reset?token= and swallows a mailer failure", async () => {
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
    expect(payload.html).toContain("http://127.0.0.1:3000/reset?token=tok");
    expect(payload.text).toContain("http://127.0.0.1:3000/reset?token=tok");
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

  /**
   * CLE-129/T9.1 (FR-56, AD-3): смена email идёт одним переходом по ссылке на
   * новый адрес. `sendChangeEmailConfirmation` намеренно не задан: он включает
   * двухшаговое подтверждение со старого адреса, а старый получает только
   * уведомление после применения.
   */
  it("enables email change with a one-time link and the old-address hook", async () => {
    setAuthEnv();
    delete globalForAuth.auth;
    vi.resetModules();
    send.mockClear();
    send.mockResolvedValue({ data: { id: "e1" }, error: null });
    const { auth } = await import("@/lib/auth");

    expect(auth.options.user?.changeEmail?.enabled).toBe(true);
    expect("sendChangeEmailConfirmation" in (auth.options.user?.changeEmail ?? {})).toBe(false);
    expect(auth.options.emailVerification?.expiresIn).toBe(3600);
    expect(auth.options.databaseHooks?.user?.update?.after).toEqual(expect.any(Function));

    const sendVerification = auth.options.emailVerification?.sendVerificationEmail;
    expect(sendVerification).toEqual(expect.any(Function));
    const url = "http://127.0.0.1:3000/api/auth/verify-email?token=tok&callbackURL=%2Fprofile";
    await sendVerification?.(
      { user: { id: "u", email: "new@example.com", locale: "ru" } as never, url, token: "tok" },
    );

    const payload = send.mock.calls[0]?.[0] as { to: string; subject: string; html: string };
    expect(payload.to).toBe("new@example.com");
    expect(payload.subject).toBe("Подтвердите новый email — WishMoon");
    expect(payload.html).toContain("/api/auth/verify-email?token=tok");
  });

  it("trusts only the app scheme without AUTH_DEV_TRUSTED_ORIGINS", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = secret;
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    delete process.env.AUTH_DEV_TRUSTED_ORIGINS;
    delete globalForAuth.auth;
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    expect(auth.options.trustedOrigins).toEqual(["giftlist://"]);
  });

  it("adds dev origins from AUTH_DEV_TRUSTED_ORIGINS", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = secret;
    process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000";
    process.env.AUTH_DEV_TRUSTED_ORIGINS = " exp:// , exp+giftlist://,";
    delete globalForAuth.auth;
    vi.resetModules();
    const { auth } = await import("@/lib/auth");
    expect(auth.options.trustedOrigins).toEqual(["giftlist://", "exp://", "exp+giftlist://"]);
  });
});

describe("closed Better Auth HTTP routes", () => {
  const closed = [
    {
      path: "/api/auth/sign-in/email",
      body: { email: "a@example.com", password: "password1" },
    },
    {
      path: "/api/auth/sign-up/email",
      body: { name: "Анна", email: "a@example.com", password: "password1" },
    },
    {
      path: "/api/auth/request-password-reset",
      body: { email: "a@example.com", redirectTo: "http://127.0.0.1:3000/reset" },
    },
    // CLE-109: любое имя, в том числе длиннее DISPLAY_NAME_MAX, не доходит до записи.
    // Поиск читает nameNormalized; его пишет только registerUser вместе с name.
    {
      path: "/api/auth/update-user",
      body: { name: "Новое имя" },
    },
    {
      path: "/api/auth/update-user",
      body: { name: "я".repeat(DISPLAY_NAME_MAX + 1) },
    },
    // FR-56: смена email ходит только через `/api/v1/me/email`, где стоит
    // лимит на пользователя и остаётся адрес для уведомления старому.
    {
      path: "/api/auth/change-email",
      body: { newEmail: "new@example.com" },
    },
    // Любой может попросить письмо по открытому маршруту — письма шлёт только
    // внутренний вызов Better Auth из смены email.
    {
      path: "/api/auth/send-verification-email",
      body: { email: "a@example.com" },
    },
  ] as const;

  async function handler() {
    setAuthEnv();
    delete globalForAuth.auth;
    vi.resetModules();
    send.mockClear();
    return import("@/app/api/auth/[...all]/route");
  }

  function post(path: string, body: unknown) {
    return new Request(`http://127.0.0.1:3000${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3000",
        "x-forwarded-for": "203.0.113.8",
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 404 for sign-in, sign-up, password reset, update-user and email change before any mail or session", async () => {
    const { POST } = await handler();
    for (const { path, body } of closed) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await POST(post(path, body));
        expect(response.status, path).toBe(404);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(await response.json()).toEqual({
          ok: false,
          code: "NOT_FOUND",
          message: "Not found",
        });
        expect(response.headers.get("set-auth-token")).toBeNull();
        expect(response.headers.get("set-cookie")).toBeNull();
      }
      const slashed = await POST(post(`${path}/`, body));
      expect(slashed.status, path).toBe(404);
      expect(await slashed.json()).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Not found",
      });
      expect(slashed.headers.get("set-auth-token")).toBeNull();
      expect(slashed.headers.get("set-cookie")).toBeNull();
    }
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects update-user before the handler, with or without a session cookie", async () => {
    const { POST } = await handler();
    const response = await POST(
      new Request("http://127.0.0.1:3000/api/auth/update-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:3000",
          cookie: "better-auth.session_token=not-a-real-session",
        },
        body: JSON.stringify({ name: "Другое имя", image: "https://example.test/a.png" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(response.headers.get("set-auth-token")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("returns the NOT_FOUND envelope for an unknown auth path and an unsupported method", async () => {
    const { GET, PUT } = await handler();
    const unknown = await GET(new Request("http://127.0.0.1:3000/api/auth/nope"));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    const method = await PUT(
      post("/api/auth/sign-in/email", { email: "a@example.com", password: "password1" }),
    );
    expect(method.status).toBe(404);
    expect(await method.json()).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(method.headers.get("set-auth-token")).toBeNull();
    expect(method.headers.get("set-cookie")).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps a JSON 404 from a live Better Auth endpoint", async () => {
    const { POST } = await handler();
    const response = await POST(
      post("/api/auth/sign-in/social", {
        provider: "google",
        callbackURL: "http://127.0.0.1:3000/",
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ code: "PROVIDER_NOT_FOUND" });
  });

  it("rejects a short password on reset-password before looking up the token", async () => {
    const { POST } = await handler();
    const response = await POST(
      post("/api/auth/reset-password", { newPassword: "short", token: "unused-token" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "PASSWORD_TOO_SHORT" });
  });

  it("still answers session reads and the health route", async () => {
    setAuthEnv();
    delete globalForAuth.auth;
    vi.resetModules();
    const { GET } = await import("@/app/api/auth/[...all]/route");
    const session = await GET(new Request("http://127.0.0.1:3000/api/auth/get-session"));
    expect(session.status).toBe(200);
    expect(await session.json()).toBeNull();
    const health = await GET(new Request("http://127.0.0.1:3000/api/auth/ok"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });
  });
});
