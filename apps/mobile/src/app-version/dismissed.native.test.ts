import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISMISSED_APP_VERSION_KEY,
  readDismissedVersion,
  writeDismissedVersion,
} from "./dismissed.native";

const secure = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock("expo-secure-store", () => secure);

beforeEach(() => {
  Object.values(secure).forEach(function reset(fn) {
    fn.mockReset();
  });
});

describe("dismissed.native", () => {
  it("keeps the version under a key without user data", () => {
    expect(DISMISSED_APP_VERSION_KEY).toBe("gift-list.app-version.dismissed");
  });

  it("returns the remembered version", async () => {
    secure.getItemAsync.mockResolvedValue("0.2.0");

    await expect(readDismissedVersion()).resolves.toBe("0.2.0");
    expect(secure.getItemAsync).toHaveBeenCalledWith(DISMISSED_APP_VERSION_KEY);
  });

  it("treats a failed read as nothing remembered", async () => {
    secure.getItemAsync.mockRejectedValue(new Error("locked"));

    await expect(readDismissedVersion()).resolves.toBeNull();
  });

  it("writes the latestVersion string", async () => {
    await writeDismissedVersion("0.3.0");

    expect(secure.setItemAsync).toHaveBeenCalledWith(
      DISMISSED_APP_VERSION_KEY,
      "0.3.0",
    );
  });

  it("swallows a failed write", async () => {
    secure.setItemAsync.mockRejectedValue(new Error("no space"));

    await expect(writeDismissedVersion("0.3.0")).resolves.toBeUndefined();
  });
});
