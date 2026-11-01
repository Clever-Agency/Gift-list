import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { allowedExpoWebDevOrigin, applyDevCors, trustedExpoWebOrigins } from "./dev-cors";
import { proxy } from "@/proxy";

const previousNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(previousNodeEnv);
});

describe("allowedExpoWebDevOrigin", () => {
  it("allows the Expo web dev ports on localhost and 127.0.0.1", () => {
    for (const origin of [
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "http://localhost:8085",
      "http://127.0.0.1:19006",
    ]) {
      expect(allowedExpoWebDevOrigin(origin, "development")).toBe(origin);
    }
  });

  it("rejects other origins and every origin in production", () => {
    expect(allowedExpoWebDevOrigin("http://localhost:3000", "development")).toBeNull();
    expect(allowedExpoWebDevOrigin("http://localhost:9999", "development")).toBeNull();
    expect(allowedExpoWebDevOrigin("https://evil.example", "development")).toBeNull();
    expect(allowedExpoWebDevOrigin("http://localhost:8081", "production")).toBeNull();
    expect(trustedExpoWebOrigins("production")).toEqual([]);
    expect(trustedExpoWebOrigins("development")).toContain("http://localhost:8081");
  });
});

describe("proxy CORS", () => {
  function call(method: string, origin: string | null, nodeEnv: string) {
    setNodeEnv(nodeEnv);
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    headers.set("access-control-request-method", "POST");
    headers.set("access-control-request-headers", "content-type");
    return proxy(
      new NextRequest("http://localhost:3000/api/v1/password/forgot", { method, headers }),
    );
  }

  it("answers an Expo web preflight with credentials and the request origin", async () => {
    const res = await call("OPTIONS", "http://localhost:8081", "development");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("content-type");
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("puts the same headers on a real request from Expo web", async () => {
    const res = await call("POST", "http://127.0.0.1:8081", "development");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8081");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("does not advertise CORS to other origins or in production", async () => {
    const foreign = await call("OPTIONS", "https://evil.example", "development");
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
    const shipped = await call("OPTIONS", "http://localhost:8081", "production");
    expect(shipped.headers.get("access-control-allow-origin")).toBeNull();
    expect(shipped.headers.get("access-control-allow-credentials")).toBeNull();
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
