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
  summary: Тест `apps/web/src/lib/auth.test.ts` «exposes handler to toNextJsHandler's `in` check» падает по таймауту 5000 мс на холодном импорте `auth.ts` при параллельном `npm test` на Windows.
  evidence: прогон CLE-42 — импорт 9.5 с, повторные прогоны зелёные; поднять таймаут теста или `testTimeout`. Low/flaky.

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
- Удаление `CLOSED` из секции «Получено» — Story 2.6; сервер отвечает CONFLICT.
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
  summary: Скрипт замера веса веб-сборки и базовое число (487 792 байт gzip на dc10567) не лежат в репозитории, а CI бюджет +150 КБ не охраняет.
  evidence: Замер шёл скриптом из scratchpad сессии, число записано только в спеке и в PR. Запас до бюджета около 15 КБ, поэтому следующие истории (3.3, 2.4–2.7) могут незаметно его превысить.
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
