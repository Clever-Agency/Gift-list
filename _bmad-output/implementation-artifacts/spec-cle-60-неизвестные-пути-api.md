---
title: 'CLE-60: неизвестные пути /api отвечают конвертом'
type: 'bugfix'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
story_key: '1-4-http-адаптер-app-api-v1-и-сессия-приложения'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `GET /api/nope` и `GET /api/v1/nope` отвечают 404 `text/html` (not-found Next). Клиент не разбирает такое тело как конверт AD-12 и показывает «Нет связи» (`network`). Закрытые пути Better Auth (`/sign-in/email`, `/sign-up/email`, `/request-password-reset`, CLE-57 / PR #30) тоже отдают 404 с текстом `Not Found`, не конверт. При рассинхроне нативной сборки и сервера это выглядит как обрыв связи (дефект D-5, CLE-60, AD-12).

**Approach:** Неизвестный путь под `/api/*` и `/api/v1/*`, а также неподдержанный метод на уже существующих маршрутах `/api/v1`, отвечают статусом 404 и JSON `{ ok: false, code: "NOT_FOUND", message }` — код из закрытого набора contracts. Уже работающие обработчики, их успешные и ошибочные конверты, SPA и страницы вне `/api` не меняются. 404 Better Auth на закрытых и неизвестных путях `/api/auth/*` тоже становится этим конвертом, если это не ломает сессию, письмо и ответы `get-session` / `/ok`. Тест проверяет JSON-конверт на неизвестных путях.

</frozen-after-approval>

## Review Triage Log

- `false` — HEAD на проводе без тела. Next не отдаёт тело ни одного HEAD, в том числе успешного GET. Клиент HEAD не шлёт. Обработчик по-прежнему возвращает конверт; тест зовёт функцию так же, как остальные тесты маршрутов.
- `false` — OPTIONS существующих `/api/v1` в dev для доверенного origin отвечает `proxy.ts` пустым 204 с CORS до маршрута. Так Expo web читает следующий GET, включая `/api/v1/nope`. Прод — тот же домен, натив CORS не использует. Подмена этого 204 конвертом сломала бы preflight.
- `medium` → patch — обёртка `/api/auth` подменяла любой 404, включая JSON живого эндпоинта (`PROVIDER_NOT_FOUND` у `sign-in/social`, отключение `delete-user`). Теперь конверт только у не-JSON 404. Тест оставляет `code: PROVIDER_NOT_FOUND`.
- `defer` — 429 лимитера Better Auth на неизвестном `/api/auth/*` в production без конверта. Запись в `deferred-work.md`. Страница `GET /api/auth/error` — `false`: это HTML/редирект браузерной ошибки Better Auth, не пустой 404 неизвестного пути.
- `false` — у `GET /api/nope` нет CORS. Прокси нарочно только на `/api/v1/:path*`. Натив и прод-SPA на том же домене тело читают; расширять matcher на весь `/api` значило бы отдать dev-CORS и на `/api/auth`.
- `low` reject — нет теста через роутер Next и нет импорта `register` / `forgot` / `reset`. `next build` печатает отдельные маршруты `/api/v1/me` и `/api/v1/[...slug]`. Живой dev: `GET /api/v1/me` — 401, `POST /api/v1/session` доходит до лимитера. Неподдержанный метод на трёх маршрутах уже в тесте; остальные — тот же экспорт.

## Implementation Notes

- Конверт собирает `notFoundResponse` в `apps/web/src/lib/api-v1.ts` через `toResponse`: 404, `Cache-Control: private, no-store`, тело `{ ok: false, code: "NOT_FOUND", message: "Not found" }`. `message` по-английски, как остальные тексты API; клиент показывает каталог по `code`, не `message`.
- Неизвестные пути: `app/api/[...slug]` ловит `/api/nope`, но не детей статических `v1` и `auth`. Поэтому отдельно `app/api/v1/[...slug]`. Точные `/api` и `/api/v1` — `route.ts` рядом: обязательный catch-all их не матчит. Все четыре файла реэкспортируют методы из `api-not-found.ts`, включая HEAD и OPTIONS.
- Неподдержанный метод на уже существующих `/api/v1` — тот же ответ, экспортом метода. HEAD и OPTIONS у маршрутов с GET не перекрываются: Next сам делает HEAD из GET и OPTIONS 204 с `Allow`. На POST-only маршрутах HEAD экспортирован как конверт, иначе это пустой 405.
- Better Auth: в конверт превращаются только не-JSON 404 (`disabledPaths` с текстом `Not Found` и пустое тело неизвестного пути). JSON 404 живого эндпоинта остаётся: `POST /api/auth/sign-in/social` без провайдера — `PROVIDER_NOT_FOUND`. 200 `get-session` и `/ok` не трогаются. PUT/PATCH/DELETE на `/api/auth/*` — конверт, не вызов Better Auth. Письмо и cookie по-прежнему не ставятся.
- SPA и страницы вне `/api` не менялись. `/api` уже в `NEXT_OWNED_PREFIXES`, fallback на `spa-index.html` эти пути не забирает. `GET /l/Ab_12` остаётся HTML 404 Next.
- Ключ `1-4-http-адаптер-app-api-v1-и-сессия-приложения` в `sprint-status.yaml` уже `done`. Синхронизация в `in-progress` и `review` его не откатывает.
- Проверка живым `next dev`: `GET /api/nope` и `GET /api/v1/nope` — 404 JSON; `GET /api/v1/me` — 401 `UNAUTHENTICATED`; `POST /api/v1/session` с телом доходит до лимитера (не catch-all); `GET /api/auth/ok` — 200 `{ ok: true }`; `GET /api/auth/get-session` — 200 `null`; закрытый `POST /api/auth/sign-in/email` — конверт. `POST /api/v1/session` без Postgres — 500 `DatabaseNotReachable`, это прежний обработчик.
