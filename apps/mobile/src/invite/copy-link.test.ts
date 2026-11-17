import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyInviteLink } from "@/api/invite-link";
import { copyMyInviteLink } from "@/invite/copy-link";
import { inviteShareLink } from "@/invite/share-link";
import { copyText } from "@/platform/clipboard";

vi.mock("@/platform/clipboard", () => ({ copyText: vi.fn() }));
vi.mock("@/api/invite-link", () => ({ getMyInviteLink: vi.fn() }));

const copy = vi.mocked(copyText);
const readLink = vi.mocked(getMyInviteLink);

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("inviteShareLink", () => {
  it("builds {origin}/i/{token} like the wishlist link", () => {
    expect(inviteShareLink("tok-1", "https://gift.example/")).toBe(
      "https://gift.example/i/tok-1",
    );
  });

  it("takes the origin from the environment when none is passed", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_ORIGIN", "https://gift.example");
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "");

    expect(inviteShareLink("tok-1")).toBe("https://gift.example/i/tok-1");
  });

  it("refuses a missing token or a broken origin", () => {
    expect(inviteShareLink("", "https://gift.example")).toBeNull();
    expect(inviteShareLink("   ", "https://gift.example")).toBeNull();
    for (const origin of ["", "gift.example", "javascript:alert(1)", "https://gift.example/x"]) {
      expect(inviteShareLink("tok-1", origin)).toBeNull();
    }
  });
});

describe("copyMyInviteLink", () => {
  it("reads the own token and copies the invite link", async () => {
    readLink.mockResolvedValue({ ok: true, token: "tok-1" });
    copy.mockResolvedValue(true);

    await expect(copyMyInviteLink("https://gift.example")).resolves.toBe("copied");
    expect(readLink).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith("https://gift.example/i/tok-1");
  });

  it("copies nothing when the own link cannot be read", async () => {
    readLink.mockResolvedValue({ ok: false, invalid: true });

    await expect(copyMyInviteLink("https://gift.example")).resolves.toBe("failed");
    expect(copy).not.toHaveBeenCalled();
  });

  it("reports a refused clipboard write as failed", async () => {
    readLink.mockResolvedValue({ ok: true, token: "tok-1" });
    copy.mockResolvedValue(false);

    await expect(copyMyInviteLink("https://gift.example")).resolves.toBe("failed");
    expect(copy).toHaveBeenCalledWith("https://gift.example/i/tok-1");
  });

  it("reports a clipboard exception as failed, never as success", async () => {
    readLink.mockResolvedValue({ ok: true, token: "tok-1" });
    copy.mockRejectedValue(new Error("clipboard denied"));

    await expect(copyMyInviteLink("https://gift.example")).resolves.toBe("failed");
  });

  it("does not copy a broken link when the origin is missing", async () => {
    readLink.mockResolvedValue({ ok: true, token: "tok-1" });

    await expect(copyMyInviteLink("")).resolves.toBe("failed");
    expect(copy).not.toHaveBeenCalled();
  });
});
