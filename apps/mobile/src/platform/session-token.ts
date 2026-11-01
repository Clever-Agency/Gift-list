/** Web session is the httpOnly cookie. Nothing is stored in JS (AD-3). */

export async function readSessionToken(): Promise<string | null> {
  return null;
}

export async function writeSessionToken(_token: string): Promise<void> {}

export async function clearSessionToken(): Promise<void> {}
