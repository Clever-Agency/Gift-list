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
  summary: ~~Проверка в CI, что `npm run build` из корня даёт `apps/web/.next/standalone/apps/web/server.js` и сервер стартует.~~ — закрыто 2026-10-31 (CLE-33): `.github/workflows/ci.yml` проверяет `server.js` и ответ сервера на `/`.
  evidence: CI в репозитории нет; поломка `outputFileTracingRoot`/`transpilePackages` пройдёт `npm test` незамеченной. Место — GitHub Actions по AD-5.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-каркас-expo-и-токены-forest-paper.md`
  summary: Автотесты не загружают `next.config` rewrites, HTML ассетов SPA, `generateMetadata` и маркер Hermes `__addLocaleData`.
  evidence: В CLE-35 это проверено сборкой, `path-to-regexp`, `curl` и `strings`. В `npm test` этих проверок нет; CI по-прежнему нет.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~Клиентская часть Story 1.4 в `apps/mobile` — API-клиент с `Accept-Language`, токен в `expo-secure-store` и `Authorization` на Android/iOS, cookie в браузере, текст ошибки по `reason`/`code`, восстановление сессии через `/api/v1/me` при запуске, тест-раннер mobile.~~ — закрыто 2026-11-01: `apps/mobile/src/api`, `session`, `platform/transport.*`, Vitest в mobile.
  evidence: Спека 1.4 вышла около 4500 токенов при ориентире 1600; человек 2026-10-31 выбрал разделение. Серверная часть и contracts идут первым PR CLE-36, клиент — следующим заходом `bmad-build` по той же Story 1.4; до него AC 1.4 о клиенте не выполнены и история не закрывается.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~Ответ `api/v1` при сбое инфраструктуры (`getSession` бросает, БД недоступна) — 500 Next без конверта AD-12; клиент должен трактовать не-конверт как сетевую ошибку.~~ — закрыто 2026-11-01: клиент трактует не-конверт как `network` (`errors.network`).
  evidence: В закрытом наборе `ERROR_CODES` нет внутренней ошибки; вопрос встанет при клиентской части 1.4. Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~`trustedOrigins` содержит только `giftlist://`; Expo Go (`exp://`) и dev client (`exp+giftlist://`) получат отказ origin-check при входе.~~
  evidence: Найдено ревью CLE-36. Добавлять dev-origins через `getEnv()` вместе с клиентским входом (1.4 клиент / 1.6). Unverified medium. 2026-11-01: перенесено в отдельный пункт ниже и Linear CLE-42.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: `parseJsonBody` (`apps/web/src/lib/api-v1.ts`) читает тело без ограничения размера.
  evidence: Вызовов пока нет; ограничить до первой мутации `api/v1`. Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~Нативный клиент 1.4/1.6 должен слать `expo-origin: giftlist://` (или `Origin: giftlist://`) на `/api/auth/*`, иначе сервер снимет `set-auth-token` и токен не придёт.~~ — закрыто 2026-11-01: `transport.native.ts` шлёт `expo-origin: giftlist://` на `/api/auth/*`.
  evidence: CLE-36: обёртка `/api/auth/*` отдаёт `set-auth-token` только нативным запросам, чтобы токен не был доступен JS в браузере (AC 1.4, AD-3). Клиент `@better-auth/expo/client` шлёт `expo-origin` сам; свой fetch-клиент — должен явно.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: Dev-origins Expo (`exp://`, `exp+giftlist://`) в `trustedOrigins` через необязательную переменную `getEnv()` (`AUTH_DEV_TRUSTED_ORIGINS`) с тестом в `auth.test.ts` и образцом в `apps/web/.env.example`.
  evidence: Спека клиента 1.4 вышла около 3000 токенов при ориентире 1600; человек 2026-11-01 выбрал отделить серверный пункт. AC Story 1.4 его не требуют (scheme `giftlist://` уже в `trustedOrigins`); нужен к первому входу из Expo Go или dev client — Story 1.6. Linear CLE-42.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: `SessionProvider` без теста: путь `/api/v1/me`, передача настоящего `clearSessionToken` и повторная загрузка по `refresh` не проверены.
  evidence: Ревью 2026-11-01 (verification-gap). Vitest в mobile — node-среда без рендера React; чистые части (`loadSession`, `sessionReducer`) покрыты. Добавить тест-рендер вместе с первым потребителем `useSession()` (Story 1.5/1.6). Linear CLE-43.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: AC «веб-сборка: cookie и `Accept-Language` на `/api/v1/me`, без `Authorization`» не проверен в браузере с живым сервером — только юнит-тестом веб-транспорта.
  evidence: Ревью 2026-11-01. Unverified medium. Закрыть ручной проверкой: `npm run web` в `apps/mobile` + сервер с БД, вкладка Network. Linear CLE-43.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: Успешные ответы разбираются строго (`meSchema` — `z.strictObject`): новое поле в `/api/v1/me` (например `locale` по AD-27) превратит ответ старой нативной сборки в `network`, и при запуске она покажет «Нет связи».
  evidence: Итоговое ревью CLE-41, 2026-11-01. Fallback по `code` защищает только ошибки. До первого изменения формы `Me` решить, разбирать ли данные на клиенте нестрого или расширять контракт только добавлением полей и версионировать. Строгость схемы — из CLE-36. Linear CLE-43.
