// The browser session is an httpOnly cookie: JS never reads or stores the token (AD-3).
export async function getSessionToken(): Promise<string | null> {
  return null;
}

export async function setSessionToken(token: string): Promise<void> {
  void token;
}

export async function clearSessionToken(): Promise<void> {}
