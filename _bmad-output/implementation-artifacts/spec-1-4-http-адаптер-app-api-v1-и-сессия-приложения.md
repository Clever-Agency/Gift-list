---
title: '1.4 HTTP-адаптер app/api/v1 и сессия приложения — сервер'
type: 'feature'
created: '2026-10-31'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'dfdc3584972b16662e34b3c4a6b258bd3865877f'
context:
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** У сервера нет HTTP-входа для приложения: `app/api/v1` не существует, Better Auth умеет только cookie, конверт ошибки в `packages/contracts` не соответствует AD-12 (`fieldErrors` вместо `reason`/`field`/`params`), use-case не отделён от Server Action.

**Approach:** Серверная часть Story 1.4 (CLE-36) и contracts: конверт AD-12 с закрытым `reason`, общий адаптер `app/api/v1` поверх тех же use-case, что Server Actions, `@better-auth/expo` + `bearer()`, `GET /api/v1/me`. Use-case паритета — «текущий пользователь»: Server Action `getMe` и `GET /api/v1/me` вызывают одну функцию `getCurrentUser`. Клиент Expo (API-клиент, secure-store, `Accept-Language`, восстановление сессии) человек 2026-10-31 вынес в `deferred-work.md` — следующий заход по той же истории.

## Boundaries & Constraints

**Always:**
- Конверт AD-12: `{ ok: true, data } | { ok: false, code, message, reason?, field?, params? }`. `code` — 6 кодов `ERROR_CODES`. `reason` — закрытый zod-enum в contracts: `EMAIL_TAKEN`, `NICK_TAKEN`, `DUE_OUT_OF_RANGE`, `DATES_LIMIT`. `field` — имя поля формы. `params` — запись только из `string | number | boolean | null`. `fieldErrors` удаляется.
- `ru/common.json`: `errors.code.<CODE>` для 6 кодов и `errors.reason.<REASON>` для 4 причин; `EMAIL_TAKEN` → «Этот email уже зарегистрирован.» Без литерала бренда.
- Route Handler не содержит правил: разбирает вход zod-схемой из contracts (если вход есть), вызывает use-case, отдаёт его `ActionResult` JSON. Статусы: ok → 200; UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404, CONFLICT 409, VALIDATION 400, RATE_LIMITED 429. Не-JSON или ошибка схемы → VALIDATION, `field` = первый путь ошибки схемы.
- `GET /api/v1/me`: без сессии → UNAUTHENTICATED; с сессией (cookie или `Authorization: Bearer`) → `{ id, email, name, nick }` по strict `meSchema` из contracts.
- `@better-auth/expo` **1.7.14** = версия `better-auth` в lock; ставить `-w @gift-list/web`, lock только корневой. Плагины: `expo()`, `bearer()`, `nextCookies()` последним. `trustedOrigins` включает `giftlist://` (scheme `apps/mobile/app.config.ts`).
- Auth и Prisma грузятся лениво: `next build` без секретов не падает.
- `register.ts` только переходит на новый конверт: дубликат email → `reason: EMAIL_TAKEN, field: "email"`; nick → `NICK_TAKEN, field: "nick"`; оба — email. Ошибка схемы → VALIDATION с `field` первого поля. Остальное (два списка, redirect) — Story 1.5, не трогать.
- sprint-status ключ `1-4-http-адаптер-app-api-v1-и-сессия-приложения` = `in-progress`: история закрывается только после клиентской части.

