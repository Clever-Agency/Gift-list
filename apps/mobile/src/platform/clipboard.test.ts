// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

const TEXT = "https://gift.example/l/tok-1";

let execCommand: ReturnType<typeof vi.fn>;

beforeEach(() => {
  execCommand = vi.fn(() => true);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: execCommand,
  });
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "execCommand");
  document.body.innerHTML = "";
});

describe("copyText (web)", () => {
  it("writes through navigator.clipboard and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when navigator.clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    let copied = "";
    execCommand.mockImplementation(() => {
      copied = document.querySelector("textarea")?.value ?? "";
      return true;
    });

    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe(TEXT);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when navigator.clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when navigator.clipboard exists without writeText", async () => {
    vi.stubGlobal("navigator", { clipboard: {} });

    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when navigator.clipboard.writeText throws synchronously", async () => {
    const writeText = vi.fn(() => {
      throw new Error("clipboard unavailable");
    });
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText(TEXT)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure when the fallback rejects the copy", async () => {
    vi.stubGlobal("navigator", {});
    execCommand.mockReturnValue(false);

    await expect(copyText(TEXT)).resolves.toBe(false);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure and cleans up when execCommand throws", async () => {
    vi.stubGlobal("navigator", {});
    execCommand.mockImplementation(() => {
      throw new Error("copy is not allowed");
    });

    await expect(copyText(TEXT)).resolves.toBe(false);
    expect(execCommand).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure without a document", async () => {
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", undefined);

    await expect(copyText(TEXT)).resolves.toBe(false);
  });

  it("reports failure without navigator and document", async () => {
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("document", undefined);

    await expect(copyText(TEXT)).resolves.toBe(false);
  });
});
