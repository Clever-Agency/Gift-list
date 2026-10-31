import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

import ListsPage from "./page";
import { getSession } from "@/lib/session";

describe("lists page", () => {
  it("sends an anonymous visitor to login", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(ListsPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("sends a session to the app home", async () => {
    vi.mocked(getSession).mockResolvedValue(
      {} as NonNullable<Awaited<ReturnType<typeof getSession>>>,
    );
    await expect(ListsPage()).rejects.toThrow("NEXT_REDIRECT:/");
  });
});
