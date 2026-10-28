import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/db/client";
import { LIST_TITLES, LIST_TYPES } from "@/domain";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Мои списки — Gift List" };

export default async function MyListsPage() {
  const session = await getSession();
  if (!session) redirect("/register");

  const lists = await prisma.list.findMany({
    where: { ownerId: session.user.id },
  });

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-8 px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-primary">
        Мои списки
      </h1>
      <ul className="flex flex-col gap-4">
        {LIST_TYPES.map((type) => {
          const list = lists.find((item) => item.type === type);
          if (!list) return null;
          return (
            <li key={list.id} className="rounded-xl border bg-card p-4">
              <h2 className="text-lg font-semibold">{LIST_TITLES[type]}</h2>
              <p className="text-sm text-muted-foreground">Пока пусто</p>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
