/**
 * `expo-linking` opens the system browser; in the catalog a press would leave
 * the page, so the call only resolves. Everything the app renders is unaffected.
 */

export function openURL(_url: string): Promise<void> {
  return Promise.resolve();
}

export function canOpenURL(_url: string): Promise<boolean> {
  return Promise.resolve(true);
}

export function createURL(path: string): string {
  return path;
}

export function parse(_url: string): { path: string | null } {
  return { path: null };
}
