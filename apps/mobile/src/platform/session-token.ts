// Stub for tsc and Vitest. Real implementations: session-token.native.ts, session-token.web.ts.
export async function getSessionToken(): Promise<string | null> {
  return null;
}

export async function setSessionToken(token: string): Promise<void> {
  void token;
}

export async function clearSessionToken(): Promise<void> {}
