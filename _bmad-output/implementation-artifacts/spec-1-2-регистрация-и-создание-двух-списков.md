---
title: '1.2 Регистрация и создание двух Списков'
type: 'feature'
created: '2026-10-02'
baseline_commit: 'b4cee33'
status: 'review-blocked'
route: 'retroactive'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<!-- Оформлена задним числом: код был написан до спеки. Верификация на живой БД ещё не выполнена. -->

> **2026-10-28.** D-23 заменяет два списка одним вишлистом. Этот файл описывает уже написанный код и **не является** текущими критериями приёмки. Приёмка Story 1.2 — по `epics.md`. Боевых данных нет, миграция не нужна. Код приложения этим замечанием не менялся.
>
> **2026-10-28, native-first (D-40…D-42).** Эпик 1 перенумерован. Регистрация теперь **Story 1.5** «Регистрация и один вишлист» (оба клиента) и идёт после 1.2 «Монорепозиторий», 1.3 «Каркас Expo» и 1.4 «HTTP-адаптер». Ключ `1-2-регистрация-и-создание-двух-списков` из sprint-status удалён. Для 1.5 пишется новая спека; этот файл — только справка о существующем коде.

## Intent

**Problem:** Нет аккаунтов: пользователь не может зарегистрироваться и получить два Списка (FR-1, FR-9).

**Approach:** Better Auth (email+пароль, database sessions) + Server Action `register`, которая в одной транзакции создаёт User, credential Account и ровно два List, затем открывает сессию через `auth.api.signInEmail`.

## Boundaries & Constraints

**Always:**
- Ник 3–24 `[a-z0-9_]`, уникальность через `nickNormalized` (AD-13).
- Два List (`DISCOVERABLE`, `FRIENDS_ONLY`) с `UNIQUE(ownerId, type)`, immutable `publicToken` CUID2 UNIQUE (AD-6).
- Результат действия — коды AD-12; дубликат email/ника → `VALIDATION`, email-ошибка общей фразой (AD-3).
- Rate limit регистрации: 5 попыток/час на IP, Postgres-счётчик, код `RATE_LIMITED`.

**Never:**
- Штатный эндпоинт Better Auth sign-up (включён `disableSignUp`), API создания/удаления списков, оплата.

## Tasks & Acceptance

**Execution:**
- [x] Prisma: `User`, `Session`, `Account`, `Verification`, `List`, `RateLimit` + миграции `20261002000000_init_auth_lists`, `20261002120000_rate_limit`
- [x] `src/lib/auth.ts`, `/api/auth/[...all]`, `src/lib/session.ts`, typed `env.ts` (zod)
- [x] `src/actions/register.ts`, `src/lib/rate-limit.ts`, `src/domain/nick.ts|lists.ts`
- [x] UI: `/register` (превью `@ник`), `/lists` (заглушка), CTA на главной
- [x] Vitest + тесты `domain/nick`
- [ ] Применить миграции к реальной PostgreSQL и пройти ручную проверку (ниже)

**Acceptance Criteria:**
- Given валидная форма, when регистрация, then создана сессия и ровно два List с разными `publicToken`
- Given занятые email/ник (в т.ч. разный регистр), when регистрация, then `VALIDATION` без раскрытия, какой аккаунт существует (email)
- Given 6-я попытка с одного IP за час, when регистрация, then `RATE_LIMITED`
- Given гонка двух регистраций с одним ником, when обе проходят, then одна успешна, вторая `VALIDATION`

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — expected: exit 0
- `npm run migrate` на чистой БД — expected: обе миграции применены

**Manual checks:**
- Регистрация → редирект на `/lists`, видны «Открытый» и «Для друзей»
- Повтор с тем же ником в другом регистре → «Этот ник уже занят»
- 6 валидных попыток подряд → сообщение о лимите

### Review Findings

