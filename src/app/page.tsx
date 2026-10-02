import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center gap-8 px-4 py-16 md:px-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.02em] text-primary">
            Gift List
          </h1>
          <p className="font-sans text-2xl font-semibold tracking-[-0.01em] text-foreground">
            Вишлист для близкого круга
          </p>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Собирайте идеи подарков в одном месте и делитесь желаниями с
            близкими без лишних догадок.
          </p>
        </div>
        <div>
          <Button render={<Link href="/register" />} nativeButton={false}>
            Создать аккаунт
          </Button>
        </div>
      </main>
    </div>
  );
}
