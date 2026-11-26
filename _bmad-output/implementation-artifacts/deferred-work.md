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
  summary: ~~Клиентская часть Story 1.4 в `apps/mobile` — API-клиент с `Accept-Language`, токен в `expo-secure-store` и `Authorization` на Android/iOS, cookie в браузере, текст ошибки по `reason`/`code`, восстановление сессии через `/api/v1/me` при запуске, тест-раннер mobile.~~ — закрыто 2026-11-01: клиент и сессия вошли в Stories 1.5/1.6 (`main`), тест-раннер и тесты — CLE-41.
  evidence: Спека 1.4 вышла около 4500 токенов при ориентире 1600; человек 2026-10-31 выбрал разделение. Серверная часть и contracts идут первым PR CLE-36, клиент — следующим заходом `bmad-build` по той же Story 1.4; до него AC 1.4 о клиенте не выполнены и история не закрывается.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~Ответ `api/v1` при сбое инфраструктуры (`getSession` бросает, БД недоступна) — 500 Next без конверта AD-12; клиент должен трактовать не-конверт как сетевую ошибку.~~ — закрыто 2026-11-01: клиент трактует не-конверт как `network` (`errors.network`).
  evidence: В закрытом наборе `ERROR_CODES` нет внутренней ошибки; вопрос встанет при клиентской части 1.4. Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~`trustedOrigins` содержит только `giftlist://`; Expo Go (`exp://`) и dev client (`exp+giftlist://`) получат отказ origin-check при входе.~~ — закрыто CLE-42 2026-11-01: dev-origins были в коде безусловно (в т.ч. в проде); теперь только через `AUTH_DEV_TRUSTED_ORIGINS` (`getEnv()`), образец в `apps/web/.env.example`.
  evidence: Найдено ревью CLE-36. Добавлять dev-origins через `getEnv()` вместе с клиентским входом (1.4 клиент / 1.6). Unverified medium. 2026-11-01: перенесено в отдельный пункт ниже и Linear CLE-42.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: `parseJsonBody` (`apps/web/src/lib/api-v1.ts`) читает тело без ограничения размера.
  evidence: Вызовов пока нет; ограничить до первой мутации `api/v1`. Unverified medium.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-http-адаптер-app-api-v1-и-сессия-приложения.md`
  summary: ~~Нативный клиент 1.4/1.6 должен слать `expo-origin: giftlist://` (или `Origin: giftlist://`) на `/api/auth/*`, иначе сервер снимет `set-auth-token` и токен не придёт.~~ — закрыто 2026-11-01: `apps/mobile/src/api/client.ts` шлёт `expo-origin: giftlist://` в нативных запросах.
  evidence: CLE-36: обёртка `/api/auth/*` отдаёт `set-auth-token` только нативным запросам, чтобы токен не был доступен JS в браузере (AC 1.4, AD-3). Клиент `@better-auth/expo/client` шлёт `expo-origin` сам; свой fetch-клиент — должен явно.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-1-6-1-8-регистрация-вход-часовой-пояс.md`
  summary: Из отложенного клиента Story 1.4 в этот заход вошли API-клиент с `Accept-Language`, токен в SecureStore и `Authorization` на Android/iOS, cookie в браузере, текст ошибки по `reason`/`code` и восстановление сессии через `GET /api/v1/me`.
  evidence: CLE-37/38/39 нуждаются в сессии. История 1.4 в `sprint-status.yaml` остаётся `in-progress`: нет тест-раннера `apps/mobile` и конверта на ответ 500 при сбое инфраструктуры. Закрыто CLE-41 (2026-11-01): Vitest в `apps/mobile`, не-конверт — сетевая ошибка, 1-4 → `done`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-1-6-1-8-регистрация-вход-часовой-пояс.md`
  summary: Форма сброса пароля (Story 1.7) не делается; на входе есть ссылка «Забыли пароль» и заглушка `/forgot`.
  evidence: CLE-40 отдельно. Ссылка нужна экрану входа, чтобы не вести в несуществующий маршрут.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-1-6-1-8-регистрация-вход-часовой-пояс.md`
  summary: `/wishlist/:token` и `/invite/:token` только принимают возврат после входа. Список желаний и дружба по приглашению не реализованы.
  evidence: AC 1.5 требует вернуться на эти пути. Наполнение — Story 2.1, 3.3 и 4.7. Дружба в транзакции регистрации не создаётся: модели `Friendship` ещё нет.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-сброс-пароля-по-email.md`
  summary: ~~Лимит сброса берёт IP из первого `X-Forwarded-For`, как регистрация; без заголовка все клиенты делят ключ `unknown`, с поддельным заголовком лимит обходится.~~ — закрыто CLE-56 2026-11-02: на своём Node-сервере `X-Forwarded-For` и `X-Real-IP` заменяются адресом TCP-соединения до того, как Next их прочитает; на Vercel платформенный заголовок не трогается.
  evidence: `clientIp` в `apps/web/src/lib/rate-limit.ts` существовал до Story 1.7 и так же используется регистрацией. Чинить разбор IP надо сразу для обоих ключей, не только для forgot. Сделано в `apps/web/src/lib/peer-address.ts` для всех ключей сразу.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: ~~Dev-origins Expo (`exp://`, `exp+giftlist://`) в `trustedOrigins` через необязательную переменную `getEnv()` (`AUTH_DEV_TRUSTED_ORIGINS`) с тестом в `auth.test.ts` и образцом в `apps/web/.env.example`.~~ — закрыто CLE-42 2026-11-01: `trustedOrigins = ["giftlist://", ...AUTH_DEV_TRUSTED_ORIGINS]`, образец закомментирован в `apps/web/.env.example`, спека `spec-cle-42-dev-origins-expo.md`.
  evidence: Спека клиента 1.4 вышла около 3000 токенов при ориентире 1600; человек 2026-11-01 выбрал отделить серверный пункт. AC Story 1.4 его не требуют (scheme `giftlist://` уже в `trustedOrigins`); нужен к первому входу из Expo Go или dev client — Story 1.6. Linear CLE-42.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: ~~`AuthProvider` (`apps/mobile/src/session/auth-context.tsx`) без теста: запрос `/api/v1/me` при запуске, удаление токена на `UNAUTHENTICATED`, `signOut`.~~ — закрыто 2026-11-01: `auth-context.test.tsx` (8 тестов, `react-dom/client` + `happy-dom`), CLE-43.
  evidence: Ревью 2026-11-01 (verification-gap). Vitest в mobile — node-среда без рендера React; клиент и хранилище токена покрыты. Нужен тест-рендер React. Свой `SessionProvider` из CLE-41 снят при слиянии с `main` в пользу `AuthProvider` Stories 1.5/1.6. Linear CLE-43.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: ~~AC «веб-сборка: cookie и `Accept-Language` на `/api/v1/me`, без `Authorization`» не проверен в браузере с живым сервером — только юнит-тестом клиента.~~ — закрыто 2026-11-02: веб-сборка (`sync-spa.mjs`) на `next dev` с PostgreSQL; после перезагрузки `GET /api/v1/me` → 200 по cookie, клиент шлёт `credentials: include` и `accept-language`, без `authorization` (CLE-43).
  evidence: Ревью 2026-11-01. Unverified medium. Закрыть ручной проверкой: `npm run web` в `apps/mobile` + сервер с БД, вкладка Network. Linear CLE-43.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md`
  summary: ~~Успешные ответы разбираются строго (`meSchema` — `z.strictObject`): новое поле в `/api/v1/me` (например `locale` по AD-27) превратит ответ старой нативной сборки в `network`, и при запуске она покажет «Нет связи».~~ — снято 2026-11-01: клиент из `main` (Stories 1.5/1.6) не проверяет `data` строгой схемой.
  evidence: Итоговое ревью CLE-41, 2026-11-01. Fallback по `code` защищает только ошибки. До первого изменения формы `Me` решить, разбирать ли данные на клиенте нестрого или расширять контракт только добавлением полей и версионировать. Строгость схемы — из CLE-36. Linear CLE-43.

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
  summary: ~~Тест `apps/web/src/lib/auth.test.ts` «exposes handler to toNextJsHandler's `in` check» падает по таймауту 5000 мс на холодном импорте `auth.ts` при параллельном `npm test` на Windows.~~ — закрыто CLE-67 2026-11-06: тот же холодный импорт ронял ещё `unknown-routes.test.ts` и хук `password-reset.test.ts`. В `apps/web/vitest.config.ts` `testTimeout` и `hookTimeout` — 30 с. Корневой `npm test` идёт через `scripts/run-suite.mjs` и не пропускает `check-boundaries.test.mjs`.
  evidence: Приёмка Epic 1: 15,7 с, 9 с и хук 10 с на первом полном прогоне, 5,05 с на втором. Те же три файла отдельно — 24/24. Утверждения тестов не менялись. `scripts/run-suite.mjs` запускает команды из канонического пути диска (`realpathSync.native`): иначе Git Bash (`e:\`) и ESM (`E:\`) дают две копии `@vitest/runner`. На том же прогоне Tamagui и `react-dom` видели разный React, а `expo-modules-core` не находил `__DEV__`: mobile — `vitest.config.mts`, `__DEV__` и `inline: true`; web инлайнит React, `react-dom`, `scheduler`, `tamagui` и `@tamagui/*`.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md`
  summary: ~~`npm run build` на Windows падает в `apps/web/scripts/sync-spa.mjs` с `spawnSync npm ENOENT`.~~ — закрыто CLE-44 2026-11-02: Expo CLI запускается через `process.execPath` без `npm` и shell.
  evidence: `spawnSync("npm", …)` без `shell` (строка ~13); на Windows нужен `npm.cmd`/`shell: true`. В CI (Linux) не проявляется.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-56-лимит-попыток-входа.md`
  summary: ~~`POST /api/auth/sign-in/email` не тратит счётчик `POST /api/v1/session`: catch-all Better Auth по-прежнему проверяет пароль, его лимитер — память процесса и только в production.~~ Закрыто CLE-57: сырые `/sign-in/email`, `/sign-up/email` и `/request-password-reset` отвечают 404 до обработчика.
  evidence: Закрыто CLE-57. `disabledPaths` в `apps/web/src/lib/auth.ts` отвечает 404 на `/sign-in/email`, `/sign-up/email` и `/request-password-reset` до обработчика. Тест — `apps/web/src/lib/auth.test.ts`. Клиент входит через `/api/v1/session`.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-58-прежние-ссылки-сброса-после-смены-пароля.md`
  summary: Смена пароля вошедшим (`/change-password`) не гасит уже выданные ссылки `reset-password:*`.
  evidence: `onPasswordReset` вызывается только из сброса. `changePassword` пишет новый пароль своей транзакцией и хук не зовёт. Сырой путь не в `disabledPaths`. Ссылка, выданная до смены, всё ещё задаёт пароль и при флаге отзыва гасит сессии. Вне CLE-58.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-59-аноним-на-главной-вместо-входа.md`
  summary: «Выйти» на заглушке «Мой вишлист» остаётся primary, без блокировки повторного нажатия; ошибка сети — строка формы, не destructive toast.
  evidence: DESIGN относит «Выйти» и toast «Нет сети» к destructive. Кнопка и текст `form.network` пришли из Story 1.6 и в CLE-59 не менялись. Экраны входа уже глушат повторную отправку через `pending`.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-60-неизвестные-пути-api.md`
  summary: В production неизвестный путь `/api/auth/*` может ответить 429 Better Auth без конверта AD-12.
  evidence: Лимитер включён только в production и считает запрос до роутера; тело `{ message: "Too many requests. Please try again later." }` без `ok` и `code`. Закрытые `disabledPaths` по-прежнему 404 до лимитера и уже отдают конверт. Подменять любой не-конверт нельзя: `get-session` отвечает `null`, `/ok` — `{ ok: true }`.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-монорепозиторий-apps-web-apps-mobile-packages-contracts.md`
  summary: ~~`next build` копировал `apps/web/.env*` в `.next/standalone/apps/web/`, и Docker-образ из standalone увёз бы секреты.~~ — закрыто CLE-61 2026-11-03: `copy-standalone-assets.mjs` после сборки удаляет `.env*` из standalone (без `node_modules`), CI создаёт канареечный `apps/web/.env` и падает, если в standalone остался `.env*`.
  evidence: Next копирует env-файлы вне трассировки, поэтому фильтр трассировки не помогает. Конфигурация читается только из `process.env` через `getEnv()`, так что удаление безопасно; смоук-старт в CI это подтверждает.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-63-минимум-8-символов-пароля.md`
  summary: Ошибка поля не связана с вводом через `aria-invalid` и `aria-describedby`, фокус после отправки не переходит к первому полю, у ошибки нет иконки.
  evidence: `DESIGN.md` → Форма и `EXPERIENCE.md` → доступность описывают эту связь. `TextField` и `PasswordField` по-прежнему отдают только `accessibilityHint`. Так было до CLE-63; у пароля добавлен лишь `accessibilityRole="alert"` на текст ошибки.

## Deferred from: Story 3.2 (CLE-48, 2026-11-04)

- Отношения (Friendship, Block, Subscription, ContactMatch) отдаёт заглушка `apps/web/src/lib/relationships.ts` — «отношений нет» (fail-closed). Epic 4 (AD-10, AD-19) и Epic 8 (AD-18) подменяют адаптер; правила в `VisibilityPolicy` уже учитывают эти факты.
- `readWishlist` по `publicToken` пока без маршрута — подключить в Story 3.3 (`/l/:token`) и 3.4 (`/u/:nick`).
- Reservation card держателя (A-14, FR-25) — Epic 5; сейчас держатель видит обычную карточку с собой в `reservedBy`.

## Story 2.3 (CLE-51)

- Меню ⋯ на карточке (редактировать / видимость / удалить) — не сделано: удаление живёт на экране правки, видимость — на чипе; ⋯ придёт вместе с остальными действиями (Stories 2.5–2.7, 5.x).
- Удаление `RESERVED` (сильный confirm, уведомление держателю) — Story 5.4; сервер отвечает CONFLICT.
- Удаление `CLOSED` из секции «Получено» — Story 5.3; сервер отвечает CONFLICT.
- Выбор видимости и confirm удаления — диалог по центру на всех ширинах; шторка снизу на compact (DESIGN.md BottomSheet) — когда появится общий BottomSheet.
- Ветка основана на неслитой ветке Story 3.2 (CLE-48).

## Deferred from: Story 3.1 (CLE-46, 2026-11-04)

- Критерий «`/u/{старый ник}` → пользователь не найден» проверяется только на уровне данных: старого `nickNormalized` больше ни у кого нет. Маршрута профиля `/u/:nick` ещё нет — проверить в Story 3.4.
- Вход в «Настройки» временно в подвале «Мой вишлист»; постоянное место — Story 6.2.

## Deferred from: Story 1.9 (CLE-66, 2026-11-05)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: `packages/ui` не проверен на iOS (нет macOS и EAS) и на реальном Android-устройстве (только эмулятор, по чек-листу человека); TalkBack и VoiceOver не проверялись.
  evidence: AC Story 1.9 разрешает отложить iOS до появления macOS или EAS. Платформенные части (`layer.native.ts`, `focus.native.ts`, начертания шрифтов, анимации Sheet) проверены типами и unit-тестами с моком `BackHandler`; прогон на Android-эмуляторе делает человек по чек-листу спеки.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: Выбор видимости и confirm удаления по-прежнему диалог по центру на всех ширинах. `BottomSheet` в пакете есть, но шторка снизу на compact (DESIGN.md → BottomSheet) не подключена.
  evidence: 1.9 переводит экраны без изменения поведения. Переход на шторку меняет вид и раскладку, поэтому он остаётся за пунктом Story 2.3 выше.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: ~~Скрипт замера веса веб-сборки и базовое число (487 792 байт gzip на dc10567) не лежат в репозитории, а CI бюджет +150 КБ не охраняет.~~ Закрыто CLE-80 (2026-11-07): единица бюджета — КиБ, база 487 792 (`dc10567`). `scripts/measure-web-size.mjs` суммирует `zlib.gzipSync` без явного уровня по каждому `*.js` в `apps/web/public/_expo`. CI после сборки падает, если прирост больше бюджета. Сначала порог был 153 600 (150 КиБ). 2026-11-10 словарь Material Symbols из 4055 имён убран из веб-сборки (остались close, group, lock, public), и замер стал 644 272 байт, прирост 156 480 — на 2 880 больше 150 КиБ. Бюджет поднят до 163 840 (160 КиБ). В `epics.md` по-прежнему «150 КБ»: эпики правятся только через `bmad-correct-course`.
  evidence: Раньше замер шёл скриптом из scratchpad, число было только в спеке и в PR. Теперь скрипт в репозитории, а шаг `Check web JS gzip budget` в `.github/workflows/ci.yml` гоняет его после `npm run build`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: (не проверено, medium) `BottomSheet` может не вызвать `onClosed`, если анимация закрытия прервана, и тогда фокус не вернётся.
  evidence: Закрытие на вебе ловится через `onTransition`. Проверить в браузере, приходит ли событие с `finished=false` при повторном открытии во время анимации. Шторка в приложении пока не используется.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: (не проверено, medium) `layer.native.ts`: фокус диктора может уйти в слой раньше, чем смонтирован портал, а `onClosed` не вызывается при размонтировании открытого слоя.
  evidence: Проверить на Android с TalkBack: открыть ConfirmDialog и уйти с экрана, пока он открыт.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: `ChoiceList`/`Choice` не поддерживают клавиатурную модель `radiogroup` (стрелки, roving tabIndex): каждая строка — отдельная остановка Tab.
  evidence: Так было и в `ChoiceGroup` до Story 1.9. WAI-ARIA APG для radiogroup ждёт стрелок.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: Текст ошибки поля одновременно `role="alert"` и `aria-live="polite"`; `accessibilityHint` не доходит до диктора в вебе (нужен `aria-description`).
  evidence: Поведение перенесено без изменений из версии до Story 1.9.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: (не проверено, medium) Блок `components` frontmatter DESIGN.md не сверяется тестом с компонентами `packages/ui`; тест типографики не проверяет `fontFamily` и `letterSpacing`.
  evidence: Нужна построчная сверка блока `components` с `button.tsx`, `text-field.tsx`, `toast.tsx`, `visibility-chip.tsx` и др.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: (не проверено, low) В dev-логе Metro на Android предупреждения Tamagui: `zIndex="1"` и `borderRadius="4"` переданы не токенами; источник в коде пакета и экранов не найден.
  evidence: Видны при прогоне на эмуляторе 2026-11-05; вид не ломают. Найти источник (вероятно, внутренние стили компонента Tamagui) и проверить, есть ли они в релизной сборке.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`
  summary: (не проверено, low) На «Мой вишлист» в пустом состоянии два текста Lora («Gift List» в шапке и «Пока пусто»), а DESIGN.md требует один Lora на экран.
  evidence: Видно на эмуляторе 2026-11-05; не сверено, было ли так до Story 1.9.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-cooldown-toast-recovery.md`
  summary: (after Review, low) Сетевой сбой фонового перечитывания профиля заменяет готовый экран на `RetryView` и перекрывает toast только что показанного cooldown.
  evidence: `loadProfile` при неудаче ставит `state: error`; так же ведут себя существующие рефетчи после accept/reject. Для ветки 429 `INVITE_COOLDOWN` это стирает уже показанную паузу. Вне рамок фикса: смена поведения всех фоновых чтений.
- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-cooldown-toast-recovery.md`
  summary: (after Review, low) Общий `RATE_LIMITED` на экране профиля не передаёт `unit`/`count`, поэтому минутный лимит говорит «Попробуйте позже» вместо точного времени.
  evidence: `form-issue.ts` уже умеет `rateLimitValues`, а `relationshipAction` зовёт `common("errors.code.RATE_LIMITED")` без params. Осознанно не менялось: задача требовала сохранить прочие лимиты.

## Deferred from: W1b.2 — бренд WishMoon и контакт автора (2026-11-11)

- source_spec: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-10-wishmoon-brand.md` (§8)
  summary: Ссылка «Написать автору» на Next-страницах `/l`, `/i`, `/unsubscribe` не реализована. Требование `DESIGN.md:520` (в §8 proposal — `:504`, а также `:443,448,449` по нумерации того же документа) остаётся открытым: по решению координатора (план t301, решение 6) и §8 proposal ссылка в W1b не добавляется. Linear-задача не заводилась.
  evidence: В `apps/web/src/app/l/**`, `i/**` и `unsubscribe/**` футера со ссылкой нет, `AuthorLink` там не рендерится; в приложении ссылка уже есть (`apps/mobile/src/ui/site-footer.tsx`, `mailto:` на `AUTHOR_EMAIL`). Добавление ссылки на Next-страницы — отдельная задача.

## Deferred from: S23.1 — видимость забронированного желания (CLE-82, 2026-11-11)

- source_spec: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-11-reserved-visibility.md` (§1, §7)
  summary: Закрыто Story 6.1 (CLE-116): снятие при сужении видимости и правка значимых полей создают событие держателю в той же транзакции. Держателю доступен снимок названия брони.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

## Deferred from: ссылка сброса на loopback (2026-11-15)

- source_spec: `_bmad-output/implementation-artifacts/spec-fix-password-reset-loopback-http.md`
  summary: Документ деплоя и замороженная Story 1.7 по-прежнему говорят, что ссылка сброса всегда `https`.
  evidence: `docs/deployment-environments.md` пишет «Ссылка сброса всегда имеет вид `https://<хост из BETTER_AUTH_URL>/reset?token=…`». Замороженный блок `spec-1-7-сброс-пароля-по-email.md` требует `https://{origin}/reset?token=`, а его журнал ревью отклоняет сохранение локального `http`. Для прод, staging и preview код по-прежнему ставит `https`; расхождение только у loopback. Эти файлы вне разрешённого diff, замороженный блок Story 1.7 не меняется.

## Deferred from: t422u — код сначала в staging (2026-11-16)

- source_spec: `_bmad-output/implementation-artifacts/spec-t422u-staging-flow.md`
  summary: В «Порядок выкладки» нет процедуры на случай сбоя: staging-деплой сломан, миграция на staging ошибочна, плохой PR продвинут в прод или CI `check` красный на PR `staging → main`.
  evidence: Раздел описывает только успешный путь из четырёх шагов (`docs/deployment-environments.md`). Правила отката (revert-PR в `staging`, корректирующая миграция до продвижения, порядок при красном CI) требуют решения человека; в рамках t422u описаны не были.

- source_spec: `_bmad-output/implementation-artifacts/spec-t422u-staging-flow.md`
  summary: Не определено, что значит «проверка на staging»: нет чек-листа, критерия выхода и шага проверки мобильной staging-сборки.
  evidence: Шаг 2 в `docs/deployment-environments.md` называет только адрес; в сводной таблице есть `EXPO_PUBLIC_API_BASE_URL` для staging-сборки, но команды и критериев «проверено» нигде нет. Чек-лист — предмет отдельного решения, а не этой инфраструктурной правки.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-99-регистрация-по-приглашению-при-block.md`
  summary: В проде регистрация не видит Block нового аккаунта: строка Block ссылается на уже существующих пользователей и каскадно удаляется вместе с ними, а проверка идёт по id, созданному в этой же транзакции.
  evidence: `Block.blockerId` / `blockedId` — FK на `User` с `onDelete: Cascade` (`schema.prisma`). `acceptInviteLinkInTransaction` вызывает `hasBlockBetween(newUserId, ownerId)` до коммита. Чужая транзакция не может вставить Block на ещё не закоммиченный id. Поэтому описанный в CLE-99 экран «Приглашение не найдено» сразу после регистрации по блоку в текущей схеме недостижим: дружба создаётся. Вход уже существующим аккаунтом по той же ссылке по решению CLE-99 оставлен на экране приглашения. Нужно подтверждение, считается ли это отдельной дырой (новый аккаунт обходит блок) или ожидаемым следствием «блок только между аккаунтами».

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-99-регистрация-по-приглашению-при-block.md`
  summary: EXPERIENCE Flow 15 и тексты историй по-прежнему говорят, что после блока или невалидного токена человек видит «Приглашение не найдено», а успешная регистрация по `/i` возвращает на приглашение.
  evidence: Решение CLE-99 меняет только послерегистрационный `next`, когда токен был в теле и дружба не создана. `EXPERIENCE.md` Flow 15 и Story 4.7 в `epics.md` правятся через `bmad-correct-course`, не в этом фиксе. Повторное открытие ссылки и вход существующим аккаунтом текст «Приглашение не найдено.» сохраняют.

## Deferred from: контакт автора support@ (2026-11-18)

- source_spec: `_bmad-output/implementation-artifacts/spec-support-email-author-contact.md`
  summary: Нет истории и маршрута для веб-страницы, где можно запросить удаление аккаунта без приложения (Google Play, Data safety): D-48 и п. 6 чеклиста требуют раздел политики с `privacy@wishmoon.clever-agency.dev`, но страницы политики нет ни в эпиках, ни в списке путей Next в AD-26.
  evidence: Путь не входит в `/api`, `/l`, `/i`, `/unsubscribe`, `/admin`, `/.well-known` (AD-26), поэтому без решения его отдаст SPA-fallback с рендером только на клиенте. Нужен `bmad-correct-course` вместе с пунктом 4 чеклиста (политика конфиденциальности) до публикации в Google Play.
- source_spec: `_bmad-output/implementation-artifacts/spec-support-email-author-contact.md`
  summary: Письма уходят с `noreply@` без `Reply-To`, поэтому ответ пользователя на письмо теряется; стоит ставить `Reply-To: AUTHOR_EMAIL` (`support@`) или явно решить, что ответы не поддерживаются.
  evidence: D-48 и `docs/deployment-environments.md` фиксируют отправителя `noreply@` и что ответы на него не читаются; ни один документ не требует `Reply-To`. Поведение было и до смены контакта.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-92-zapret-tekushchego-parolya.md`
  summary: На сыром `/api/auth/change-password` проверка HIBP выполняется до сверки текущего пароля, поэтому вошедший без знания текущего пароля может отличить утёкший новый пароль (`PASSWORD_COMPROMISED`) от неверного текущего.
  evidence: Порядок Better Auth 1.7.14 и хука CLE-90: `hash` (а в нём HIBP) вызывается раньше `password.verify` текущего пароля. CLE-92 эту проверку не переставлял: отказ `PASSWORD_REUSED` звучит только после верного `currentPassword`, но HIBP по-прежнему раньше. Чинить отдельно, не смешивая с запретом текущего пароля.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-76-dolgi-2-6.md`
  summary: Карточки секции «Архив» не открывают диалог подробностей CLE-84, хотя активные открывают.
  evidence: `ArchiveSection` не передаёт `onPress`. Остальное из ревью переноса (шаги выкладки, долги кода, stories `WishCard` с `menu` и `DateField`) закрыто в `spec-cle-76-dolgi-2-6.md`.

## Deferred from: Story 5.2 — снятие брони держателем и владельцем (CLE-114, 2026-11-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-снятие-брони-держателем-и-владельцем.md`
  summary: Закрыто Story 6.1 (CLE-116): снятие держателем создаёт in-app уведомление владельцу по FR-26.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-2-снятие-брони-держателем-и-владельцем.md`
  summary: Закрыто Story 6.1 (CLE-116): снятие владельцем создаёт уведомление и письмо держателю.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

## Deferred from: Story 5.3 — закрытие желания владельцем, отмена и «Хочу ещё такой» (CLE-115, 2026-11-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-закрытие-желания-владельцем-отмена-и-хочу-ещё-такой.md`
  summary: Закрыто Story 6.1 (CLE-116): закрытие создаёт уведомление и письмо держателю через 10 минут. Успешная отмена удаляет запись в той же транзакции. Ответ на вручение остаётся в Story 5.7.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-закрытие-желания-владельцем-отмена-и-хочу-ещё-такой.md`
  summary: Аудит NFR-6 покрывает только закрытие и отмену (плюс снятие брони из 5.2). Бронь, снятие своей брони держателем и уход в архив по сроку статус меняют, но audit-строку `gift.status` не пишут. Нужна отдельная задача после 5.3 — расширить шов `recordGiftEvent` на `reserveGift`, `releaseReservation` и архивацию, не смешивая её с текущими историями.
  evidence: `recordGiftEvent` вызывают только CAS закрытия и отмены в `gift-status-store.ts`; в `schema.prisma` под это нет таблицы (NFR-6 — logging, ARCHITECTURE-SPINE → Consistency Conventions), поэтому аудит остальных переходов — та же строка `console.info`, а не миграция.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-закрытие-желания-владельцем-отмена-и-хочу-ещё-такой.md`
  summary: Секция «Уже подарено» на серверной странице `/l` осталась открытым вопросом: страница сейчас рисует закрытые желания в общей сетке, а Story 5.3 меняет только приложение. Если решение будет «перенести секцию и туда», это отдельная правка `apps/web/src/app/l/[token]/public-wishlist-view.tsx` со своим порядком секций (активные, «Уже подарено», «Архив»).
  evidence: Спека 5.3, «Открытые вопросы» п. 1 и «Never» — страницу не трогаем до решения; в приложении секция закрытых собирается на клиенте из `gifts`, на `/l` такой разметки нет.

## Deferred from: CLE-86 — проверка обновления приложения (2026-11-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-86-obnovlenie-prilozheniya.md`
  summary: Play In-App Updates на Android не подключён: нужен новый пакет (`react-native-in-app-updates` или аналог), а в ночном заходе пакеты не ставятся. Пока Android открывает ссылку магазина через `Linking.openURL`, как iOS, — системного диалога обновления из Play нет.
  evidence: Мягкое предложение (`apps/mobile/src/ui/app-update-soft-dialog.tsx`) и блокирующий экран (`app-update-block-screen.tsx`) открывают только `storeUrl` из ответа `GET /api/v1/app-version`; в `apps/mobile/package.json` нет пакета обновлений, а спека прямо относит Play In-App Updates к «Never» этой задачи.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-86-obnovlenie-prilozheniya.md`
  summary: Реальные значения политики и URL магазинов не заполнены: магазины не опубликованы, поэтому `APP_VERSION_POLICY` в `packages/contracts/src/app-version.ts` держит `latestVersion = minSupportedVersion = "0.1.0"` и `storeUrl = null` для обеих платформ. Никому ничего не показывается, и блокирующий экран до публикации — тупик без кнопки (`bodyNoStore`). Поднимать `latest`/`min` и вписывать ссылки — после публикации сборок (владелец — Евгений/Сергей), тогда же адреса появятся в ответе сервера без пересборки приложения.
  evidence: Спека, «Отложено» п. 2 и «Открытые вопросы» п. 1–3; значение по умолчанию закреплено в контракте (`DEFAULT_APP_VERSION`), а клиент политику локально не читает — только из ответа `GET /api/v1/app-version`.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-86-obnovlenie-prilozheniya.md`
  summary: Тексты «Доступно обновление» / «Обновите приложение» и переводы на другие языки ждут UX и локалей. Сейчас ключи `app.appVersion.*` лежат только в `packages/contracts/src/i18n/ru/app.json` (AD-27), переводы появятся вместе с первой не-русской локалью.
  evidence: Спека, «Тексты (ru)» и «Отложено» п. 3: строк в `DESIGN.md`/`EXPERIENCE.md` нет, это новые тексты без утверждения в UX («Доступно обновление», «Вышла новая версия приложения. Обновите его, когда будет удобно.», «Обновить», «Закрыть», «Обновите приложение», «Эта версия больше не поддерживается. Обновите приложение в магазине, чтобы продолжить.», «…в магазине.», «Открыть магазин»).

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-86-obnovlenie-prilozheniya.md`
  summary: `expo-updates`/OTA, принудительное обновление без магазина, откат версии и телеметрия отказов не делаются — вне CLE-86. Обход fail open тоже остаётся открытым вопросом: человек ниже `minSupportedVersion` с выключенной сетью видит обычное приложение, потому что неудачная проверка ничего не меняет и показанный блок не снимает; «последний известный ответ» в хранилище не вводился.
  evidence: Спека, «Отложено» п. 4 и «Открытые вопросы» п. 1; `apps/mobile/src/app-version/check.ts` (`resolveAppVersion` возвращает прежнее состояние на `ok: false`), `app-version-gate.native.tsx` не ждёт сеть на старте, `expo-updates` в зависимостях нет.

## Deferred from: Story 5.5 — «Мои брони»: продление, «Купил», видимость (CLE-119, 2026-11-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: Закрыто Story 6.1 (CLE-116): после смены фазы или экземпляра брони уведомление показывает «Даритель уже ответил» без действий.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: Уведомления об изменении «Купил» и переключателей видимости не отправляются: FR-26 их не перечисляет. Если продукт захочет, это Epic 6 и отдельное решение, а не 5.5.
  evidence: Спека, «Never» и «Отложено» п. 2; действия `bought` и `visibility` меняют только колонки `reservationBought` и `holderVisibleTo*`, статус не меняется, `recordGiftEvent` не вызывается.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: «Подарил», переход в `GIVEN`, подтверждение получения владельцем и ответы на запрос (`Получил` / `Не получал`) — Story 5.7. В 5.5 фазы `AWAITING_*` и `GIVEN` только отображаются: подписи есть, «Подарил» нигде нет, продление в `GIVEN` спрятано и сервер отвечает `CONFLICT`.
  evidence: Спека, «Отложено» п. 3 и «Открытые вопросы» п. 2; карточка и деталь не рендерят «Подарил», `reservationActionBodySchema` содержит только `extend`, `bought`, `visibility`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: Cron `reservation-timers`, расчёт `AWAITING_GIVER`/`AWAITING_OWNER` по сроку и автоматическое снятие брони — Story 5.6. 5.5 только показывает фазы, которые уже возможны в данных, и не заводит таймеров.
  evidence: Спека, «Отложено» п. 4; маршрутов `app/api/cron/*` для брони нет, фазы приходят из `reservationPhase`, записываемой только действиями держателя.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: Вкладка «Брони» и полная навигация — Story 6.2; до неё вход в «Мои брони» — временная строка в нижнем ряду «Моего вишлиста». После 6.2 строку убрать, экран станет вкладкой.
  evidence: Спека, «Открытые вопросы» п. 8; `apps/mobile/app/(app)/index.tsx` содержит строку с комментарием «временный вход до Story 6.2», `spa-paths.ts` и навигация не менялись.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: Деталь желания после unfriend/Block по A-14 не открывается: `getViewerGift` не знает A-14 и отвечает `NOT_FOUND`. Если продукт захочет открывать reservation card отдельным экраном — это вне 5.5; сейчас карточка «Моих броней» самодостаточна (`canOpenGift = false` убирает ссылку, действия остаются).
  evidence: `canOpenGift` считает сервер через `VisibilityPolicy.canSee` без токена ссылки; экран `/gifts/{id}` ссылку не получает, управление живёт в `/reservations`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-5-moi-broni.md`
  summary: Audit NFR-6 для фаз и атрибутов брони (продление, «Купил», переключатели) не пишется: статус `Gift.status` при этих действиях не меняется, а `recordGiftEvent` фиксирует только смену статуса. Если Epic 6 или аудит потребует, отдельная задача; факт продления пока читается из `reservationPhase`/`reservationPhaseAt`.
  evidence: Спека, «Отложено» п. 7 и «Always» про NFR-6; `recordGiftEvent` в `apps/web/src/lib/gift-status-store.ts` вызывают только CAS закрытия/отмены, три новых CAS `extend`/`bought`/`visibility` audit-строк не добавляют.

## Deferred from: Story 5.4 — удаление и правка забронированного желания (CLE-118, 2026-11-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-udalenie-i-pravka-broni.md`
  summary: Закрыто Story 6.1 (CLE-116): уведомление и письмо держателю сохраняются вместе с удалением.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-udalenie-i-pravka-broni.md`
  summary: Закрыто Story 6.1 (CLE-116): уведомление и письмо держателю сохраняются вместе с правкой. В payload хранятся имена изменённых полей.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-udalenie-i-pravka-broni.md`
  summary: Ветка `GIVEN` («Подарил» и основное действие «Отметить полученным», удаление — вторично) в предпросмотре и confirm удаления не реализована: до Story 5.7 строк с этой фазой нет, `GET /me/gifts/:id/reservation` отдаёт только `BOUGHT | null`, а тексты и порядок действий появятся вместе с 5.7.
  evidence: Спека, «Отложено» п. 3 и «Never» про 5.7; `giftReservationWarningSchema` допускает `GIVEN`, но сервер до 5.7 его не возвращает, клиент различает только `BOUGHT`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-udalenie-i-pravka-broni.md`
  summary: Пункта «Удалить» в ⋯-меню активной карточки и удаления из детали желания нет: удаление живёт только в форме правки, как и у `OPEN`. Меню ⋯ для активных карточек — существующий долг R1 (решение 5.4, «Открытые вопросы» п. 3), а не часть этой истории.
  evidence: Спека, «Never» и «Отложено» п. 5; `wish-detail-dialog.tsx` и ⋯-меню активной карточки не менялись, `apps/mobile/app/(app)/gifts/[id]/edit.tsx` — единственный вход в удаление забронированного желания.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-4-udalenie-i-pravka-broni.md`
  summary: Публикация подсказки о брони и предупреждений об удалении на серверной странице `/l` не делается: владелец там ничего не правит и не удаляет, страница только читает публичный список. Если появится редактирование по ссылке — отдельная задача.
  evidence: Спека, «Отложено» п. 6; `apps/mobile/app/(app)/index.tsx`/`edit.tsx` несут подсказку и confirm, `/l` рендерится сервером из `apps/web`.

## Deferred from: Story 5.6 — цикл истечения Срока брони, клиент владельца (CLE-121, 2026-11-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-6-tsikl-istecheniya-broni.md`
  summary: Полоса `CONFIRM_GIVEN` («Ждёт вашего подтверждения» → «Получил» / «Не получал») не делается: в 5.6 `OwnerActionLabel` рисует только `EXPIRED_NO_REPLY`, а карточка и деталь с `CONFIRM_GIVEN` остаются как в Story 5.5. Ответ владельца на «Подарил», переход в `GIVEN` и его тексты — Story 5.7.
  evidence: Спека, «Never» и «Open Questions» п. 7; `apps/mobile/src/ui/owner-action-label.tsx` принимает только `action: "EXPIRED_NO_REPLY"`, `gift-card.tsx` при `CONFIRM_GIVEN` рисует прежнюю строку брони, `wish-detail-dialog.tsx` не фильтрует факт `ownerAction` в этой фазе.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-6-tsikl-istecheniya-broni.md`
  summary: После keep нет тоста и владелец не видит новый Срок брони: сервер по AD-7 не отдаёт владельцу `dueAt`/`phase`/`bought`, а каталог не содержит текста подтверждения. Строка брони просто становится «Забронирован», полоса исчезает. Если UX захочет подтверждение или дату «до DD.MM», это новая строка каталога и отдельное решение (Open Questions п. 4–5).
  evidence: Спека, «Keep» и «Open Questions» п. 4–5; `apps/mobile/src/api/my-gifts.ts` (`keepReservation` разбирает owner card), `app/(app)/index.tsx` заменяет карточку ответом без тоста, `packages/contracts/src/i18n/ru/app.json` новых строк, кроме двух ответов, не получил.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-6-tsikl-istecheniya-broni.md`
  summary: Закрыто Story 6.1 (CLE-116): уведомления и письма по фазам таймера, включая автоснятие обоим участникам. Продление владельцем создаёт уведомление только держателю в приложении.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

## Deferred from: Story 5.8 — обязательные автотесты инвариантов AD-15 (CLE-122, 2026-11-22)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-8-avtotesty-invariantov-ad15.md`
  summary: Закрыто Story 6.1 (CLE-116): тесты проверяют отсутствие имени скрытого держателя, отметки «Купил» и срока в ленте и письме владельцу.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-8-avtotesty-invariantov-ad15.md`
  summary: Инвариант (10) проверен только для `FRIENDS`/`PUBLIC`: подписчик не получает `FRIENDS`, но даты (`UserDate`) и поведение `visibility=everyone` (AD-23) не проверяются — дат в схеме нет, а сужение правила до «при `friends` подписчик не получает даты» (ревью архитектуры L4) требует решения Евгения и Сергея. После Epic 7 тест на даты добавить в suite или в AC истории.
  evidence: Спека, «Отложено» п. 2 и «Открытый вопрос» 2; `subscriber.test.ts` проверяет `readWishlist` с `subscriber=true`, но `UserDate` в `schema.prisma` отсутствует.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-8-avtotesty-invariantov-ad15.md`
  summary: Инвариант (12) «сопоставление телефонов не пишет сырые номера» непроверяем: нет полей `phoneE164`/`phoneHmac`, модели `ContactMatch` и экрана «Найти знакомых», а `relationships.ts` до 8.1 честно отвечает `contactMatch: false`. Тест «сырые номера не попадают ни в БД, ни в лог» появляется вместе со Story 8.1.
  evidence: Спека, «Отложено» п. 3 и «Открытый вопрос» 4; `schema.prisma` не содержит телефонных полей и `ContactMatch`.

- source_spec: `_bmad-output/implementation-artifacts/spec-5-8-avtotesty-invariantov-ad15.md`
  summary: Настоящая гонка двух транзакций (инварианты 1, 7, 9) в CI не проверяется: `ci.yml` гоняет только `npm test`, а `verify:reserve-concurrency`, `verify:disposable-pg` и `verify:friendship-concurrency` требуют одноразового PostgreSQL. Консервативно ручной `npm run verify:reserve-concurrency` остаётся шагом перед merge Epic 5; добавление сервиса PostgreSQL в workflow — отдельное решение. 2026-11-22 (CLE-87): ручной прогон на одноразовом PostgreSQL 18.7 (Docker, UTF8, 127.0.0.1): `verify:disposable-pg` 18/18, `verify:reserve-concurrency` 2/2, `verify:friendship-concurrency` 5/5; доказательства — `opencode-microtasks/fixup-F5-evidence-2026-11-22T005936.md`, `opencode-microtasks/4.1.1-R1-pg-evidence-2026-11-22T005946.md`. Подключение PostgreSQL к CI по-прежнему отдельное решение.
  evidence: Спека, «Отложено» п. 4 и «Открытый вопрос» 1; `db/disposable-pg/*.pgtest.ts` вне `vitest.config.ts`, `.github/workflows/ci.yml` без сервиса PostgreSQL; `timer-races.test.ts` проверяет сценарий на фейке.

## Deferred from: Story 6.2 — навигация приложения: вкладки, боковое меню, «назад» и ссылки (CLE-117, 2026-11-22)

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Закрыто Story 6.1 (CLE-116): маршрут /notifications, колокольчик с бейджем и пункт бокового меню добавлены.
  evidence: `_bmad-output/implementation-artifacts/spec-6-1-uvedomleniya.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: «Подборки» в «Профиле» и маршрут `/collections` не делаются — Story 10.1.
  evidence: Спека, «Открытый вопрос» 2 и «Отложено» п. 2; `apps/mobile/src/ui/profile-menu.tsx` содержит только «Мой профиль», «Настройки», «Написать автору» и «Выйти».

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: «Недавние вишлисты» в боковом меню не появляются: история просмотренных вишлистов нигде не хранится, источника данных нет ни в одном документе. Пункт вернётся вместе с данными/Story 6.5.
  evidence: Спека, «Открытый вопрос» 5 и «Отложено» п. 3; `SidebarNav` строится из `TAB_ITEMS` и карточки пользователя, отдельного списка нет.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Полный user-menu бокового меню (email, профиль, настройки, автор, выход в popover) не делается — Story 6.3. Сейчас карточка пользователя (Avatar, имя, `@ник`) — простая ссылка на вкладку «Профиль», где те же действия стоят строками.
  evidence: Спека, «Открытый вопрос» 4 и «Отложено» п. 4; `apps/mobile/src/navigation/sidebar-nav.tsx` передаёт карточку как ссылку `/profile`, `OverflowMenu` на desktop не используется.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Правая колонка `wide` с подсказкой установки не делается — Story 6.5 (UX-DR11). `AppShell` от 1024 px показывает боковое меню и растягивает контент, третьей колонки нет.
  evidence: Спека, «Never» и «Отложено» п. 5; `packages/ui/src/app-shell.tsx` переключает только `media.expanded` (меню/вкладки), `media.wide` не используется.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Per-tab stacks и видимая подсветка вкладки на вложенных экранах (настройки, чужой профиль, деталь) не делаются: вложенные экраны живут в общем `Stack` поверх вкладок, панель там скрыта. Это открытый вопрос, а не AC 6.2.
  evidence: Спека, «Открытый вопрос» 3 и «Отложено» п. 6; `apps/mobile/app/(app)/_layout.tsx` — один `Stack`, `settings`, `gifts/*` и `u/:nick` не входят в `(tabs)`.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: «Залитых» (filled) иконок активной вкладки нет: в наборе только stroke-глифы, активность несут полоса 3 px, вес 600 и цвет `primary`. Filled-варианты — отдельная история иконок, если UX настоит.
  evidence: Спека, «Открытый вопрос» 7; `packages/ui/src/icons/Heart.tsx` и соседи — один stroke-глиф, `NavItem` не меняет иконку при `selected`.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Push, периодический опрос и real-time badge/уведомлений не делаются: число запросов читается один раз при появлении оболочки и повторно после собственных действий и `refresh()` из «Друзей». Число от других пользователей обновится при следующем запуске — Story 6.1.
  evidence: Спека, «Открытый вопрос» 6 и «Отложено» п. 8; `apps/mobile/src/navigation/invite-badge.tsx` без polling/`AppState`/push.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Двухпанельные «Друзья» на `wide` (`FriendsTwoPane`) не делаются: нет запроса вишлиста выбранного друга. Появится вместе с этими данными.
  evidence: Спека, «Отложено» п. 9; `apps/mobile/app/(app)/(tabs)/friends.tsx` и `friends-screen.tsx` рисуют один список с сегментами на всех ширинах.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Настоящая проверка App Links/Universal Links в сторах не делается: отпечатки `ANDROID_SHA256_CERT_FINGERPRINTS`, `APPLE_TEAM_ID`, публикация и ассоциации на устройстве — CLE-108/CLE-85 и выкладка. Story 6.2 добавляет только маршруты-двойники `app/l/[token].tsx` и `app/i/[token].tsx`; `.well-known` и `app.config.ts` уже были настроены и не менялись.
  evidence: Спека, «Отложено» п. 10; `apps/mobile/app/l/[token].tsx` и `app/i/[token].tsx` — re-export существующих экранов, `app.config.ts` и `apps/web/.well-known` вне diff.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Стрелка «Назад» в шапке и общая шапка приложения не делаются — Story 6.3/6.4. Вложенные экраны по-прежнему показывают текстовое «Назад», корни вкладок его не показывают.
  evidence: Спека, «Открытый вопрос» 12 и «Отложено» п. 11; `AppHeader` не заведён, `(app)/gifts/*` и `(app)/settings.tsx` используют прежние заголовки `Stack.Screen`.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Отдельный `countOnly`-маршрут счётчика входящих запросов не заводится: badge переиспользует `fetchInvites`, который тянет обе страницы запросов (по 15). Оптимизация — после Story 6.1, если станет заметна цена запроса при старте оболочки.
  evidence: Спека, «Открытый вопрос» 6 и «Отложено» п. 12; `GET /api/v1/me/invites` отдаёт `incomingCount` вместе со страницами, `fetchInvites` читает их целиком, серверных изменений 6.2 нет.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Сквозной прогон нативных вкладок, системного «назад» и App Links на устройстве не делался: в CI только unit-тесты, `typecheck` и `lint`, а эмулятор/dev-сборка в ночном заходе не запускались. Проверку на Android/iOS делает человек; при находках — Story 6.4 или отдельная задача.
  evidence: Спека, «Отложено» п. 13 и «Manual checks»; `apps/mobile/src/navigation/app-link-routes.test.tsx` проверяет тождество экранов и чтение `token`, нативные переходы и ассоциации — только вручную.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Тост на экране вкладки поднимается ровно на 56 px (высота панели из контекста `AppShell`), без нижнего safe area панели. На iPhone с home indicator тост может заходить на её отступ (~34 px). Поднимать ли на `insets.bottom` — решение UX/координатора, меняет `AppShell` волны A.
  evidence: Отчёт волны D (`T10-report.md`, «Риски» и «Открытые вопросы» 1); `apps/mobile/src/ui/toast.tsx` прибавляет `useTabBarInset()` (56 или 0) к `offsetBottom`, `packages/ui/src/app-shell.tsx` публикует `spacing["tab-bar"]` без safe area.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Badge «Друзья» после блокировки человека с входящим запросом может остаться завышенным до следующего действия или запуска: `refresh()` вызывается только после принять/отклонить/отменить, как в спеке. Решить, нужен ли пересчёт после блокировки.
  evidence: Отчёт волны D (`T10-report.md`, «Риски» и «Открытые вопросы» 2); `apps/mobile/app/(app)/(tabs)/friends.tsx` зовёт `useInviteBadgeOptional().refresh()` только в обработчиках ответов на запрос.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: `document.title` у экранов вкладок не проверен в браузере: `Stack.Screen options={{ title }}` внутри `Tabs` может не обновлять заголовок. Это открытый вопрос 11 спеки и долг 6.4, а не AC 6.2.
  evidence: Отчёт волны D (`T10-report.md`, «Риски»); экраны вкладок по-прежнему задают заголовок через `Stack.Screen`, а ближайший навигатор внутри `(tabs)` — `Tabs`, не `Stack`.

- source_spec: `_bmad-output/implementation-artifacts/spec-6-2-navigatsiya-prilozheniya.md`
  summary: Прежние ключи каталога `app.myWishlist.logout`, `app.myWishlist.search`, `app.myWishlist.friends`, `app.myWishlist.settings` больше не используются экраном «Мой вишлист» (строки и «Выйти» ушли в «Профиль»), но остаются в `app.json`. Удалять их или оставить ради совместимости — решение координатора/волны A; 6.2 каталог не трогает.
  evidence: Отчёт волны D (`T10-report.md`, «Новые тексты интерфейса»); `apps/mobile/app/(app)/(tabs)/index.tsx` больше не ссылается на эти ключи, `packages/contracts/src/i18n/ru/app.json` вне diff подзадач E/F.

## Deferred from: CLE-124 — подарок всегда сюрприз (2026-11-25)

- source_spec: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-25-surprise.md` (§1, §4)
  summary: Закрыто/отменено решением D-49. Владельческие уведомления `RESERVATION_CREATED`, `RESERVATION_RELEASED` (owner), `RESERVATION_OWNER_ASK`, `RESERVATION_AUTO_RELEASE` (owner) не создаются; `GIFT_GIVEN` с вопросом «Подарок у вас?» владельцу не создаётся. Прежние долги Story 5.2, 5.4, 5.5, 5.6, 5.8 про владельческие уведомления и действия с бронью закрыты/отменены; `deferred-work.md` не дублирует их новыми.
  evidence: PR #120 (S4a) уже выключил создание; старые строки прячутся при чтении, миграции и чистки БД нет. Нормативная запись — PRD D-49, AD-7, AD-14, Story 5.2/5.6/5.7.

- source_spec: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-25-surprise.md` (§1, §4)
  summary: Закрыто уточнением 2026-11-25 (вечер, S9b-docs): старые брони в фазе `GIVEN` обрабатываются таймером как новые — через 168 ч после Срока бронь снимается, фаза от снятия не защищает. Отдельного решения «показывать как „Срок истёк“ / снимать / оставить» больше не нужно: снимает тот же cron. Новых полей и миграции нет; старые владельческие уведомления только скрываются при чтении.
  evidence: `ARCHITECTURE-SPINE.md` AD-9 (переход cron `RESERVED→OPEN` в любой фазе, включая `GIVEN`); `gift-status-store.ts` и `reservationPhase` в схеме остаются; данные staging содержат старые фазы.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-132-viewer-change.md`
  summary: Проверить конкурентную запись и очистку токена в SecureStore на телефоне.
  evidence: CLE-132 сверяет сессию по действующей cookie при пересечении входа и выхода в разных вкладках. В нативном хранилище запись токена при входе и ранее начатое асинхронное удаление при выходе требуют отдельной проверки на устройстве.

- source_spec: `_bmad-output/implementation-artifacts/spec-cle-132-viewer-change.md`
  summary: Проверить смену зрителя на отдельной странице желания с открытым диалогом брони.
  evidence: В `/gifts/[id]` эффект во время загрузки сессии пропускает чтение, а карточка и состояние диалогов хранятся отдельно от вишлиста. Проверить, что между сменой сессии и новым ответом карточка прежнего пользователя исчезает и диалог закрывается.