**Never:**
- Изменения `apps/mobile` (клиентская часть отложена). Экраны входа/регистрации, OAuth, SMS (1.5–1.6). Переписывание регистрации (1.5). `User.locale`, миграции.
- Копия бизнес-правил в route handler. React, Prisma, `process.env` в contracts. Сервисы Vercel. Правки PRD, эпиков, спайна.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| me-session | `GET /api/v1/me`, сессия есть | 200, `{ ok: true, data: { id, email, name, nick } }` | N/A |
| me-anon | `GET /api/v1/me`, сессии нет | 401, `{ ok: false, code: "UNAUTHENTICATED", message }` | N/A |
| parity | `getMe()` и `GET /api/v1/me` при одной сессии / без сессии | тела глубоко равны | N/A |
| envelope-reason | ошибка с `reason: "EMAIL_TAKEN", field: "email"` | `actionResultSchema` принимает | N/A |
| envelope-bad | `reason: "WHATEVER"` или `fieldErrors` | отклоняет | N/A |
| envelope-params | `params: { max: 3, until: "2026-11-01" }` / `params: { x: {} }` | принимает / отклоняет | N/A |
| body-invalid | хелпер разбора тела: не JSON / не проходит схему | 400 VALIDATION; без `field` / `field` первого пути | N/A |
| register-dup | дубликат email / nick / обоих | VALIDATION + `EMAIL_TAKEN`/`email`, `NICK_TAKEN`/`nick`, оба → email | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/index.ts` — `ERROR_CODES`, `actionErrorSchema` (стр. 18-24, `fieldErrors` убрать), `actionResultSchema`. Добавить `ERROR_REASONS`/`errorReasonSchema`/`ErrorReason`, `meSchema`/`Me`. Тесты `src/index.test.ts`. Граница — `scripts/check-boundaries.mjs`.
- `packages/contracts/src/i18n/ru/common.json` — сейчас без `errors`; тест каталогов `src/i18n/i18n.test.ts`.
- `apps/web/src/lib/auth.ts` — `betterAuth` за ленивым Proxy (41-69), `plugins: [nextCookies()]` (30-31). `bearer` из `better-auth/plugins`, опции по умолчанию. `expo` из `@better-auth/expo`. bearer активен только при заголовке `Authorization`, при sign-in отдаёт `set-auth-token`.
- `apps/web/src/lib/session.ts` — `getSession()` через `headers()`. Use-case принимает `Headers` аргументом: route handler отдаёт `request.headers`, action — `await headers()`.
- `apps/web/src/actions/register.ts` — `fieldErrors` в стр. 15, 34-44, 60-67, 129-133. Новые: `src/actions/current-user.ts` (без `"use server"`, `getCurrentUser(headers): Promise<ActionResult<Me>>` через `auth.api.getSession({ headers })`), `src/actions/me.ts` (`"use server"`, `getMe()`).
- `apps/web/src/app/api/auth/[...all]/route.ts` — образец. Новые: `src/lib/api-v1.ts` (`toResponse(result)`, `parseJsonBody(request, schema)`), `src/app/api/v1/me/route.ts` (`GET(request: Request)`).
- Next 16 route handler: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`; GET динамический по умолчанию. `src/lib/spa-paths.ts` уже отдаёт `/api` Next — не трогать.
- Тесты: `apps/web/vitest.config.ts` (`src/**/*.test.ts`). Моки: `src/lib/auth.test.ts` (`vi.mock("server-only")`, env через `process.env`), `src/app/lists/page.test.ts`. Для паритета мокать `@/lib/auth` и `next/headers`. БД в тестах и CI нет.
- В worktree нет `node_modules`: сначала `npm install` из корня (Node ≥ 24.22.1).

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/index.ts`, `index.test.ts` — конверт, `errorReasonSchema`, `meSchema`; строки envelope-* матрицы
- [x] `packages/contracts/src/i18n/ru/common.json` — `errors.code.*`, `errors.reason.*`
- [x] `apps/web/package.json` + корневой lock — `@better-auth/expo@1.7.14`
- [x] `apps/web/src/lib/auth.ts`, `auth.test.ts` — плагины и `trustedOrigins`
- [x] `apps/web/src/actions/current-user.ts`, `me.ts` — use-case и Server Action
- [x] `apps/web/src/lib/api-v1.ts` + тест — статусы, body-invalid
- [x] `apps/web/src/app/api/v1/me/route.ts` + `route.test.ts` — me-session, me-anon, parity
- [x] `apps/web/src/actions/register.ts` + тест на моках — register-dup и `field` ошибки схемы
- [x] `sprint-status.yaml` — ключ 1-4 → `in-progress`

**Acceptance Criteria:**
- Given install, when `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, then всё зелёное.
- Given standalone-сервер, when `curl -i /api/v1/me` без cookie, then JSON-конверт, а не HTML SPA.
- Given `npm ls @better-auth/expo better-auth -w @gift-list/web`, then обе 1.7.14.
- Given `rg fieldErrors apps packages`, then вхождения только в негативном тесте `packages/contracts/src/index.test.ts`.

## Implementation Notes

- 2026-10-31: конверт AD-12 с закрытым `reason`, `meSchema`, ключи `errors.*`; `@better-auth/expo` 1.7.14, плагины `expo()`, `bearer()`, `nextCookies()`, `trustedOrigins: giftlist://`; use-case `getCurrentUser(headers)` для `getMe` и `GET /api/v1/me`; хелпер `lib/api-v1.ts`; `register.ts` на `reason`/`field`.
- `npm run build` на Windows падает на `scripts/sync-spa.mjs` (`spawnSync npm ENOENT`) — до этой правки так же; `prisma generate` + `next build` со заглушками env проходят, `/api/v1/me` — динамический маршрут. `next start`: `curl /api/v1/me` без cookie → 401 JSON. Standalone и полный build — в CI (Linux).
- Живая сессия (cookie, Bearer, `set-auth-token`) без БД не проверена — Unverified.

- Финальное ревью: `/api/auth/*` обёрнут `stripAuthTokenForBrowser` (`lib/auth-token.ts`) — `set-auth-token` уходит только запросам с `expo-origin` или `origin: giftlist://`. Остаточный риск: заголовок `expo-origin` может выставить и JS того же домена (при XSS), отличить нативный клиент заголовком надёжно нельзя. Успешный вход без БД не проверен; standalone: `POST /api/auth/sign-in/email` с браузерным `origin` — без `set-auth-token`.
- Ключ sprint-status 1-4 остаётся `in-progress`: клиентская часть в `deferred-work.md`.

