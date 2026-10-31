"use server";

import { headers } from "next/headers";
import type { ActionResult, Me } from "@gift-list/contracts";
import { getCurrentUser } from "./current-user";

export async function getMe(): Promise<ActionResult<Me>> {
  return getCurrentUser(await headers());
}
