import { afterEach, describe, expect, it, vi } from "vitest";
import { wishlistShareLink } from "@/wishlist/share-link";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("wishlistShareLink", () => {
  it("builds the public wishlist URL", () => {
    expect(wishlistShareLink("tok-1", "https://gift.example")).toBe(
      "https://gift.example/l/tok-1",
    );
  });

  it("tolerates a trailing slash in the origin", () => {
    expect(wishlistShareLink("tok-1", "https://gift.example/")).toBe(
      "https://gift.example/l/tok-1",
    );
    expect(wishlistShareLink("tok-1", "https://gift.example///")).toBe(
      "https://gift.example/l/tok-1",
    );
  });

  it("encodes the token so the path stays one segment", () => {
    expect(wishlistShareLink("a/b", "https://gift.example")).toBe(
      "https://gift.example/l/a%2Fb",
    );
  });

  it("returns null when the origin is missing or invalid", () => {
    expect(wishlistShareLink("tok-1", "")).toBeNull();
    expect(wishlistShareLink("tok-1", "   ")).toBeNull();
    expect(wishlistShareLink("tok-1", "gift.example")).toBeNull();
    expect(wishlistShareLink("tok-1", "https://gift.example/app")).toBeNull();
  });

  it("returns null when the token is missing", () => {
    expect(wishlistShareLink("", "https://gift.example")).toBeNull();
    expect(wishlistShareLink("   ", "https://gift.example")).toBeNull();
  });

  it("takes the origin from the environment by default", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example/");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");
    expect(wishlistShareLink("tok-1")).toBe("https://gift.example/l/tok-1");
  });
});
