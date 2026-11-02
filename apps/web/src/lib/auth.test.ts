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
    expect(ids.at(-1)).toBe("next-cookies");
    expect(auth.options.trustedOrigins).toContain("giftlist://");
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
    expect(auth.options.disabledPaths).toEqual([
      "/sign-in/email",
      "/sign-up/email",
      "/request-password-reset",
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

  it("returns 404 for sign-in, sign-up and password reset before any mail or session", async () => {
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
