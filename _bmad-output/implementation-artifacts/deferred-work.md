# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-проекта-из-starter-next-js-shadcn-forest-paper.md`
  summary: Typed `src/lib/env.ts` (zod) не подключён к Prisma client — stub остаётся до secrets/auth (1.2+)
  evidence: Structural Seed / spec Design Notes intentionally leave env stub; client reads process.env for DATABASE_URL only

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-scaffold-проекта-из-starter-next-js-shadcn-forest-paper.md`
  summary: shadcn `dark:` utility classes и `@custom-variant dark` остаются в primitives без dark theme UI
  evidence: UX-A8 light-only; no theme toggle shipped; removing all dark: from generated button is churn without user-facing dark mode

## Deferred from: code review of story-1.1 (2026-10-01)

- ~~Prisma 7.10.0 advisory (`deepmerge-ts`, `mysql2`)~~ — закрыто 2026-10-02: `overrides` в package.json (`deepmerge-ts ^8.0.2`, `mysql2 ^3.24.5`), Prisma остаётся 7.10.0, `npm audit` = 0. Убрать overrides, когда Prisma обновит свои зависимости.

## Deferred from: code review of spec-1-2-регистрация-и-создание-двух-списков (2026-10-06)

- Живая БД не проверена (SQL rate limit, совместимость credential-аккаунта с `signInEmail`, миграции, гонка регистраций) — закрывается ручной проверкой из спеки 1.2. Unverified medium.
- ~~`getEnv()` в `src/lib/auth.ts` и проверка `DATABASE_URL` в `src/db/client.ts` выполняются при импорте; комментарий в `env.ts` про lazy неверен. Проверить: `npm run build` без `.env`.~~ Закрыто CLE-35: Prisma и Better Auth создаются при первом обращении, `next build` без `.env` проходит. Живая БД по-прежнему не проверена.
- ~~Cyrillic отсутствует в DM Sans / Fraunces → системный шрифт в RU-интерфейсе (`apps/web/src/app/layout.tsx`). **Решено 2026-10-28 (D-46):** Lora + Manrope с `cyrillic`; заменить в `layout.tsx` в ближайшей истории Next-страниц, в приложении — в Story 1.3.~~ Закрыто CLE-35: Lora 600 и Manrope 400/500/600 в `layout.tsx` и в Expo.
- ~~`/lists` без сессии редиректит на `/register` — заменить на `/login` в Story 1.3.~~ Закрыто CLE-35: нет сессии → `/login`, сессия → `/`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-монорепозиторий-apps-web-apps-mobile-packages-contracts.md`
  summary: ~~Автоматически проверять границы AD-17/AD-26 — линт для `packages/contracts` (без React, Prisma, `process.env`) и запрет импорта `apps/web` из `apps/mobile`.~~ Закрыто CLE-35: корневой `lint` проверяет web, mobile, contracts и `scripts/check-boundaries.mjs`.
  evidence: Закрыто CLE-35. Раньше корневой `lint` проверял только `apps/web`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-монорепозиторий-apps-web-apps-mobile-packages-contracts.md`
  summary: Проверка в CI, что `npm run build` из корня даёт `apps/web/.next/standalone/apps/web/server.js` и сервер стартует.
  evidence: CI в репозитории нет; поломка `outputFileTracingRoot`/`transpilePackages` пройдёт `npm test` незамеченной. Место — GitHub Actions по AD-5.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-каркас-expo-и-токены-forest-paper.md`
  summary: Автотесты не загружают `next.config` rewrites, HTML ассетов SPA, `generateMetadata` и маркер Hermes `__addLocaleData`.
  evidence: В CLE-35 это проверено сборкой, `path-to-regexp`, `curl` и `strings`. В `npm test` этих проверок нет; CI по-прежнему нет.
