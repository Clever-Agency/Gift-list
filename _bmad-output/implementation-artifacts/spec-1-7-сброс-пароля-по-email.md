---
title: '1.7 Сброс пароля по email'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '104df88a8213ae536a1d7aa4450520114e41b749'
context:
  - '{project-root}/apps/web/AGENTS.md'
  - '{project-root}/.cursor/rules/ux-design.mdc'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** «Забыли пароль» на входе ведёт на заглушку. Нет письма, одноразовой ссылки и экрана нового пароля (FR-3, Story 1.7, CLE-40).

**Approach:** `POST /api/v1/password/forgot` для любого синтаксически верного email отвечает одинаково и для существующего аккаунта шлёт через Resend одноразовую `https`-ссылку на `/reset?token=`. `POST /api/v1/password/reset` задаёт пароль и гасит ссылку. Тот же URL открывает экран в установленном приложении или в браузере.

## Boundaries & Constraints

**Always:**
- Конверт AD-12. `message` — английская диагностика. Клиент показывает `errors.reason.RESET_LINK_STALE` («Ссылка устарела. Запросите новую.») и ссылку «Отправить ещё раз», иначе текст по `code`. `message` не показывать.
- Ответ forgot одинаковый для существующего и неизвестного email: `{ ok: true, data: { accepted: true } }`. Тело Better Auth и факт отправки наружу не отдавать. Ошибка Resend логируется и не меняет этот ответ.
- Невалидный email — `VALIDATION`, `field: email`. Лимит как у регистрации: 5 попыток в час на IP, `RATE_LIMITED`, тоже без различия email.
- Ссылка — `https://{origin}/reset?token=`, origin из `BETTER_AUTH_URL` (хост разработки, C-4). Не ссылка на `/api/auth/reset-password`. Срок 1 час. После успешного сохранения токен не действует; повтор — `VALIDATION` + `reason: RESET_LINK_STALE`. Пропущенный токен — то же.
- Пароль 8–128, как при регистрации. Сессию сброс не создаёт. Чужие сессии этого пользователя отзываются.
- Письмо из каталога `email` на `User.locale`, `{brand}` из `getBrandName()`. Клиент зовёт только `/api/v1`. `disableSignUp` и порядок плагинов Better Auth не менять.
- App Links / Universal Links: `/.well-known` объявляет `/reset` вместе с `/l/*`, `/i/*`, `/wishlist/*`. Отпечаток Android и Apple Team ID — только из env, пустые значения не подставлять выдумкой.

**Never:**
- Секреты, реальный ключ Resend, `.env`. Подтверждение email, OAuth, SMS. Автовход после сброса. Правки PRD, эпиков и спайна. Импорт `apps/web` из `apps/mobile`. Общий UI-пакет. Новая миграция: таблица `Verification` уже есть.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| forgot-blind | любой синтаксически верный email, аккаунт есть или нет | один и тот же 200 `{ accepted: true }` | письмо только если аккаунт есть |
| forgot-invalid | email не по схеме | 400 `VALIDATION`, `field: email` | N/A |
| forgot-limit | 6-й запрос с того же IP за час | 429 `RATE_LIMITED`, тело не зависит от email | письмо не шлётся |
| reset-ok | живой токен, пароль 8–128 | 200, пароль заменён, токен потрачен, сессии пользователя отозваны, новой сессии нет | N/A |
| reset-stale | токен просрочен, использован или пуст | 400 `RESET_LINK_STALE` | N/A |
| reset-short | живой токен, пароль короче 8 | 400 `VALIDATION`, `field: password`, токен жив | N/A |
| link-shape | аккаунт есть | href письма = origin + `/reset?token=` + токен, `https` | не `/api/auth/...` |

</frozen-after-approval>

## Code Map

