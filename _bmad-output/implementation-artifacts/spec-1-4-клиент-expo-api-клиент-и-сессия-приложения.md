---
title: '1.4 HTTP-адаптер app/api/v1 и сессия приложения — клиент Expo'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: 'beaac301c2890032178557c451594c67dba71eab'
context:
  - '{project-root}/.cursor/rules/ux-design.mdc'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Сервер Story 1.4 готов (CLE-36), но у `apps/mobile` нет API-клиента, сессии и тест-раннера, поэтому клиентские AC Story 1.4 (`epics.md` стр. 306–310) не выполнены (Linear CLE-41).

**Approach:** Fetch-клиент поверх `getApiBaseUrl()` с платформенным транспортом: native — Bearer-токен в `expo-secure-store`, браузер — cookie. Разбор конверта схемами `@gift-list/contracts`, ключ текста ошибки по `reason`/`code`, восстановление сессии через `/api/v1/me` в провайдере `app/_layout.tsx`, Vitest для mobile. Dev-origins сервера отложены (`deferred-work.md`, 2026-11-01).

## Boundaries & Constraints

**Always:**
- Общий код — только `@gift-list/contracts`; `process.env` — только `src/config/env.ts` (`scripts/check-boundaries.mjs`).
- `Accept-Language` в каждом запросе: теги `getLocales()` через запятую с убывающим `q`; тегов нет — `DEFAULT_LOCALE`.
- Native (`*.native.ts`): токен в `expo-secure-store`; есть токен — `Authorization: Bearer`; на `/api/auth/*` — `expo-origin: giftlist://`; ответ с `set-auth-token` — токен сохраняется.
- Web (`*.web.ts`): `credentials: 'include'`; токен не читается и не хранится, `Authorization` и `expo-origin` не шлются.
- Пустой `getApiBaseUrl()`: в браузере относительный путь (тот же домен, AD-26), на native — `network` без запроса.
- Результат: `{ ok: true, data }` | `{ ok: false, kind: 'api', error: ActionError }` | `{ ok: false, kind: 'network' }`. `network` — сбой fetch, не-JSON или тело не проходит `actionResultSchema(схема)` (в том числе 500 без конверта). Исключение (решение человека 2026-11-01, совместимость старых нативных сборок с новым сервером): тело не прошло строгую схему, но в нём `ok: false` и `code` из `ERROR_CODES` → `kind: 'api'` с этим `code`; незнакомые `reason`, `field`, `params` и лишние поля отбрасываются, поэтому текст берётся по `code`. Ошибка чтения secure-store — тоже `network`, без запроса и без удаления токена.
- Ключ текста: `errors.reason.<reason>`, иначе `errors.code.<code>`; для `network` — новый `errors.network` в `ru/common.json`: «Нет связи с сервером. Проверьте интернет и повторите.» `message` не показывается (AD-27).
- `SessionProvider` в `app/_layout.tsx` внутри `IntlProvider` вокруг `Stack`; при монтировании `GET /api/v1/me` по `meSchema`. Состояния `loading` → `authenticated(me)` | `anonymous` (UNAUTHENTICATED; native удаляет токен) | `error`. `useSession()` → `{ status, me?, refresh }`. Переходы — чистая функция с тестом.
- Vitest: `apps/mobile/vitest.config.ts` (node, alias `@`), скрипт `test`; зависимости `-w @gift-list/mobile`, lock один.
- Итог: `sprint-status.yaml` 1-4 → `done`; в `deferred-work.md` закрыть пункты про клиент 1.4, 500 без конверта и `expo-origin`.

