import { describe, expect, it } from "vitest";
import { withAuthSession } from "./auth-session";

function sessionResponse() {
  const headers = new Headers();
  headers.append("set-cookie", "session=abc; HttpOnly");
  headers.set("set-auth-token", "signed-token");
  return new Response(null, { status: 200, headers });
}

const result = {
  ok: true as const,
  data: { user: { id: "u" }, next: "/" },
};

describe("withAuthSession", () => {
  it("keeps the cookie and hides the token from a browser request", () => {
    const response = withAuthSession(
      new Request("http://x/api/v1/session", { headers: { origin: "http://localhost:3000" } }),
      sessionResponse(),
      result,
    );
    expect(response.headers.get("set-cookie")).toContain("session=abc");
    expect(response.headers.get("set-auth-token")).toBeNull();
  });

  it("exposes the token when the request is native", () => {
    const response = withAuthSession(
      new Request("http://x/api/v1/session", { headers: { "expo-origin": "giftlist://" } }),
      sessionResponse(),
      result,
    );
    expect(response.headers.get("set-auth-token")).toBe("signed-token");
    expect(response.headers.get("access-control-expose-headers")).toContain("set-auth-token");
  });
});