- `apps/web/src/lib/auth.ts` — `emailAndPassword` без `sendResetPassword` (стр. 19–24). Добавить отправку, `resetPasswordTokenExpiresIn: 3600`, `revokeSessionsOnPasswordReset: true`. `url` Better Auth ведёт на `/api/auth/reset-password/:token`; в письме использовать свой `https`-адрес с `token`. `prismaAdapter` — включить транзакцию адаптера, если тип 1.7.14 это принимает. Плагины и `disableSignUp` не трогать. Тест `auth.test.ts` поднимает `getEnv()` — новые переменные задать там же.
- `apps/web/src/lib/env.ts` — схема без Resend. Добавить `RESEND_API_KEY`, `EMAIL_FROM` (адрес или `Имя <addr>`), необязательные `APPLE_TEAM_ID` и `ANDROID_SHA256_CERT_FINGERPRINTS` (через запятую). Образец — `.env.example`, без живых значений. `env.test.ts` дополнить.
- `apps/web/src/lib/rate-limit.ts` — `REGISTER_LIMIT` и `clientIp(headers)`. Ключ `password-forgot:${ip}`. Лимит сброса пароля не нужен: токен Better Auth — `generateId(24)`.
- `apps/web/src/actions/sign-in.ts` — образец use-case без `"use server"`: одинаковый отказ, тело провайдера не наружу. Новый `actions/password-reset.ts`: `requestPasswordReset` → `auth.api.requestPasswordReset({ body: { email, redirectTo } })`; `resetPassword` → `auth.api.resetPassword({ body: { newPassword, token } })`.
- `apps/web/src/app/api/v1/session/route.ts` + `lib/api-v1.ts` — образец `parseJsonBody` / `toResponse`. Новые `password/forgot/route.ts` и `password/reset/route.ts`.
- `packages/contracts/src/auth.ts` — рядом с `loginBodySchema` добавить `passwordForgotBodySchema` (`email`) и `passwordResetBodySchema` (`token`, `password` 8–128). Реэкспорт из `index.ts`. `ERROR_REASONS` — `RESET_LINK_STALE`.
- `packages/contracts/src/i18n/ru/common.json` — `errors.reason`. `email.json` — только `writeToAuthor`. `app.json` `forgot` — заголовок и «Войти»; формы нет. `i18n.test.ts` сам проверит покрытие reason.
- `apps/mobile/app/(auth)/forgot.tsx` — заглушка. `login.tsx` уже ведёт сюда с `email` и `next`. Экран `/reset` — новый `reset.tsx`. Поля: `TextField`, `PasswordField` (`new-password` / `newPassword`), `PrimaryButton`, `AnonymousScreen`. Ошибки — `form-issue.ts` (сейчас экраны только `login` | `register`).
- `apps/mobile/app.config.ts` — scheme `giftlist`, нет associated domains. Хост брать из `EXPO_PUBLIC_API_BASE_URL`; если пусто — фильтры не добавлять. `src/config/env.ts`.
- `apps/web/src/lib/spa-paths.ts` — `/.well-known` уже у Next. `/forgot` и `/reset` остаются SPA; дописать кейс в `spa-paths.test.ts`.
- Стек: `resend` 6.31.0 (спайн), `next-intl` `createTranslator` для письма. `User.locale` уже пишется при регистрации.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts` — схемы, `RESET_LINK_STALE`, каталоги `common` / `app` / `email`, тесты схем
- [x] `apps/web` env, Resend, письмо, `auth.ts`, use-case и два route — строки матрицы
- [x] `apps/web` `/.well-known/apple-app-site-association` и `assetlinks.json` — пути AD-26 и `/reset`; без env — пустой список целей, не выдуманный team id
- [x] `apps/mobile` экраны `/forgot` и `/reset`, `app.config.ts` — ссылки приложения на хост API
- [x] `sprint-status.yaml` — ключ `1-7-сброс-пароля-по-email` → `review`

**Acceptance Criteria:**
- Given Story 1.7, when сценарии матрицы покрыты тестами, then неизвестный и существующий email неразличимы по телу ответа.
- Given `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, then команды зелёные.
- Given каталоги `ru`, when искать имя продукта, then его нет: только `{brand}`.

