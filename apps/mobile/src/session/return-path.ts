import { safeNextPath } from "@gift-list/contracts";

export function paramValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function returnPath(value: string | string[] | undefined): string {
  return safeNextPath(paramValue(value));
}
