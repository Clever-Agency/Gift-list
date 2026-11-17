/**
 * Story 3.5 / DESIGN SearchField: the field is labelled «Имя или @ник», so a
 * leading `@` is optional. The search screen and the API client share this one
 * normalization, and an empty result means «до ввода»: no request at all.
 *
 * Case and `ё` are left to the server: the AD-27 normalization happens there,
 * and the client must not send a query the person did not type.
 */
export function prepareUserSearchQuery(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("@") ? trimmed.slice(1).trim() : trimmed;
}
