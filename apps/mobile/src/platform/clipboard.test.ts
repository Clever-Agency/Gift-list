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
  vi.restoreAllMocks();
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

  it("cleans up and rejects when select throws", async () => {
    vi.stubGlobal("navigator", {});
    vi.spyOn(HTMLTextAreaElement.prototype, "select").mockImplementation(() => {
      throw new Error("select is not allowed");
    });

    await expect(copyText(TEXT)).rejects.toThrow("select is not allowed");
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("cleans up when appendChild fails before attaching", async () => {
    vi.stubGlobal("navigator", {});
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {
      throw new Error("cannot attach");
    });

    await expect(copyText(TEXT)).rejects.toThrow("cannot attach");
    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("cleans up when appendChild attaches the field and then fails", async () => {
    vi.stubGlobal("navigator", {});
    const append = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => {
      append(node);
      throw new Error("cannot finish attach");
    });

    await expect(copyText(TEXT)).rejects.toThrow("cannot finish attach");
    expect(execCommand).not.toHaveBeenCalled();
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
