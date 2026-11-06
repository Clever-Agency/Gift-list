import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard.native";

const clipboard = vi.hoisted(() => ({ setStringAsync: vi.fn() }));
vi.mock("expo-clipboard", () => clipboard);

const TEXT = "https://gift.example/l/tok-1";

afterEach(() => {
  clipboard.setStringAsync.mockReset();
});

describe("copyText (native)", () => {
  it("writes through expo-clipboard and reports its success", async () => {
    clipboard.setStringAsync.mockResolvedValue(true);

    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(TEXT);
  });

  it("reports failure when expo-clipboard refuses the write", async () => {
    clipboard.setStringAsync.mockResolvedValue(false);

    await expect(copyText(TEXT)).resolves.toBe(false);
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(TEXT);
  });

  it("turns a rejected platform write into failure", async () => {
    clipboard.setStringAsync.mockRejectedValue(new Error("clipboard denied"));

    await expect(copyText(TEXT)).resolves.toBe(false);
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(TEXT);
  });

  it("turns a synchronous platform exception into failure", async () => {
    clipboard.setStringAsync.mockImplementation(() => {
      throw new Error("native module missing");
    });

    await expect(copyText(TEXT)).resolves.toBe(false);
    expect(clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(TEXT);
  });
});
