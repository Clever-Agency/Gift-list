import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getEnv } = vi.hoisted(() => ({ getEnv: vi.fn() }));

vi.mock("@/lib/env", () => ({ getEnv }));

import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  type UnsubscribeType,
} from "./unsubscribe-token";

const SECRET = "test-secret-that-is-at-least-32-chars-long";
const OTHER_SECRET = "another-secret-that-is-also-32-chars-long!";

/** Independently signs a payload with the documented key derivation. */
function sign(payload: unknown, secret = SECRET, purpose = "unsubscribe:v1"): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = createHmac("sha256", secret).update(purpose).digest();
  const hmac = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${hmac}`;
}

beforeEach(() => {
  getEnv.mockReset();
  getEnv.mockReturnValue({ BETTER_AUTH_SECRET: SECRET });
});

describe("unsubscribe token", () => {
  it("round-trips both reminder types and carries only the user and the type", () => {
    for (const type of ["friendDates", "ownList"] as const) {
      const token = createUnsubscribeToken("user-1", type);
      expect(verifyUnsubscribeToken(token)).toEqual({ userId: "user-1", type });
    }
  });

  it("makes different types and users different tokens", () => {
    const dates = createUnsubscribeToken("user-1", "friendDates");
    const own = createUnsubscribeToken("user-1", "ownList");
    const other = createUnsubscribeToken("user-2", "friendDates");
    expect(new Set([dates, own, other]).size).toBe(3);
  });

  it("is a two-part base64url token with no padding and no URL-unsafe characters", () => {
    const token = createUnsubscribeToken("user-1", "friendDates");
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("=");
  });

  it("rejects a payload changed under a genuine signature", () => {
    const token = createUnsubscribeToken("user-1", "friendDates");
    const [payload, hmac] = token.split(".") as [string, string];
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const forged = Buffer.from(
      JSON.stringify({ ...decoded, u: "user-2" }),
    ).toString("base64url");
    expect(verifyUnsubscribeToken(`${forged}.${hmac}`)).toBeNull();
  });

  it("rejects a signature changed under a genuine payload", () => {
    const [payload, hmac] = createUnsubscribeToken("user-1", "friendDates").split(".") as [
      string,
      string,
    ];
    const flipped = `${hmac.slice(0, -1)}${hmac.endsWith("A") ? "B" : "A"}`;
    expect(verifyUnsubscribeToken(`${payload}.${flipped}`)).toBeNull();
  });

  it("rejects a token of another type even with a genuine signature", () => {
    expect(
      verifyUnsubscribeToken(sign({ u: "user-1", t: "birthdays" })),
    ).toBeNull();
    expect(verifyUnsubscribeToken(sign({ u: "user-1", t: "email" }))).toBeNull();
  });

  it("rejects a token of another purpose or another secret", () => {
    expect(
      verifyUnsubscribeToken(sign({ u: "user-1", t: "friendDates" }, SECRET, "email-change:v1")),
    ).toBeNull();
    expect(
      verifyUnsubscribeToken(sign({ u: "user-1", t: "friendDates" }, OTHER_SECRET)),
    ).toBeNull();
  });

  it("rejects garbage and a wrongly shaped payload", () => {
    const valid = createUnsubscribeToken("user-1", "ownList");
    const [payload, hmac] = valid.split(".") as [string, string];
    const notJson = Buffer.from("not json").toString("base64url");
    const invalid = [
      "",
      "abc",
      ".",
      "a.b",
      `${payload}.`,
      `.${hmac}`,
      `${payload}.${hmac}.extra`,
      `${notJson}.${sign({ u: "user-1" }).split(".")[1]}`,
      sign({ u: "", t: "friendDates" }),
      sign({ u: 42, t: "friendDates" }),
      sign({ u: "user-1" }),
      sign(["user-1", "friendDates"]),
      sign("user-1"),
      "x".repeat(513),
    ];
    for (const token of invalid) {
      expect(verifyUnsubscribeToken(token), token).toBeNull();
    }
  });

  it("refuses to create a token for an empty user or an unknown type", () => {
    expect(() => createUnsubscribeToken("", "friendDates")).toThrow();
    expect(() =>
      createUnsubscribeToken("user-1", "birthdays" as UnsubscribeType),
    ).toThrow();
  });
});