## Implementation Notes

- `prismaAdapter` в 1.7.14 принимает `transaction: true`, поэтому `revokeSessionsOnPasswordReset` включён. Тест проверяет функцию `transaction` у адаптера, срок токена 3600 и флаг отзыва. Новой сессии маршрут не ставит.
- Письмо: `https://{host из BETTER_AUTH_URL}/reset?token=`. `redirectTo` остаётся на origin `BETTER_AUTH_URL`, чтобы прошёл origin-check. Ошибка Resend пишется в лог и не меняет `{ accepted: true }`. Письмо уходит только из `sendResetPassword`; Better Auth вызывает его после `findUserByEmail`, для неизвестного адреса колбэк не зовётся.
- `/.well-known` — dynamic. Без `APPLE_TEAM_ID` и отпечатков списки целей пустые.
- Expo грузит `app.config.ts` через Node require и не резолвит `src/config/env.ts`. Хост `EXPO_PUBLIC_API_BASE_URL` читается в конфиге; `scripts/check-boundaries.mjs` разрешает `process.env` только этому файлу. Пустое значение не добавляет фильтры (`expo config`).
- `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` зелёные. Сборка проходит без `RESEND_API_KEY`: `getEnv()` ленивый, well-known не пререндерится.
- Unverified: живая доставка Resend и открытие установленного приложения по App Link.
- Ревью: после успеха сброса клиент вызывает `signOut`, чтобы «Войти» не уводил с отозванной сессией. Повторный submit держат ref и номер запроса. `pathPrefix` вишлиста — `/wishlist/`, плюс точный `/wishlist` и `/reset`. Тест транзакции смотрит `adapterConfig.transaction`. У mobile появился `vitest` на `issueFromError` и фильтры ссылок.
- Риск снят: `RESEND_API_KEY` и `EMAIL_FROM` необязательны. Без них вход работает, письмо не уходит, ответ forgot тот же; в лог пишется, что почта не настроена. Непустой, но кривой `EMAIL_FROM` по-прежнему валит `getEnv()`.
- Android intent filter: `/l/`, `/i/`, `/wishlist` и точный `/reset`, чтобы `/login` не открывался как App Link.
- `USER_NOT_FOUND` от Better Auth (пользователь удалён при живом токене) отвечает `RESET_LINK_STALE`, а не 500.

## Spec Change Log

## Review Triage Log

