import { beforeEach, describe, expect, it, vi } from "vitest";
import * as SecureStore from "expo-secure-store";
import { clearSessionToken, getSessionToken, setSessionToken } from "./session-token.native";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

describe("session-token.native", () => {
  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.setItemAsync).mockReset();
    vi.mocked(SecureStore.deleteItemAsync).mockReset();
  });

  it("rejects when the read fails instead of returning null", async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error("keystore"));
    await expect(getSessionToken()).rejects.toThrow("keystore");
  });

  it("returns the stored value", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("t1");
    expect(await getSessionToken()).toBe("t1");
  });

  it("stores the token", async () => {
    await setSessionToken("t2");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), "t2");
  });

  it("clear swallows a delete failure", async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValue(new Error("keystore"));
    await expect(clearSessionToken()).resolves.toBeUndefined();
  });
});
