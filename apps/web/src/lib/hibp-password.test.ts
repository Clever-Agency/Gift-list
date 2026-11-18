import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const compromised = vi.hoisted(() => vi.fn());

vi.mock("better-auth/plugins/haveibeenpwned", () => ({
  isPasswordCompromised: compromised,
}));

import { isPasswordPwnedFailOpen } from "@/lib/hibp-password";

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