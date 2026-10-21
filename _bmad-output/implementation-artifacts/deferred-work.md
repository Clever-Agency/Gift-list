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
- `getEnv()` в `src/lib/auth.ts` и проверка `DATABASE_URL` в `src/db/client.ts` выполняются при импорте; комментарий в `env.ts` про lazy неверен. Проверить: `npm run build` без `.env`. Unverified medium.
- Cyrillic отсутствует в DM Sans / Fraunces → системный шрифт в RU-интерфейсе; нужно решение по UX (`src/app/layout.tsx`).
- `/lists` без сессии редиректит на `/register` — заменить на `/login` в Story 1.3.
