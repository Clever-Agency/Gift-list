import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { registerUser } = vi.hoisted(() => ({ registerUser: vi.fn() }));

vi.mock("@/actions/register", () => ({ registerUser }));

import { POST } from "./route";

/** A syntactically valid address of exactly `length` code points (all ASCII). */
function emailOfLength(length: number): string {
  const local = "a".repeat(60);
  const suffix = ".com";
  return `${local}@${"b".repeat(length - local.length - 1 - suffix.length)}${suffix}`;
}

const validBody = {
  email: "a@example.com",
  password: "password1",
  displayName: "Анна",
  nick: "anna",
};

function post(body: unknown) {
  return new Request("http://x/api/v1/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validationBody(field: string) {
  return { ok: false, code: "VALIDATION", message: "Invalid input", field };
}

beforeEach(() => {
  registerUser.mockReset();
  registerUser.mockResolvedValue({
    result: {
      ok: true,
      data: {
        user: {
          id: "u1",
          email: "a@example.com",
          name: "Анна",
          nick: "anna",
          timeZone: null,
          hideFromSearch: false,
        },
        next: "/",
      },
    },
  });
});

/**
 * The route is the only door that creates an account, so the caps must hold here
 * (the contract schemas do it), not only in the client's own check.
 */
describe("POST /api/v1/register caps", () => {
  it("passes a body exactly at every cap to the use-case", async () => {
    const email = emailOfLength(254);
    const res = await POST(
      post({
        email,
        password: "x".repeat(128),
        displayName: "я".repeat(50),
        nick: "a".repeat(24),
      }),
    );

    expect(res.status).toBe(200);
    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(registerUser.mock.calls[0]?.[0]).toEqual({
      email,
      password: "x".repeat(128),
      displayName: "я".repeat(50),
      nick: "a".repeat(24),
    });
  });

  it("rejects a 255-character email without calling the use-case", async () => {
    const res = await POST(post({ ...validBody, email: emailOfLength(255) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(validationBody("email"));
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("answers 413 before the hash or the database for an oversized body", async () => {
    const res = await POST(post({ ...validBody, pad: "a".repeat(40_000) }));

    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({
      ok: false,
      code: "VALIDATION",
      message: "Payload too large",
      reason: "PAYLOAD_TOO_LARGE",
    });
    // `registerUser` is where the scrypt hash, the rate-limit row and the inserts live.
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects a display name of 51 characters", async () => {
    const res = await POST(post({ ...validBody, displayName: "я".repeat(51) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(validationBody("displayName"));
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects a password of 129 characters", async () => {
    const res = await POST(post({ ...validBody, password: "x".repeat(129) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(validationBody("password"));
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("rejects a 65-emoji password (130 UTF-16 units) before the account is created", async () => {
    // The use-case creates the user, the hash and the session; never calling it
    // means nothing was inserted, hashed or signed in, and email/nick stay free.
    const password = "😀".repeat(65);
    expect(password.length).toBe(130);

    const res = await POST(post({ ...validBody, password }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(validationBody("password"));
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("accepts a 64-emoji password (exactly 128 UTF-16 units)", async () => {
    const password = "😀".repeat(64);
    expect(password.length).toBe(128);

    const res = await POST(post({ ...validBody, password }));

    expect(res.status).toBe(200);
    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(registerUser.mock.calls[0]?.[0]).toMatchObject({ password });
  });

  it("rejects a nick of 25 characters", async () => {
    const res = await POST(post({ ...validBody, nick: "a".repeat(25) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(validationBody("nick"));
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("counts a display name emoji as one code point, as the clients' textLength does", async () => {
    const emoji = "😀";
    // 50 emoji are 50 code points here and 100 UTF-16 units (the unit a
    // `maxLength` would count, which the client does not use).
    expect(emoji.repeat(50).length).toBe(100);
    const atCap = await POST(post({ ...validBody, displayName: emoji.repeat(50) }));
    expect(atCap.status).toBe(200);

    const overCap = await POST(post({ ...validBody, displayName: emoji.repeat(51) }));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual(validationBody("displayName"));
  });
});
