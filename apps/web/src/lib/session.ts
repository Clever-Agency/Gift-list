import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Current session or null; always re-checked inside actions and pages. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
