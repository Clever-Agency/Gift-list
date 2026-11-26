import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { deleteMany, create, findFirst, transaction, sendEmailChangedNotice } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  sendEmailChangedNotice: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: {
    verification: { deleteMany, create, findFirst },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/email-change-mail", () => ({ sendEmailChangedNotice }));

import {
  EMAIL_CHANGE_LINK_TTL_SECONDS,
  EMAIL_CHANGE_PENDING_PREFIX,
  forgetEmailChangeRequest,
  notifyPreviousEmailAfterChange,
  rememberEmailChangeRequest,
} from "./email-change-pending";

const now = new Date("2026-11-26T10:00:00.000Z");

beforeEach(() => {
  deleteMany.mockReset();
  create.mockReset();
  findFirst.mockReset();
  transaction.mockReset();
  sendEmailChangedNotice.mockReset();
  deleteMany.mockResolvedValue({ count: 0 });
  create.mockResolvedValue({});
  transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  sendEmailChangedNotice.mockResolvedValue(undefined);
});

describe("rememberEmailChangeRequest", () => {
  it("replaces the previous row and stores both addresses for an hour", async () => {
    await rememberEmailChangeRequest({
      userId: "u1",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      locale: "ru",
      now,
    });

    const identifier = `${EMAIL_CHANGE_PENDING_PREFIX}u1`;
    expect(deleteMany).toHaveBeenCalledWith({ where: { identifier } });
    expect(create).toHaveBeenCalledWith({
      data: {
        identifier,
        value: JSON.stringify({
          oldEmail: "old@example.com",
          newEmail: "new@example.com",
          locale: "ru",
        }),
        expiresAt: new Date(now.getTime() + EMAIL_CHANGE_LINK_TTL_SECONDS * 1000),
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("keeps an absent locale as null", async () => {
    await rememberEmailChangeRequest({
      userId: "u1",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      locale: null,
      now,
    });

    const data = create.mock.calls[0]?.[0] as { data: { value: string } };
    expect(JSON.parse(data.data.value)).toEqual({
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      locale: null,
    });
  });
});

describe("forgetEmailChangeRequest", () => {
  it("deletes only the caller's pending row", async () => {
    await forgetEmailChangeRequest("u1");

    expect(deleteMany).toHaveBeenCalledWith({
      where: { identifier: `${EMAIL_CHANGE_PENDING_PREFIX}u1` },
    });
    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
  });
});

describe("notifyPreviousEmailAfterChange", () => {
  it("sends the notice to the old address after the new one is committed", async () => {
    findFirst.mockResolvedValue({
      value: JSON.stringify({ oldEmail: "old@example.com", newEmail: "new@example.com", locale: "ru" }),
    });

    await notifyPreviousEmailAfterChange({ id: "u1", email: "new@example.com" });

    expect(sendEmailChangedNotice).toHaveBeenCalledWith({
      to: "old@example.com",
      locale: "ru",
      newEmail: "new@example.com",
    });
    expect(deleteMany).toHaveBeenCalledWith({ where: { identifier: `${EMAIL_CHANGE_PENDING_PREFIX}u1` } });
  });

  it("compares addresses case-insensitively", async () => {
    findFirst.mockResolvedValue({
      value: JSON.stringify({ oldEmail: "old@example.com", newEmail: "New@Example.com", locale: null }),
    });

    await notifyPreviousEmailAfterChange({ id: "u1", email: "new@example.com" });

    expect(sendEmailChangedNotice).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no change was requested", async () => {
    findFirst.mockResolvedValue(null);

    await notifyPreviousEmailAfterChange({ id: "u1", email: "new@example.com" });

    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("ignores an update that moved to another address", async () => {
    findFirst.mockResolvedValue({
      value: JSON.stringify({ oldEmail: "old@example.com", newEmail: "other@example.com", locale: "ru" }),
    });

    await notifyPreviousEmailAfterChange({ id: "u1", email: "new@example.com" });

    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("ignores a broken row instead of failing the user update", async () => {
    findFirst.mockResolvedValue({ value: "not json" });

    await notifyPreviousEmailAfterChange({ id: "u1", email: "new@example.com" });

    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
  });
});