**Never:**
- Экраны и вызовы входа/регистрации, редиректы по сессии (1.5–1.6); `better-auth`/`@better-auth/expo` в `apps/mobile`; правки `apps/web`.
- Токен в `AsyncStorage`, `localStorage` или памяти веба; строки UI вне каталога; правки PRD, эпиков, спайна.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| me-ok | 200 `{ok:true,data:{id,email,name,nick}}` | `authenticated(me)` | N/A |
| me-anon | 401 `UNAUTHENTICATED` | `anonymous`; native: токен удалён | N/A |
| err-reason | `{ok:false,code:"VALIDATION",reason:"EMAIL_TAKEN"}` | `errors.reason.EMAIL_TAKEN` | N/A |
| err-code | `{ok:false,code:"FORBIDDEN"}` | `errors.code.FORBIDDEN` | N/A |
| no-envelope | 500 HTML или JSON без конверта | `kind:'network'` | `errors.network` |
| fetch-fail | fetch бросает | `kind:'network'` | `errors.network` |
| native-headers | токен есть; `/api/auth/sign-in/email` | `Authorization`, `expo-origin`, `Accept-Language` | N/A |
| native-token | ответ с `set-auth-token: t2` | `t2` в secure-store | N/A |
| unknown-reason | 401 `{ok:false,code:"UNAUTHENTICATED",reason:"NEW_ONE",extra:1}` | `kind:'api'`, `code` UNAUTHENTICATED без `reason` → `anonymous` | `errors.code.UNAUTHENTICATED` |
| store-read-fail | native: чтение secure-store бросает | `kind:'network'`, fetch не вызван, токен не удалён | `errors.network` |
| web-headers | любой запрос | `credentials:'include'`, без `Authorization`/`expo-origin` | N/A |

</frozen-after-approval>

## Code Map

- `apps/mobile/src/config/env.ts` — `getApiBaseUrl()` (12–14).
- `apps/mobile/src/platform/secure-store.{ts,native.ts,web.ts}` — образец тройки; `.ts` — заглушка для tsc и Vitest. Новые: `session-token.*`, `transport.*`.
- `apps/mobile/app/_layout.tsx` — `getLocales()`/`negotiateLocale` (43–46), `IntlProvider` → `Stack` (49–59).
- `packages/contracts/src/index.ts` — `actionResultSchema` (48–53), `actionErrorSchema` (30–41), `meSchema` (56–63), `DEFAULT_LOCALE`; каталог `src/i18n/ru/common.json`, тест `src/i18n/i18n.test.ts`.
- `apps/web/src/lib/auth-token.ts` — сервер отдаёт `set-auth-token` только при `expo-origin`/`origin: giftlist://`. Не менять.
- В worktree нет `node_modules`: `npm install` из корня (Node ≥ 24.22.1).

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/package.json`, `vitest.config.ts`, корневой lock — Vitest, скрипт `test`
- [x] `packages/contracts/src/i18n/ru/common.json` — `errors.network`
- [x] `apps/mobile/src/platform/session-token.*`, `transport.*` — токен и заголовки
- [x] `apps/mobile/src/api/client.ts`, `error-text.ts` + тесты — строки матрицы
- [x] `apps/mobile/src/session/session-state.ts` + тест, `SessionProvider.tsx`, `app/_layout.tsx`
- [x] `deferred-work.md`, `sprint-status.yaml`

**Acceptance Criteria:**
- Given install, when `npm run typecheck`, `npm test`, `npm run lint`, then зелёные; тесты mobile идут из корня.
- Given веб-сборка, when `/api/v1/me`, then cookie и `Accept-Language` есть, `Authorization` нет.

## Implementation Notes

- 2026-11-01: Vitest в `apps/mobile` (`vitest.config.ts`, скрипт `test`); `zod ^4.6.7` в `devDependencies` mobile — только для типа схемы в обобщённом `apiRequest` (`import type`), в рантайм-зависимости не переносить. Платформенные `session-token.*` и `transport.*`: `.ts`-заглушки ведут себя как веб. `apiRequest(path, схема, init)` возвращает `ok` / `api` / `network`. `errorTextKey` отдаёт ключ в неймспейсе `common`, поэтому вызывающий код берёт его через `useTranslations("common")`. `loadSession` (чистая функция с внедрёнными `request` и `clearToken`) и `sessionReducer` лежат в `session-state.ts`, `SessionProvider` подключён в `_layout.tsx`.
- Проверено (финал): `npm run typecheck`, `npm test` (mobile 39, web 62, contracts 33), `npm run lint` с `check-boundaries`, `npx expo export -p web` — всё прошло. Полный `npm run build` не запускался (Windows, `sync-spa.mjs`).
- Не проверено: живой сервер, secure-store на устройстве, вход. Native-путь покрыт только тестами с моком токена. AC «веб-сборка → `/api/v1/me`» проверен только юнит-тестом веб-транспорта (`credentials: 'include'`, `Accept-Language`, без `Authorization`); в Network браузера не смотрели.
- Пункт `exp://` из CLE-36 в `deferred-work.md` перенесён в Linear CLE-42.

