/**
 * CLE-86 web/test stand-in for the remembered «Доступно обновление» dismissal.
 *
 * The web build never checks a version, so nothing is read and nothing is
 * written. The phone build resolves `dismissed.native.ts` instead and keeps the
 * one string in SecureStore.
 */
export async function readDismissedVersion(): Promise<string | null> {
  return null;
}

export async function writeDismissedVersion(_version: string): Promise<void> {}