## Spec Change Log

## Review Triage Log

- `medium` → patch — тесты `/api/v1/me` не проверяют, что заголовки запроса (cookie, `Authorization: Bearer`) доходят до `getSession`; подмена на пустые `Headers` прошла бы зелёной (verification-gap, blind).
- `medium` → patch — нет теста, что `errors.code.*` и `errors.reason.*` покрывают ровно `ERROR_CODES` и `ERROR_REASONS` (verification-gap, blind, edge).
- `low` → patch — новые `message` на русском и расходятся с каталогом; по AD-27 `message` — английская диагностика, которую клиент не показывает (`current-user.ts`, `api-v1.ts`, VALIDATION в `register.ts`).
- `low` → patch — у `/api/v1/me` нет `Cache-Control`; ответ с email и ником может закэшировать прокси. Нужен `private, no-store` в `toResponse`.
- `low` → patch — `field` в `register.ts` = `path[0]`, в `parseJsonBody` — путь через точку; один хелпер на оба места.
- `medium` → patch — `parseJsonBody` разбирает тело любого `Content-Type`: будущая мутация `api/v1` с cookie примет кросс-сайтовый `text/plain` POST (CSRF). Требовать `application/json`.
- `low` → patch — в `current-user.ts` лишние `as` и `?? ""`: `User.nick` в схеме Prisma — `String`, не null.
- `low` → patch — `@better-auth/expo` и `better-auth` объявлены `^1.7.14`; версии могут разъехаться при переустановке. Закрепить обе на `1.7.14`.
- `false` — пустой ник у пользователя: `nick String` (не null) в `schema.prisma:25`.
- `false` — `meSchema.parse` падает на `null` name: `name String` (не null) в `schema.prisma:21`.
- `false` — синглтон `auth` на `globalThis` переживает `vi.resetModules`: оба теста задают одинаковые env, проверяемая конфигурация та же.
- `low` reject — `rg fieldErrors` находит строку в негативном тесте contracts, который проверяет, что поле отклоняется; в коде продукта вхождений нет.
- `low` reject — `register.ts` потерял тексты ошибок zod: так решено в intent (VALIDATION + `field`), причины форматных ошибок — Story 1.5.
- `low` reject — `params` не используются каталогом: `DUE_OUT_OF_RANGE`/`DATES_LIMIT` — задел AD-12, их тексты с параметрами появятся с историями дат.
- `low` reject — P2002 на другом уникальном поле даёт VALIDATION без `field`: поведение было и до правки, `register.ts` переписывает Story 1.5.
- `medium` → patch (финальное ревью) — after-хук `bearer()` добавляет `set-auth-token` к любому ответу, который ставит cookie сессии, и same-origin JS веб-сборки может прочитать токен — нарушение AC «в браузере токен в JS недоступен». Человек 2026-10-31: исправить сейчас. Обёртка `/api/auth/*` оставляет заголовок только запросам с `expo-origin` или `origin: giftlist://`.
- `low` → patch (финальное ревью) — `message` RATE_LIMITED в `register.ts` остался русским.
- `low` → patch (финальное ревью) — тест не проверял, что `getMe` передаёт в use-case настоящие заголовки.
- `low` → правка Verification — `rg fieldErrors` находит негативный тест contracts; формулировка проверки уточнена.
- `defer` — `getSession` бросает при недоступной БД → 500 не в конверте; в закрытом наборе кодов нет внутренней ошибки, клиент должен трактовать не-конверт как сетевую ошибку (клиентская часть 1.4).
- `defer` — `trustedOrigins` без `exp://` / `exp+giftlist://` для Expo Go и dev client; решать вместе с клиентским входом.
- `defer` — у `parseJsonBody` нет лимита размера тела; вызовов пока нет.

## Design Notes

bearer() срабатывает только при заголовке `Authorization`; браузер его не шлёт, cookie-поток не меняется. Ограничивать bearer путём `/api/v1` нельзя: нативный sign-in идёт через `/api/auth/*` и должен получить `set-auth-token` (замечание review-adversarial-2026-10-28 о смешении cookie и bearer).

Паритет без Next-рантайма:

```ts
const viaAction = await getMe();
const viaHttp = await (await GET(new Request("http://x/api/v1/me"))).json();
expect(viaHttp).toEqual(viaAction);
```

## Verification

**Commands:**
- `npm install` из корня; `npm ls @better-auth/expo better-auth -w @gift-list/web` — 1.7.14
- `npm run typecheck && npm test && npm run lint && npm run build` — зелёные
- `node apps/web/.next/standalone/apps/web/server.js` с env-заглушками; `curl -i http://localhost:3000/api/v1/me` — JSON, не `spa-index.html` (без БД допустим 500 от чтения сессии — тогда Unverified, проверить с БД)
- `rg fieldErrors apps packages -g '!node_modules' -g '!.next'` — только негативный тест в `packages/contracts/src/index.test.ts`
