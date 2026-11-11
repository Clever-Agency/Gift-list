import { notFound } from "next/navigation";
import { UiCheck } from "./ui-check";

// Служебная SSR-проверка Tamagui на Next (Story 1.9; сужена в Story 1.10).
// Каталог компонентов — Storybook, эта страница только подтверждает серверный рендер
// и CSS темы. Только для dev: в production отдаёт 404. Не входит в NEXT_OWNED_PREFIXES:
// fallback-rewrite на SPA срабатывает лишь для путей без страницы Next.
export default function UiCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiCheck />;
}

UiCheckPage.displayName = "UiCheckPage";