## Spec Change Log

- 2026-11-01, review_loop_iteration 1. Триггер — находка Edge Case Hunter: строгий `actionErrorSchema` превращает ошибку с незнакомым `reason` или полем в `network`, и старая нативная сборка покажет «Нет связи», а при 401 уйдёт в `error` вместо `anonymous`. Человек выбрал fallback по `code`. Изменено: правило «Результат» в frozen-блоке и строки матрицы `unknown-reason` и `store-read-fail`. Избегаемое состояние — ложная сетевая ошибка из-за расхождения версий клиента и сервера. KEEP: транспорт `session-token.*`/`transport.*`, `apiRequest`, `errorTextKey`, `sessionReducer` + `loadSession`, тесты — код не откатывается, правки накладываются поверх (решение оркестратора, чтобы не пересобирать заново совпадающий код).

## Review Triage Log

- `medium` → intent_gap (решено человеком: fallback по `code`) — строгая схема превращает ошибку с новым `reason`/полем в `network`; при расхождении версий 401 → `error` вместо `anonymous` (edge-case).
- `medium` → patch — `getSessionToken` глотает ошибку чтения secure-store и отдаёт `null`: запрос уходит без Bearer, 401 → `loadSession` удаляет ещё действующий токен (iOS keychain до первой разблокировки) (edge-case).
- `medium` → patch — `apiRequest` не тестируется с нативным транспортом: удаление `readResponse` или передача `headers` вместо `prepared.headers` оставляет тесты зелёными (verification-gap, blind).
- `low` → patch — `zod` в `dependencies` mobile при только `import type` (blind).
- `low` → patch — веб-тест проверяет `credentials` только с кросс-доменным base URL, основной сценарий AD-26 (пустой base) проверен лишь по URL (blind).
- `low` → patch — `sprint-status` 1-4 выставлен `done` до ревью и проверок; до шага 5 — `review` (edge-case claim, blind).
- `low` → patch — `deferred-work.md`: старый пункт `exp://` не зачёркнут, новый без ссылки на CLE-42 (blind).
- `medium` → defer — `SessionProvider` (путь, `clearSessionToken`, `refresh`) без теста; нужен React-тест-раннер, потребителей до 1.5–1.6 нет (verification-gap).
- `maybe-false` (medium если подтвердится) → defer — AC «веб-сборка: cookie и `Accept-Language` на `/api/v1/me`» не проверен в браузере с живым сервером; закрыть ручной проверкой (verification-gap, blind).
- `low` reject — гонка `/me` со старым токеном и параллельного входа удаляет новый токен: входа в 1.4 нет, на экране входа `/me` уже завершён; фикс добавляет сравнение токенов (edge-case).
- `low` reject — устаревший запрос после `refresh`/unmount всё равно удаляет токен: 401 относится к тому же токену (edge-case).
- `low` reject — `setSessionToken` бросает → успешный вход виден как `network`: входа в 1.4 нет, сбой записи редок, фикс добавляет новый вид ошибки; вернуться в 1.6 (edge-case, verification-gap, blind).
- `low` reject — нет таймаута fetch: у RN (OkHttp, NSURLSession) и браузера есть свои таймауты, «вечного loading» в обычной работе нет; фикс добавляет AbortController (edge-case, blind).
- `low` reject — путь без ведущего `/`: все вызовы — константы с `/` (edge-case).
- `false` — `resolveUrl` вне `try` может бросить: `getApiBaseUrl` только читает строку и делает `trim` (edge-case).
- `low` reject — пустой base URL на native показывает «Нет связи», а не `apiUnset`: это ошибка конфигурации сборки, не пользовательский сценарий; фикс — новый вид результата (blind).
- `low` reject — состояние `error` не хранит причину: потребителей нет, экран 1.6 добавит при необходимости, фикс расширяет публичный тип (blind).
- `false` — `errorTextKey` игнорирует `params`: ни одна фраза `errors.*` в каталоге не содержит подстановок (blind).
- `low` reject — несогласованность HTTP-статуса и конверта, пустое тело 204: `toResponse` на сервере ставит статус из конверта, 204 не отдаётся (blind).
- `low` reject — `Session.me` не связан с `status` типом-объединением: удобство типов, расширяет публичный тип; решить с первым потребителем (blind).
- `medium` → patch (r2) — `degradedApiError` отбрасывает и известный `reason`, и `field`: при новом лишнем поле `EMAIL_TAKEN` превращается в общий текст `errors.code.VALIDATION` — расходится со спекой, где отбрасываются только незнакомые (edge-case, blind).
- `medium` → patch (r2) — настоящий `session-token.native.ts` не запускается в тестах (оба теста мокают файл целиком); возврат `try/catch` в `getSessionToken` прошёл бы зелёным (verification-gap).
- `low` → patch (r2) — путь с телом запроса (`method`, `Content-Type`, `JSON.stringify`) не покрыт тестом; им пойдут мутации 1.5–1.6 (blind).
- `low` → patch (r2) — Implementation Notes называли `zod` рантайм-зависимостью после переноса в `devDependencies` (blind).
- `false` (r2) — `sprint-status` `review` против «Итог: `done`»: промежуточный статус до шага 5, там выставляется `done` (blind).
- `low` reject (r2) — нативный `apiRequest` без проверки `Accept-Language` и отсутствия `expo-origin` на `/api/v1/*`: оба покрыты тестом транспорта, сборка заголовков общая (blind).
- `low` reject (r2) — сигнатуры `transport.*`/`session-token.*` могут разойтись незаметно для `tsc`: фикс добавляет общий тип и `satisfies`; файлы по три функции, правятся вместе (blind).
- `false` (r2) — веб `resolveUrl` никогда не `null`: так задано спекой (пустой base в браузере — относительный путь) (blind).
- `low` reject (r2) — `refresh` из `authenticated` сбрасывает `me`; нет повтора при возврате в приложение/сети: потребителей нет, поведение решит 1.6 (blind).
- `low` reject (r2) — дедупликация тегов `Accept-Language` с учётом регистра, нет ограничения длины: `getLocales()` отдаёт канонические теги, их единицы (blind).
- `low` reject (r2) — `errorTextKey` возвращает `string`, а не union ключей: удобство типов, расширяет публичный тип (blind).
- `low` reject (r2) — устаревшие строки в Code Map (`node_modules`) и в старых evidence `deferred-work.md` («CI по-прежнему нет», «история не закрывается»): исторические записи, не влияют на код (blind).

## Verification

**Commands:**
- `npm install`; `npm run typecheck && npm test && npm run lint` — зелёные
- `npm run build` — на Windows падает на `sync-spa.mjs` (известно); тогда `npx expo export -p web` в `apps/mobile`, полный build — в CI
- `rg "process\.env|apps/web" apps/mobile/src apps/mobile/app` — только `src/config/env.ts`
