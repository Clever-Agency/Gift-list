import { describe, expect, it } from "vitest";
import { POST } from "./route";

function request(token: string): Request {
  return new Request(`http://x/unsubscribe/${token}/restore`, { method: "POST" });
}

describe("POST /unsubscribe/:token/restore", () => {
  it("redirects to the page with restored=1 and lets the GET turn the switch on", async () => {
    const res = await POST(
      request("tok-1"),
      { params: Promise.resolve({ token: "tok-1" }) },
    );

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://x/unsubscribe/tok-1?restored=1");
  });

  it("keeps a malformed segment inside the path and encodes it", async () => {
    const res = await POST(
      request("a%2Fb"),
      { params: Promise.resolve({ token: "a/b" }) },
    );

    expect(res.headers.get("location")).toBe("http://x/unsubscribe/a%2Fb?restored=1");
  });
});
