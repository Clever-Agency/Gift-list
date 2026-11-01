import type { Me } from "@gift-list/contracts";
import type { ApiResult } from "@/api/client";

export type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; me: Me }
  | { status: "anonymous" }
  | { status: "error" };

export type SessionEvent =
  | { type: "refresh" }
  | { type: "result"; result: ApiResult<Me> };

export const INITIAL_SESSION: SessionState = { status: "loading" };

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  if (event.type === "refresh") return { status: "loading" };
  const { result } = event;
  if (result.ok) return { status: "authenticated", me: result.data };
  if (result.kind === "api" && result.error.code === "UNAUTHENTICATED") {
    return { status: "anonymous" };
  }
  return { status: "error" };
}

export type SessionDeps = {
  request: () => Promise<ApiResult<Me>>;
  clearToken: () => Promise<void>;
};

/** Loads the current user; a 401 drops the stored token (native) before the state turns anonymous. */
export async function loadSession(deps: SessionDeps): Promise<ApiResult<Me>> {
  const result = await deps.request();
  if (!result.ok && result.kind === "api" && result.error.code === "UNAUTHENTICATED") {
    await deps.clearToken();
  }
  return result;
}
