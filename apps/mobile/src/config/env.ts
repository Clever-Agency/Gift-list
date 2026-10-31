function readPublic(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Empty `EXPO_PUBLIC_BRAND_NAME` becomes the fallback only in this module (AD-24). */
export function getBrandName(): string {
  const value = readPublic(process.env.EXPO_PUBLIC_BRAND_NAME);
  return value.length > 0 ? value : "Gift List";
}

/** Empty means "not configured". Callers show the catalog phrase and do not throw. */
export function getApiBaseUrl(): string {
  return readPublic(process.env.EXPO_PUBLIC_API_BASE_URL);
}

export function getAuthorUrl(): string {
  return readPublic(process.env.EXPO_PUBLIC_AUTHOR_URL);
}