- [ ] [Review][Decision] Email-конфликт раскрывает существование аккаунта (AC2 «без раскрытия») — `fieldErrors.email = EMAIL_REJECTED` ставится на поле email, только когда email занят, значит по самому факту ошибки на поле email его можно проверять; плюс разница во времени (дубликат возвращается до `hashPassword`). Варианты: (a) оставить как есть — формулировка общая, AC выполнен буквально; (b) общее сообщение уровня формы «Не удалось зарегистрироваться» для конфликта email (без привязки к полю) и выравнивание времени; (c) принять риск до подтверждения email. Полностью скрыть факт без подтверждения email нельзя: ник и так публичен. [src/actions/register.ts:218-222]
- [ ] [Review][Patch] Нет видимой ошибки, если `VALIDATION` приходит с пустым/неизвестным `fieldErrors` (P2002 по `publicToken` или строка уже исчезла; ключ `form`) — форма рендерит только RATE_LIMITED [src/app/(auth)/register/register-form.tsx:377, src/actions/register.ts:245-253]
- [ ] [Review][Patch] `signInEmail` после коммита пользователя без try/catch: при сбое аккаунт есть, сессии нет, повторная регистрация даёт «email занят» — вернуть понятную ошибку формы [src/actions/register.ts:257-260]
- [ ] [Review][Patch] `findFirst` по `OR[email, nick]` возвращает одну строку: если email и ник принадлежат разным пользователям, показывается только один конфликт — заменить на `findMany` (и в P2002-ветке) [src/actions/register.ts:218-222, 248-252]
- [ ] [Review][Patch] Нет тестов `register` и `consumeRateLimit`: валидация, конфликты, P2002-ветка, rate limit до обращения к БД, ровно два List с разными `publicToken`, граница `<= max`, разбор `x-forwarded-for` (моки Prisma/auth/headers) [src/actions/register.test.ts, src/lib/rate-limit.ts]
- [ ] [Review][Patch] После неудачной отправки React 19 сбрасывает поля формы (имя, email не сохраняются; сохраняется только ник) — вернуть введённые значения в состоянии и использовать `defaultValue` [src/app/(auth)/register/register-form.tsx]
- [ ] [Review][Patch] Гигиена: добавить `DIRECT_URL` в `.env.example` (его читает `prisma.config.ts`), поправить устаревший заголовок «Models arrive in stories 1.2+» в `schema.prisma` [.env.example, src/db/schema.prisma:2]
- [x] [Review][Defer] Живая БД не проверена: SQL rate limit (`make_interval(secs => $n)`, тип `count`), совместимость credential-аккаунта с `signInEmail`, применение обеих миграций, гонка двух регистраций — deferred: закрывается незакрытой задачей спеки «Применить миграции… и пройти ручную проверку» (maybe-false, было бы medium)
- [x] [Review][Defer] `getEnv()` в `auth.ts` и проверка `DATABASE_URL` в `client.ts` выполняются при импорте; комментарий в `env.ts` («lazy so next build works without secrets») неверен — deferred: не подтверждено; проверить `npm run build` без `.env` (на Vercel переменные заданы; maybe-false, было бы medium) [src/lib/auth.ts:8, src/db/client.ts:12]
- [x] [Review][Defer] Cyrillic в DM Sans / Fraunces отсутствует, RU-интерфейс рисуется системным шрифтом — deferred: осознанное решение из 1.1, задокументировано в `layout.tsx`, требует решения по UX [src/app/layout.tsx:5-23]
- [x] [Review][Defer] `/lists` без сессии редиректит на `/register` — deferred: заменить на `/login` в Story 1.3 [src/app/(app)/lists/page.tsx:12]

**Rejected:**
- `getClientIp` подделывается / общий бакет `unknown` — на Vercel `x-forwarded-for` выставляет платформа; фоллбэк работает только вне хостинга.
- Рост таблицы `RateLimit` — рост только по числу уникальных IP, при 5/час это нерелевантно сейчас; чистка добавила бы механизм.
- `publicToken` «immutable» только комментарием — код его нигде не обновляет, триггер в БД избыточен.
- `nick` и `nickNormalized` дублируют друг друга, зарезервированные ники — за рамками AC и спеки.
- `formData.get` вернёт null/File — только при ручном запросе, ответ всё равно `VALIDATION`.
- `trustedOrigins` для превью — Better Auth использует `BETTER_AUTH_URL`, превью вне Раунда 1.
- `DIRECT_URL=""` не откатывается на `DATABASE_URL` — теоретический случай конфигурации.
- Пакет `cn` ^0.4.0 — проверено в `node_modules`: легитимный drop-in для `clsx + tailwind-merge`.
- Нет login/logout/reset — Stories 1.3 и 1.4.
- Отсутствующий List на `/lists` молча пропускается — инвариант «два списка» гарантируется транзакцией.
- Несколько `role="alert"` и фокус на первое поле — a11y-полировка, вне AC.
