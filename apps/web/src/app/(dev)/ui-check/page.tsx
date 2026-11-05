import { notFound } from "next/navigation";
import { UiCheck } from "./ui-check";

// Служебная страница проверки SSR Tamagui и Dialog на Next (Story 1.9).
// Только для dev: в production отдаёт 404. Не входит в NEXT_OWNED_PREFIXES: это не нужно,
// потому что fallback-rewrite на SPA срабатывает лишь для путей без страницы Next.
export default function UiCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiCheck />;
}

UiCheckPage.displayName = "UiCheckPage";
