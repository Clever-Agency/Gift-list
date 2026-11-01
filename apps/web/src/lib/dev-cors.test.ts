import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedDevCorsOrigin, applyDevCors } from "./dev-cors";

const expoWeb = ["exp://", "http://localhost:8081", "http://127.0.0.1:8081"];

const previousNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(previousNodeEnv);
  delete process.env.DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.AUTH_DEV_TRUSTED_ORIGINS;
});

describe("allowedDevCorsOrigin", () => {
  it("allows http origins listed in AUTH_DEV_TRUSTED_ORIGINS", () => {
    expect(allowedDevCorsOrigin("http://localhost:8081", expoWeb, "development")).toBe("http://localhost:8081");
    expect(allowedDevCorsOrigin("http://127.0.0.1:8081", expoWeb, "development")).toBe("http://127.0.0.1:8081");
  });

  it("rejects unlisted origins, custom schemes and an empty list", () => {
    expect(allowedDevCorsOrigin("http://localhost:3000", expoWeb, "development")).toBeNull();
    expect(allowedDevCorsOrigin("https://evil.example", expoWeb, "development")).toBeNull();
    expect(allowedDevCorsOrigin("exp://", expoWeb, "development")).toBeNull();
    expect(allowedDevCorsOrigin("http://localhost:8081", [], "development")).toBeNull();
    expect(allowedDevCorsOrigin(null, expoWeb, "development")).toBeNull();
  });

  it("allows nothing in production, even with the variable set", () => {
    expect(allowedDevCorsOrigin("http://localhost:8081", expoWeb, "production")).toBeNull();
  });
});

describe("proxy CORS", () => {
  async function call(method: string, origin: string | null, devOrigins: string | undefined) {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/gift";
    process.env.BETTER_AUTH_SECRET = "01234567890123456789012345678901";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    if (devOrigins === undefined) delete process.env.AUTH_DEV_TRUSTED_ORIGINS;
    else process.env.AUTH_DEV_TRUSTED_ORIGINS = devOrigins;
    vi.resetModules();
    const { proxy } = await import("@/proxy");
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    headers.set("access-control-request-method", "POST");
    headers.set("access-control-request-headers", "content-type");
    return proxy(
      new NextRequest("http://localhost:3000/api/v1/password/forgot", { method, headers }),
    );
  }

  it("answers an Expo web preflight with credentials and the request origin", async () => {
    const res = await call("OPTIONS", "http://localhost:8081", "exp://,http://localhost:8081");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("content-type");
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("puts the same headers on a real request from Expo web", async () => {
    const res = await call("POST", "http://127.0.0.1:8081", "http://127.0.0.1:8081");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8081");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("does not advertise CORS to other origins or without AUTH_DEV_TRUSTED_ORIGINS", async () => {
    const foreign = await call("OPTIONS", "https://evil.example", "http://localhost:8081");
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
    const unset = await call("OPTIONS", "http://localhost:8081", undefined);
    expect(unset.headers.get("access-control-allow-origin")).toBeNull();
    expect(unset.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("adds nothing in production and does not read env there", async () => {
    setNodeEnv("production");
    const res = await call("OPTIONS", "http://localhost:8081", "http://localhost:8081");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { proxy } = await import("@/proxy");
    const headers = new Headers({ origin: "http://localhost:8081" });
    const bare = proxy(new NextRequest("http://localhost:3000/api/v1/me", { method: "POST", headers }));
    expect(bare.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("applyDevCors", () => {
  it("never uses a wildcard origin", () => {
    const headers = new Headers();
    applyDevCors(headers, "http://localhost:8081");
    expect(headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
    expect(headers.get("access-control-allow-origin")).not.toBe("*");
  });
});
