import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const compromised = vi.hoisted(() => vi.fn());

vi.mock("better-auth/plugins/haveibeenpwned", () => ({
  isPasswordCompromised: compromised,
}));

import { runWithEndpointContext } from "@better-auth/core/context";
import { haveIBeenPwnedPlugin, isPasswordPwnedFailOpen } from "@/lib/hibp-password";

afterEach(() => {
  compromised.mockReset();
  vi.useRealTimers();
});

describe("isPasswordPwnedFailOpen", () => {
  it("returns true when the corpus lists the password", async () => {
    compromised.mockResolvedValue(true);
    await expect(isPasswordPwnedFailOpen("leaked")).resolves.toBe(true);
  });

  it("returns false when the password is clean", async () => {
    compromised.mockResolvedValue(false);
    await expect(isPasswordPwnedFailOpen("unique-secret-12")).resolves.toBe(false);
  });

  it("fails open on a rejected check", async () => {
    compromised.mockRejectedValue(new Error("network down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(isPasswordPwnedFailOpen("x")).resolves.toBe(false);
    expect(spy).toHaveBeenCalledWith("Error");
  });

  it("fails open when the check does not finish in time", async () => {
    vi.useFakeTimers();
    compromised.mockImplementation(
      () =>
        new Promise<boolean>(() => {
          /* never resolves */
        }),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = isPasswordPwnedFailOpen("slow");
    await vi.advanceTimersByTimeAsync(1500);
    await expect(pending).resolves.toBe(false);
    expect(spy).toHaveBeenCalledWith("HaveIBeenPwnedTimeout");
  });
});

describe("haveIBeenPwnedPlugin hash hook", () => {
  function wrappedHash() {
    const hash = vi.fn(async function hashPassword(password: string) {
      return `hashed:${password}`;
    });
    const plugin = haveIBeenPwnedPlugin();
    return { hash, guarded: plugin.init({ password: { hash } }).context.password.hash };
  }

  it("does not consult HIBP when the endpoint is sign-in or there is no endpoint", async () => {
    compromised.mockResolvedValue(true);
    const { hash, guarded } = wrappedHash();

    await expect(guarded("short-legacy")).resolves.toBe("hashed:short-legacy");
    await runWithEndpointContext({ path: "/sign-in/email" } as never, async function signInHash() {
      await expect(guarded("short-legacy")).resolves.toBe("hashed:short-legacy");
    });

    expect(compromised).not.toHaveBeenCalled();
    expect(hash).toHaveBeenCalledTimes(2);
  });

  it.each(["/reset-password", "/change-password"])(
    "rejects a compromised password on %s and does not hash it",
    async (path) => {
      compromised.mockResolvedValue(true);
      const { hash, guarded } = wrappedHash();

      await expect(
        runWithEndpointContext({ path } as never, async function setPasswordHash() {
          await guarded("leaked-password");
        }),
      ).rejects.toMatchObject({ body: { code: "PASSWORD_COMPROMISED" } });

      expect(compromised).toHaveBeenCalledWith("leaked-password");
      expect(hash).not.toHaveBeenCalled();
    },
  );
});