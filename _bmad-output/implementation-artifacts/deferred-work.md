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
  summary: Клиентская часть Story 1.4 в `apps/mobile` — API-клиент с `Accept-Language`, токен в `expo-secure-store` и `Authorization` на Android/iOS, cookie в браузере, текст ошибки по `reason`/`code`, восстановление сессии через `/api/v1/me` при запуске, тест-раннер mobile.
  evidence: Спека 1.4 вышла около 4500 токенов при ориентире 1600; человек 2026-10-31 выбрал разделение. Серверная часть и contracts идут первым PR CLE-36, клиент — следующим заходом `bmad-build` по той же Story 1.4; до него AC 1.4 о клиенте не выполнены и история не закрывается.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: Ответ `api/v1` при сбое инфраструктуры (`getSession` бросает, БД недоступна) — 500 Next без конверта AD-12; клиент должен трактовать не-конверт как сетевую ошибку.
  evidence: В закрытом наборе `ERROR_CODES` нет внутренней ошибки; вопрос встанет при клиентской части 1.4. Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~`trustedOrigins` содержит только `giftlist://`; Expo Go (`exp://`) и dev client (`exp+giftlist://`) получат отказ origin-check при входе.~~ — закрыто CLE-42 2026-11-01: dev-origins были в коде безусловно (в т.ч. в проде); теперь только через `AUTH_DEV_TRUSTED_ORIGINS` (`getEnv()`), образец в `apps/web/.env.example`.
  evidence: Найдено ревью CLE-36. Добавлять dev-origins через `getEnv()` вместе с клиентским входом (1.4 клиент / 1.6). Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: `parseJsonBody` (`apps/web/src/lib/api-v1.ts`) читает тело без ограничения размера.
  evidence: Вызовов пока нет; ограничить до первой мутации `api/v1`. Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: Нативный клиент 1.4/1.6 должен слать `expo-origin: giftlist://` (или `Origin: giftlist://`) на `/api/auth/*`, иначе сервер снимет `set-auth-token` и токен не придёт.
  evidence: CLE-36: обёртка `/api/auth/*` отдаёт `set-auth-token` только нативным запросам, чтобы токен не был доступен JS в браузере (AC 1.4, AD-3). Клиент `@better-auth/expo/client` шлёт `expo-origin` сам; свой fetch-клиент — должен явно.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-1-6-1-8-регистрация-вход-часовой-пояс.md`
  summary: Из отложенного клиента Story 1.4 в этот заход вошли API-клиент с `Accept-Language`, токен в SecureStore и `Authorization` на Android/iOS, cookie в браузере, текст ошибки по `reason`/`code` и восстановление сессии через `GET /api/v1/me`.
  evidence: CLE-37/38/39 нуждаются в сессии. История 1.4 в `sprint-status.yaml` остаётся `in-progress`: нет тест-раннера `apps/mobile` и конверта на ответ 500 при сбое инфраструктуры.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-1-6-1-8-регистрация-вход-часовой-пояс.md`
  summary: Форма сброса пароля (Story 1.7) не делается; на входе есть ссылка «Забыли пароль» и заглушка `/forgot`.
  evidence: CLE-40 отдельно. Ссылка нужна экрану входа, чтобы не вести в несуществующий маршрут.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-1-6-1-8-регистрация-вход-часовой-пояс.md`
  summary: `/wishlist/:token` и `/invite/:token` только принимают возврат после входа. Список желаний и дружба по приглашению не реализованы.
  evidence: AC 1.5 требует вернуться на эти пути. Наполнение — Story 2.1, 3.3 и 4.7. Дружба в транзакции регистрации не создаётся: модели `Friendship` ещё нет.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md`
  summary: `AUTH_DEV_TRUSTED_ORIGINS` не проверяет значения и не блокируется в проде: `*`, `http(s)://…` или `exp://` в прод-env молча станут доверенными origins.
  evidence: `devTrustedOriginsSchema` — `z.array(z.string())`; можно ограничить элементы кастомными схемами без хоста и отклонять непустое значение при `NODE_ENV=production`. Unverified medium (нужно решение, допустим ли dev-сервер с `NODE_ENV=production`).

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md`
  summary: Better Auth сам дописывает `BETTER_AUTH_TRUSTED_ORIGINS` из `process.env` в `trustedOrigins` в обход `getEnv()` (AD-16).
  evidence: `node_modules/better-auth/dist/context/helpers.mjs:83` (1.7.14). Не вызвано CLE-42; решить — запретить переменную в `envSchema` или явно задокументировать. Medium.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md`
  summary: Признак нативного клиента (`isNative` в `apps/web/src/lib/auth-token.ts`, `isNativeAuthRequest` в `auth-session.ts`) учитывает только `expo-origin` и `Origin: giftlist://`; клиент, шлющий `Origin: exp://…` без `expo-origin`, пройдёт origin-check, но не получит `set-auth-token`.
  evidence: текущий `apps/mobile/src/api/client.ts` всегда шлёт `expo-origin: giftlist://`, поэтому сейчас не проявляется. Unverified medium — проверить при входе через `@better-auth/expo/client` (Story 1.6).

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md`
  summary: Тест `apps/web/src/lib/auth.test.ts` «exposes handler to toNextJsHandler's `in` check» падает по таймауту 5000 мс на холодном импорте `auth.ts` при параллельном `npm test` на Windows.
  evidence: прогон CLE-42 — импорт 9.5 с, повторные прогоны зелёные; поднять таймаут теста или `testTimeout`. Low/flaky.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md`
  summary: `npm run build` на Windows падает в `apps/web/scripts/sync-spa.mjs` с `spawnSync npm ENOENT`.
  evidence: `spawnSync("npm", …)` без `shell` (строка ~13); на Windows нужен `npm.cmd`/`shell: true`. В CI (Linux) не проявляется.
