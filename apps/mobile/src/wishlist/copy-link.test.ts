import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "@/platform/clipboard";
import { copyWishlistShareLink } from "@/wishlist/copy-link";

vi.mock("@/platform/clipboard", () => ({ copyText: vi.fn() }));

const copy = vi.mocked(copyText);

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("copyWishlistShareLink", () => {
  it("copies the public wishlist URL built from the explicit origin", async () => {
    copy.mockResolvedValue(true);

    await expect(copyWishlistShareLink("tok-1", "https://gift.example/")).resolves.toBe("copied");
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith("https://gift.example/l/tok-1");
  });

  it("takes the origin from the environment when none is passed", async () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    copy.mockResolvedValue(true);

    await expect(copyWishlistShareLink("tok-1")).resolves.toBe("copied");
    expect(copy).toHaveBeenCalledWith("https://gift.example/l/tok-1");
  });

  it("does not copy anything when the token is missing", async () => {
    await expect(copyWishlistShareLink(null, "https://gift.example")).resolves.toBe("failed");
    await expect(copyWishlistShareLink("", "https://gift.example")).resolves.toBe("failed");
    await expect(copyWishlistShareLink("   ", "https://gift.example")).resolves.toBe("failed");
    expect(copy).not.toHaveBeenCalled();
  });

  it("does not copy a broken link when the origin is missing or invalid", async () => {
    const origins = [
      "",
      "   ",
      "gift.example",
      "ftp://gift.example",
      "javascript:alert(1)",
      "https://gift.example/app",
      "https://gift.example/?from=mail",
      "https://gift.example/#top",
    ];
    for (const origin of origins) {
      await expect(copyWishlistShareLink("tok-1", origin)).resolves.toBe("failed");
    }
    expect(copy).not.toHaveBeenCalled();
  });

  it("reports a refused clipboard write as failed", async () => {
    copy.mockResolvedValue(false);

    await expect(copyWishlistShareLink("tok-1", "https://gift.example")).resolves.toBe("failed");
    expect(copy).toHaveBeenCalledWith("https://gift.example/l/tok-1");
  });

  it("reports a clipboard exception as failed, never as success", async () => {
    copy.mockRejectedValue(new Error("clipboard denied"));

    await expect(copyWishlistShareLink("tok-1", "https://gift.example")).resolves.toBe("failed");
    expect(copy).toHaveBeenCalledWith("https://gift.example/l/tok-1");
  });
});
