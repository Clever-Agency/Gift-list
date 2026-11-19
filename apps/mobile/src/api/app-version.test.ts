import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAppVersionPolicy } from "@/api/app-version";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/api/client", () => api);

const data = {
  android: { latestVersion: "0.2.0", minSupportedVersion: "0.1.0", storeUrl: null },
  ios: {
    latestVersion: "0.2.0",
    minSupportedVersion: "0.1.0",
    storeUrl: "https://apps.apple.com/app/id1",
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchAppVersionPolicy", () => {
  it("GETs the public policy route through the shared transport", async () => {
    api.apiRequest.mockResolvedValue({ ok: true, data });

    await expect(fetchAppVersionPolicy()).resolves.toEqual({ ok: true, data });
    expect(api.apiRequest).toHaveBeenCalledWith("/api/v1/app-version");
  });

  it("passes a network failure through", async () => {
    api.apiRequest.mockResolvedValue({ ok: false, network: true });

    await expect(fetchAppVersionPolicy()).resolves.toEqual({
      ok: false,
      network: true,
    });
  });

  it("passes an error envelope through", async () => {
    const error = { ok: false, code: "UNAUTHORIZED", message: "Unauthorized" };
    api.apiRequest.mockResolvedValue(error);

    await expect(fetchAppVersionPolicy()).resolves.toEqual(error);
  });
});
