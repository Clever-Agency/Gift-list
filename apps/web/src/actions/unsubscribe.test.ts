import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { verifyUnsubscribeToken, setReminderSwitch } = vi.hoisted(() => ({
  verifyUnsubscribeToken: vi.fn(),
  setReminderSwitch: vi.fn(),
}));

vi.mock("@/lib/unsubscribe-token", () => ({ verifyUnsubscribeToken }));
vi.mock("@/lib/notification-store", () => ({ setReminderSwitch }));

import { applyUnsubscribe } from "./unsubscribe";

beforeEach(() => {
  verifyUnsubscribeToken.mockReset();
  setReminderSwitch.mockReset();
  setReminderSwitch.mockResolvedValue({ count: 1 });
});

describe("applyUnsubscribe", () => {
  it("turns the type switch of the token off and nothing else", async () => {
    verifyUnsubscribeToken.mockReturnValue({ userId: "u1", type: "friendDates" });

    await expect(applyUnsubscribe("token", false)).resolves.toEqual({
      ok: true,
      type: "friendDates",
      enabled: false,
    });
    expect(setReminderSwitch).toHaveBeenCalledWith("u1", "friendDates", false);
  });

  it("turns the same switch back on for the «Вернуть» button", async () => {
    verifyUnsubscribeToken.mockReturnValue({ userId: "u1", type: "ownList" });

    await expect(applyUnsubscribe("token", true)).resolves.toEqual({
      ok: true,
      type: "ownList",
      enabled: true,
    });
    expect(setReminderSwitch).toHaveBeenCalledWith("u1", "ownList", true);
  });

  it("answers a bad token without writing", async () => {
    verifyUnsubscribeToken.mockReturnValue(null);

    await expect(applyUnsubscribe("forged", false)).resolves.toEqual({ ok: false });
    expect(setReminderSwitch).not.toHaveBeenCalled();
  });

  it("gives a deleted account the same neutral answer without a write", async () => {
    verifyUnsubscribeToken.mockReturnValue({ userId: "gone", type: "friendDates" });
    setReminderSwitch.mockResolvedValue({ count: 0 });

    await expect(applyUnsubscribe("token", false)).resolves.toEqual({ ok: false });
  });
});
