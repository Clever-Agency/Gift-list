import { describe, expect, it, vi } from "vitest";
import { INITIAL_SESSION, loadSession, sessionReducer } from "./session-state";

const me = { id: "u1", email: "a@b.c", name: "Аня", nick: "anya" };
const apiError = (code: "UNAUTHENTICATED" | "FORBIDDEN") =>
  ({ ok: false, kind: "api", error: { ok: false, code, message: "" } }) as const;

describe("sessionReducer", () => {
  it("starts in loading", () => {
    expect(INITIAL_SESSION).toEqual({ status: "loading" });
  });

  it("me-ok -> authenticated", () => {
    expect(
      sessionReducer(INITIAL_SESSION, { type: "result", result: { ok: true, data: me } }),
    ).toEqual({ status: "authenticated", me });
  });

  it("me-anon -> anonymous", () => {
    expect(
      sessionReducer(INITIAL_SESSION, { type: "result", result: apiError("UNAUTHENTICATED") }),
    ).toEqual({ status: "anonymous" });
  });

  it("other api errors and network -> error", () => {
    expect(
      sessionReducer(INITIAL_SESSION, { type: "result", result: apiError("FORBIDDEN") }),
    ).toEqual({ status: "error" });
    expect(
      sessionReducer(INITIAL_SESSION, { type: "result", result: { ok: false, kind: "network" } }),
    ).toEqual({ status: "error" });
  });

  it("refresh -> loading", () => {
    expect(sessionReducer({ status: "error" }, { type: "refresh" })).toEqual({
      status: "loading",
    });
  });
});

describe("loadSession", () => {
  const run = async (result: Parameters<typeof sessionReducer>[1] extends infer E ? (E extends { result: infer R } ? R : never) : never) => {
    const clearToken = vi.fn(async () => {});
    const out = await loadSession({ request: async () => result, clearToken });
    expect(out).toBe(result);
    return clearToken;
  };

  it("me-anon: clears the token exactly once on UNAUTHENTICATED", async () => {
    expect(await run(apiError("UNAUTHENTICATED"))).toHaveBeenCalledTimes(1);
  });

  it("keeps the token on ok", async () => {
    expect(await run({ ok: true, data: me })).not.toHaveBeenCalled();
  });

  it("keeps the token on FORBIDDEN", async () => {
    expect(await run(apiError("FORBIDDEN"))).not.toHaveBeenCalled();
  });

  it("keeps the token on network", async () => {
    expect(await run({ ok: false, kind: "network" })).not.toHaveBeenCalled();
  });
});
