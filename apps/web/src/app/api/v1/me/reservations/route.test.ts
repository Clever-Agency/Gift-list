import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getMyReservations } = vi.hoisted(() => ({ getMyReservations: vi.fn() }));

vi.mock("@/actions/my-reservations", () => ({ getMyReservations }));

const notFound = { ok: false, code: "NOT_FOUND", message: "Not found" };

const list = {
  ok: true as const,
  data: {
    reservations: [
      {
        giftId: "g1",
        titleSnapshot: "Наушники",
        status: "RESERVED" as const,
        ownerNick: "anna",
        dueAt: "2026-12-09",
        phase: "ACTIVE" as const,
        bought: false,
        holderVisibleToOwner: false,
        holderVisibleToOthers: true,
        priceAmount: null,
        priceCurrency: null,
        photoUrl: null,
        canOpenGift: true,
      },
    ],
  },
};

function get(headers: Record<string, string> = {}) {
  return new Request("http://x/api/v1/me/reservations", { headers });
}

beforeEach(() => {
  getMyReservations.mockReset();
  getMyReservations.mockResolvedValue(list);
});

describe("GET /api/v1/me/reservations", () => {
  it("returns the holder's cards in the AD-12 envelope", async () => {
    const { GET } = await import("./route");
    const res = await GET(get({ authorization: "Bearer t" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual(list);
    expect(getMyReservations).toHaveBeenCalledTimes(1);
    const headers = getMyReservations.mock.calls[0][0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("answers UNAUTHENTICATED with 401", async () => {
    getMyReservations.mockResolvedValue({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
    const { GET } = await import("./route");
    const res = await GET(get());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication required",
    });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "answers %s as not found without calling the read",
    async (method) => {
      const route = await import("./route");
      const res = route[method](get());

      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await res.json()).toEqual(notFound);
      expect(getMyReservations).not.toHaveBeenCalled();
    },
  );
});