- `low` reject — сжатый `epic-1-context.md` потерял пины версий и противоречит сам себе про пояс. Файл — кэш планирования, не экран. Восстановление абзацев шире прямой правки.
- `false` — в диффе ревью не было `package-lock.json`, потому что файл ревью его отрезал. В дереве lock изменён: `resend` и `vitest` для mobile закреплены.
- `low` → patch — `.env.example` с непустым `replace-me` шёл в Resend, хотя комментарий обещал пропуск. Плейсхолдеры закомментированы.
- `false` — `https://` в ссылке требует замороженный блок спеки, даже если `BETTER_AUTH_URL` локально `http`. Хост берётся из того же origin.
- `low` reject — хост письма (`BETTER_AUTH_URL`) и хост App Link (`EXPO_PUBLIC_API_BASE_URL`) могут разъехаться, а iOS `applinks` не несёт порт. В проде один домен на 443; правка — новая связка двух env, не точечная.
- `low` → patch — `pathPrefix: "/wishlist"` захватывал `/wishlists`. Теперь точный `/wishlist` и префикс `/wishlist/`.
- `false` — `webcredentials` не открывает `/login` в приложении. Это автозаполнение пароля, его просит DESIGN; пути App Link по-прежнему режет AASA.
- `low` reject — любой непустой team id и отпечаток принимаются. Опечатка оставляет запасной браузер. Проверка формата — новые ветки в `getEnv`, не прямая правка.
- `low` reject — новый запрос не гасит старые ссылки до истечения часа. Спека требует одноразовость использованной ссылки, не единственную живую. Удаление чужих строк `Verification` — не точечная правка.
- `medium` defer — лимит forgot доверяет первому `X-Forwarded-For` и общему `unknown`. Это готовый `clientIp`, тот же, что у регистрации. Запись в `deferred-work.md`.
- `medium` → patch — после сброса серверные сессии отозваны, а клиент остаётся `ready`, и «Войти» уводит внутрь. Успех вызывает `signOut`, локальный токен и состояние сбрасываются.
- `false` — `next` и email не едут в письме. Замороженная форма ссылки — только `/reset?token=`.
- `low` reject — токен остаётся в query, «Написать автору» открывается через `Linking.openURL`, не якорём документа. Срезать query после чтения легко сбрасывает экран в «ссылка устарела». Форму URL задаёт спека.
- `medium` → patch — повторный тап до `setPending` шлёт второй reset и может показать успех вместе со «ссылка устарела». Вход в `submit` держит ref, пока запрос не закончился.
- `medium` → patch — ответ forgot может прийти уже после смены email. Номер запроса отбрасывает устаревший ответ.
- `medium` → patch — тест транзакции смотрел на обёртку `adapter.transaction`, которая есть и без `transaction: true`. Теперь проверяется `adapterConfig.transaction`.
- `medium` → patch — фильтры Expo не исполнялись тестами. Чистые `appLinkHost` / `linkData` покрыты vitest в `apps/mobile`, и `npm test` его запускает.
- `medium` → patch — без ветки `RESET_LINK_STALE` в `issueFromError` экран не предлагал «Отправить ещё раз», а тесты API оставались зелёными. Ветка покрыта `form-issue.test.ts`.


## Design Notes

Better Auth кладёт в `sendResetPassword` адрес `${baseURL}/reset-password/${token}?callbackURL=`. Это путь `/api`, его не открывает App Link. В письме — `${origin}/reset?token=${token}` с тем же `token`, который принимает `resetPassword`. `redirectTo` всё равно передавать: origin-check Better Auth.

Копирайт, которого нет в EXPERIENCE (NOTE FOR UX, не выдумывать второй вариант в коде):

- `forgot.submit` — «Отправить ссылку»
- `forgot.sent` — «Если аккаунт с этим email есть, мы отправили ссылку.»
- `reset.title` / `reset.pageTitle` — «Новый пароль» / «Новый пароль — {brand}»
- `reset.submit` — «Сохранить пароль»
- `reset.done` — «Пароль сохранён.»
- `reset.sendAgain` — «Отправить ещё раз»
- `email.passwordReset.subject` — «Сброс пароля — {brand}»
- `email.passwordReset.text` — «Чтобы задать новый пароль, откройте ссылку. Она действует один час и только один раз.»
- `email.passwordReset.action` — «Задать новый пароль»

Письмо: text и простой HTML с одной ссылкой-кнопкой. URL в HTML экранировать. После успеха сброса — текст `reset.done` и «Войти», без `router` в сессию.

`revokeSessionsOnPasswordReset` без транзакции адаптера может сжечь токен раньше записи пароля. Если `transaction: true` у `prismaAdapter` в 1.7.14 нет — отзыв сессий не включать.

## Verification

**Commands:**
- `npm install` из корня; `npm install resend@6.31.0 -w @gift-list/web`
- `npm run typecheck && npm test && npm run lint && npm run build`
- `rg "Gift List" packages/contracts/src/i18n -g '!*.test.ts'` — пусто

**Manual checks (if no CLI):**
- Живая доставка Resend и открытие установленного приложения по App Link без сертификата стора не проверяются. В ответе отметить Unverified.
