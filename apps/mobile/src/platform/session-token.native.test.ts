import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./session-token.native";

const secure = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("expo-secure-store", () => secure);


beforeEach(() => {
  Object.values(secure).forEach((fn) => fn.mockReset());
});

describe("session-token.native", () => {
  it("returns the stored value", async () => {
    secure.getItemAsync.mockResolvedValue("tok");
    expect(await readSessionToken()).toBe("tok");
  });

  it("rejects when the store read fails", async () => {
    secure.getItemAsync.mockRejectedValue(new Error("locked"));
    await expect(readSessionToken()).rejects.toThrow("locked");
  });

  it("writes through setItemAsync", async () => {
    await writeSessionToken("abc");
    expect(secure.setItemAsync).toHaveBeenCalledWith(expect.any(String), "abc");
  });

  it("clear swallows a delete failure", async () => {
    secure.deleteItemAsync.mockRejectedValue(new Error("x"));
    await expect(clearSessionToken()).resolves.toBeUndefined();
  });
});
