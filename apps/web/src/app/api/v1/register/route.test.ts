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
        user: { id: "u1", email: "a@example.com", name: "Анна", nick: "anna", timeZone: null },
        next: "/",
      },
    },
  });
});

/**
 * The route is the only door that creates an account, so the caps must hold here
 * (the contract schemas do it), not only in the form's `maxLength`.
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

  it("rejects a nick of 25 characters", async () => {
    const res = await POST(post({ ...validBody, nick: "a".repeat(25) }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(validationBody("nick"));
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("counts a display name emoji as one code point (the client maxLength cuts first)", async () => {
    const emoji = "😀";
    // 50 emoji are 50 code points here and 100 UTF-16 units for `maxLength`.
    expect(emoji.repeat(50).length).toBe(100);
    const atCap = await POST(post({ ...validBody, displayName: emoji.repeat(50) }));
    expect(atCap.status).toBe(200);

    const overCap = await POST(post({ ...validBody, displayName: emoji.repeat(51) }));
    expect(overCap.status).toBe(400);
    expect(await overCap.json()).toEqual(validationBody("displayName"));
  });
});
