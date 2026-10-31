import { redirect } from "next/navigation";

/** Temporary bridge so the registration action's `redirect("/lists")` still resolves (Story 1.5). */
export const dynamic = "force-dynamic";

export default async function ListsPage() {
  // Loaded on request so `next build` does not evaluate Better Auth without secrets.
  const { getSession } = await import("@/lib/session");
  const session = await getSession();
  if (!session) redirect("/login");
  redirect("/");
}
