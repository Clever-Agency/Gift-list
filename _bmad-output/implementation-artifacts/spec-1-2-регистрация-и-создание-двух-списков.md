---
title: '1.2 Регистрация и создание двух Списков'
type: 'feature'
created: '2026-10-02'
baseline_commit: 'b4cee33'
status: 'review'
route: 'retroactive'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<!-- Оформлена задним числом: код был написан до спеки (коммиты b4cee33, 5495223). Верификация на живой БД ещё не выполнена. -->

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
