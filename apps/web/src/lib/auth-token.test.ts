import { describe, expect, it } from "vitest";
import { stripAuthTokenForBrowser } from "./auth-token";

function response() {
  const headers = new Headers({
    "set-auth-token": "tok",
    "access-control-expose-headers": "set-auth-token, x-other",
  });
  headers.append("set-cookie", "session=tok; Path=/");
  return new Response('{"a":1}', { status: 201, headers });
}

describe("stripAuthTokenForBrowser", () => {
  it.each([
    ["an http origin", { origin: "http://localhost:3000" }],
    ["no origin", {}],
  ])("removes the token for %s and keeps the rest", async (_name, init) => {
    const out = stripAuthTokenForBrowser(new Request("http://x/", { headers: init }), response());
    expect(out.headers.has("set-auth-token")).toBe(false);
    expect(out.headers.get("access-control-expose-headers")).toBe("x-other");
    expect(out.headers.get("set-cookie")).toContain("session=tok");
    expect(out.status).toBe(201);
    expect(await out.json()).toEqual({ a: 1 });
  });

  it("drops an empty expose header", () => {
    const res = response();
    res.headers.set("access-control-expose-headers", "set-auth-token");
    const out = stripAuthTokenForBrowser(new Request("http://x/"), res);
    expect(out.headers.has("access-control-expose-headers")).toBe(false);
  });

  it.each([
    ["expo-origin", { "expo-origin": "giftlist://" }],
    ["giftlist origin", { origin: "giftlist://" }],
  ])("keeps the token for %s", (_name, init) => {
    const out = stripAuthTokenForBrowser(new Request("http://x/", { headers: init }), response());
    expect(out.headers.get("set-auth-token")).toBe("tok");
  });
});
