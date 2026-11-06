import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { create, findUnique, PrismaClientKnownRequestError } = vi.hoisted(() => {
  /** Stands in for the generated class, so a test can shape the `code`. */
  class PrismaClientKnownRequestError extends Error {
    code: string;

    constructor(message: string, { code }: { code: string }) {
      super(message);
      this.code = code;
    }
  }

  return { create: vi.fn(), findUnique: vi.fn(), PrismaClientKnownRequestError };
});

vi.mock("@/db/client", () => ({ prisma: { list: { create, findUnique } } }));
vi.mock("@/db/generated/client", () => ({ Prisma: { PrismaClientKnownRequestError } }));

import { ensureOwnerList } from "./owner-list";

function p2002() {
  return new PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002" });
}

beforeEach(() => {
  create.mockReset();
  findUnique.mockReset();
});

describe("ensureOwnerList", () => {
  it("creates the missing list with a fresh token for the given owner", async () => {
    create.mockResolvedValue({ id: "l1" });

    await ensureOwnerList("u1");

    expect(create).toHaveBeenCalledWith({
      data: { ownerId: "u1", publicToken: expect.any(String) },
      select: { id: true },
    });
    const token = create.mock.calls[0][0].data.publicToken as string;
    expect(token).toMatch(/^[a-z0-9]{20,}$/);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("keeps the winner's token when a concurrent repair already created the list", async () => {
    const rows: { id: string; publicToken: string }[] = [];
    create.mockImplementation(
      async ({ data }: { data: { ownerId: string; publicToken: string } }) => {
        if (rows.length > 0) throw p2002();
        rows.push({ id: "l1", publicToken: data.publicToken });
        return { id: "l1" };
      },
    );
    findUnique.mockImplementation(async () => (rows.length === 0 ? null : { id: rows[0].id }));

    await Promise.all([ensureOwnerList("u1"), ensureOwnerList("u1")]);

    expect(rows).toHaveLength(1);
    expect(rows[0].publicToken).toBe(create.mock.calls[0][0].data.publicToken);
    expect(rows[0].publicToken).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledTimes(2);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("rethrows a unique failure that did not leave a list row", async () => {
    create.mockRejectedValue(p2002());
    findUnique.mockResolvedValue(null);

    await expect(ensureOwnerList("u1")).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
    expect(findUnique).toHaveBeenCalledWith({
      where: { ownerId: "u1" },
      select: { id: true },
    });
  });

  it("does not hide unrelated database failures", async () => {
    const failure = new Error("database unavailable");
    create.mockRejectedValue(failure);

    await expect(ensureOwnerList("u1")).rejects.toBe(failure);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
