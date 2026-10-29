import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Регистрация — Gift List" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/lists");

  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-8 px-4 py-16 md:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-[-0.02em] text-primary">
          Создать аккаунт
        </h1>
        <p className="text-base text-muted-foreground">
          Два списка подарков — открытый и для друзей — появятся сразу.
        </p>
      </div>
      <RegisterForm />
    </main>
  );
}
