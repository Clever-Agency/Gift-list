---
title: 'CLE-90: политика стойкости пароля при регистрации и сбросе'
type: 'feature'
created: '2026-11-18'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '63bfc2624a68e68ecd46f9a1659e9ad8ecb68210'
context: []
story_key: ''
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Пароль при регистрации и сбросе принимается от 8 символов и не сверяется с базой утечек. Сергей выбрал вариант B.

**Approach:** Минимум 12 UTF-16 без правил состава, максимум 128 как сейчас. Проверка утечек — через плагин Better Auth `haveIBeenPwned` (k-anonymity). Таймаут 1500 мс; таймаут и любой сбой HIBP — fail-open, пароль в лог не пишется. Вход минимум не применяет и HIBP не вызывает. Отказ — конверт AD-12 с `field: password` и причиной длины или утечки. Клиент web и mobile показывает, какое требование не выполнено; текст связан с полем. Подсказки — во всех поддерживаемых языках (сейчас только `ru`).

## Boundaries & Constraints

**Always:**
- Числа длины живут только в `PASSWORD_MIN` / `PASSWORD_MAX` (`packages/contracts/src/auth.ts`). Zod регистрации и сброса и Better Auth `minPasswordLength` / `maxPasswordLength` берут их оттуда. Длина — `String#length` (UTF-16), не code points: эмодзи вне BMP — две единицы. Так считает Better Auth.
- Вход: нижняя граница 1, верхняя `PASSWORD_MAX`. HIBP на `/sign-in/email` не вызывать, включая ветку, где Better Auth хеширует пароль для выравнивания времени.
- HIBP только при установке пароля: регистрация (`registerUser` зовёт проверку сам, потому что `hashPassword` обходит хук плагина), сброс и смена через хук на путях плагина (`/reset-password`, `/change-password`, `/sign-up/email` и остальные пути установки из плагина). k-anonymity — функция `isPasswordCompromised` из `better-auth/plugins/haveibeenpwned`. Стоковый плагин при ошибке сети бросает 500 и таймаута не имеет: таймаут 1500 мс и fail-open обернуть вокруг этой функции, не копировать SHA-1 самостоятельно.
- Причины конверта: `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `PASSWORD_PWNED`. Короткий или утёкший пароль при сбросе ссылку не гасит.
- Тексты дословно из EXPERIENCE «Ошибки форм» (уже обновлена): «Минимум 12 символов», «Пароль — до 128 символов.», «Этот пароль встречается в утечках. Выберите другой.» Подсказка минимума видна, пока пароль короче 12; ошибка заменяет её и связана с полем, как сейчас у `PasswordField`. Вход подсказку минимума не показывает.
- Планировочные документы этой ветки (PRD FR-1..FR-3, AD-3, epics 1.5–1.7, EXPERIENCE, sprint-change-proposal-2026-11-18-password-policy.md) уже приведены к решению. Не откатывать их и не менять ключи `sprint-status.yaml`.
- К Neon и другим общим БД не подключаться. Миграций нет.
- Именованные функции. Секреты не коммитить.

**Never:**
- Правила состава (регистр, цифра, спецсимвол).
- Fail-closed при недоступности HIBP.
- Вызов HIBP при входе.
- Смена порога входа для старых паролей.
- Правка `apps/web/public` (его собирает sync-spa).
- Поднятие бюджета веб-бандла заранее. Бюджет — gzip JS в `apps/web/public/_expo` (`scripts/measure-web-size.mjs`). HIBP серверный; в бандл клиента попадает только строка каталога. Если превышение небольшое — поднять лимит в этом PR и написать об этом в заметках. Если большое (десятки КиБ сверх бюджета) — остановиться и описать, не поднимать молча.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Короткий новый пароль | Регистрация или сброс, 11 UTF-16 | 400, `VALIDATION`, `field: password`, `reason: PASSWORD_TOO_SHORT`; use-case/токен не тратится | Клиент: «Минимум 12 символов», связь с полем |
| Длинный новый пароль | 129 UTF-16 или 65 эмодзи (130 единиц) | 400, `reason: PASSWORD_TOO_LONG` | Клиент: «Пароль — до 128 символов.» |
| Ровно 12 и 128 | Новый пароль этой длины, не из утечки | Проходит проверку длины | HIBP решает дальше |
| Утечка | HIBP нашёл пароль | 400, `reason: PASSWORD_PWNED`, аккаунт не создан, ссылка сброса не погашена | Клиент: «Этот пароль встречается в утечках. Выберите другой.» |
| HIBP молчит | Промис проверки не резолвится дольше 1500 мс, или бросает | Пароль устанавливается как без утечки | В лог — только имя ошибки, не пароль |
| Вход со старым коротким | Пароль короче 12, не длиннее 128 | Доходит до проверки хеша; HIBP не вызывается | Неверный пароль по-прежнему не раскрывает email |
| Обход `/api/auth` | `POST /api/auth/reset-password` с паролем короче 12 | Не 2xx; код Better Auth `PASSWORD_TOO_SHORT` | До поиска токена |
| Юникод | 64 эмодзи = 128 единиц принимаются; 65 = 130 отвергаются | Согласовано в контракте, маршруте и клиенте | — |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/auth.ts` — `PASSWORD_MIN` сейчас 8; `fitsPasswordUnits` считает `String#length`; `loginBodySchema` держит нижнюю границу 1. Менять минимум и комментарии. Экспортировать классификатор длины нового пароля.
- `packages/contracts/src/index.ts` — `ERROR_REASONS`; каждое новое значение обязано иметь ключ `errors.reason` (тест `i18n.test.ts`).
- `packages/contracts/src/i18n/ru/app.json` — `form.passwordRules` сейчас «Минимум 8 символов». `common.json` — `errors.reason`.
- `packages/contracts/src/i18n/locale.ts` — `SUPPORTED_LOCALES = ["ru"]`. Других каталогов нет.
- `apps/web/src/lib/auth.ts` — `emailAndPassword` без `minPasswordLength` (дефолт библиотеки 8/128). Плагины: `expo`, `bearer`, `nextCookies`. `disabledPaths` закрывает sign-in/sign-up/request-password-reset/update-user. `/reset-password` и `/change-password` открыты.
- `apps/web/src/actions/register.ts` — `hashPassword` из `better-auth/crypto`, хук плагина не срабатывает. Проверку HIBP вызвать здесь до записи.
- `apps/web/src/actions/password-reset.ts` — ловит `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG` и отдаёт `VALIDATION` без `reason`. Добавить `PASSWORD_COMPROMISED` → `PASSWORD_PWNED`. Длину можно отвергнуть до вызова API, чтобы ссылка не тратилась.
- `apps/web/src/lib/api-v1.ts` — `parseJsonBody` / `invalid` не ставят `reason`. Для схем нового пароля (регистрация и сброс) причина длины должна попасть в конверт. Вход не размечать как `PASSWORD_TOO_SHORT`.
- `apps/web/src/app/api/v1/register/route.ts`, `password/reset/route.ts` — вызывают `parseJsonBody`.
- `node_modules/better-auth/dist/plugins/haveibeenpwned/index.mjs` — `isPasswordCompromised` и `haveIBeenPwned`. Хук вешает проверку на `password.hash`, только если путь в списке. Список по умолчанию не содержит `/sign-in/email`. `getCurrentAuthEndpointContext` бросает вне контекста; есть `tryGetCurrentAuthEndpointContext` и `runWithEndpointContext` в `@better-auth/core/context`.
- `node_modules/better-auth/dist/api/routes/sign-in.mjs` — на неизвестном пользователе зовёт `password.hash` (выравнивание времени). Путь `/sign-in/email` в проверку утечек не включать.
- `node_modules/better-auth/dist/api/routes/password.mjs` — длина проверяется до поиска токена; хеш — до `consumeVerificationValue`.
- `apps/mobile/src/session/form-issue.ts` — `passwordFieldIssue` по локальной длине; серверный `field: password` без причины экраны переписывают им же. Причина `PASSWORD_PWNED` не должна затираться общим текстом. `loginPasswordFieldIssue` не трогать по смыслу.
- `apps/mobile/app/(auth)/register.tsx`, `reset.tsx` — подсказка, пока `password.length < PASSWORD_MIN`. Web — сборка этого же Expo-клиента.
- Успешные фикстуры нового пароля короче 12 надо удлинить, иначе схемы и клиент их отвергнут: `packages/contracts/src/auth.test.ts` (тела регистрации и успешного сброса, не логин), `apps/web/src/app/api/v1/register/route.test.ts` (`validBody`), `apps/web/src/app/api/v1/password/routes.test.ts` (успешный сброс), `apps/web/src/actions/register.test.ts`, `apps/web/src/actions/password-reset.test.ts`, mobile-тесты, которые отправляют регистрацию или сброс с `password1` / `12345678` (`invite-registration`, `nick-input`, `password-rule`, `auth-email-transient`, `confirm-password`, `email-length`). Логин и закрытые 404-маршруты могут оставить короткий пароль.
- `apps/web/src/lib/auth.test.ts` — образец POST на `/api/auth/*`. Короткий пароль на `/reset-password` должен отвергаться до токена.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/auth.ts` -- `PASSWORD_MIN = 12`; классификатор длины нового пароля (UTF-16) экспортировать; комментарии про дефолт 8 обновить -- один источник чисел
- [x] `packages/contracts/src/index.ts` и `packages/contracts/src/i18n/ru/common.json` и `app.json` -- причины `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG`, `PASSWORD_PWNED` и тексты EXPERIENCE; `form.passwordRules` = «Минимум 12 символов» -- каталог и закрытый enum
- [x] `apps/web/src/lib/hibp-password.ts` (новый) -- обёртка: `isPasswordCompromised` с таймаутом 1500 мс и fail-open; плагин с id стокового `haveIBeenPwned`, пути установки пароля без `/sign-in/email`; при утечке бросать `APIError` с кодом `PASSWORD_COMPROMISED` -- сырые маршруты и `auth.api.resetPassword` не обходят проверку
- [x] `apps/web/src/lib/auth.ts` -- `minPasswordLength` / `maxPasswordLength` из контракта; подключить обёртку плагина -- Better Auth равен контракту
- [x] `apps/web/src/lib/api-v1.ts`, маршруты register и password reset -- конверт с причиной длины для нового пароля -- сервер называет требование
- [x] `apps/web/src/actions/register.ts` -- до записи отклонить короткую/длинную длину и утёкший пароль (`PASSWORD_PWNED`); при сбое HIBP продолжать -- регистрация не обходит хук
- [x] `apps/web/src/actions/password-reset.ts` -- длина до вызова API; `PASSWORD_COMPROMISED` → `PASSWORD_PWNED`; ссылка при отказе жива -- сброс
- [x] `apps/mobile/src/session/form-issue.ts`, `register.tsx`, `reset.tsx` -- подсказка и ошибка по причине (длина или утечка), не затирать `PASSWORD_PWNED`; убрать устаревший NOTE, что в EXPERIENCE нет длины -- клиент
- [x] Тесты контракта, web (маршрут `/api/auth/reset-password` с паролем короче 12; мок HIBP: найден, чистый, зависший промис → fail-open, вход не зовёт проверку) и mobile-формы -- матрица закрыта тестами, которые реально запускаются
- [x] Удлинить фикстуры успешного нового пароля до ≥ 12, не ломая сценарии входа -- старые тесты остаются зелёными по своему смыслу

**Acceptance Criteria:**
- Given новый пароль короче 12 или длиннее 128, when его задают регистрацией, сбросом или `POST /api/auth/reset-password`, then отказ, а для api/v1 — конверт с причиной длины и поле `password`.
- Given пароль есть в HIBP, when его задают, then `PASSWORD_PWNED`, аккаунт не создаётся, ссылка сброса не гаснет, клиент показывает текст про утечку у поля.
- Given HIBP не отвечает 1500 мс или бросает, when пароль задают, then установка продолжается.
- Given вход, when пароль короче 12, then проверка длины входа его не режет и HIBP не вызывается.
- Given 64 и 65 эмодзи, when длина считается, then 64 проходит верхнюю границу, 65 — нет, одинаково в контракте и на клиенте.

## Implementation Notes

- HIBP: `isPasswordCompromised` из `better-auth/plugins/haveibeenpwned`, таймаут 1500 мс, fail-open. Плагин с id `have-i-been-pwned` вешается на пути установки пароля и не включает `/sign-in/email`. Регистрация зовёт ту же функцию до записи, потому что `hashPassword` хук не проходит.
- Бюджет веб-бандла: `BUDGET_GROWTH_BYTES` 191 488 → 192 512 (+1 КиБ). Строки каталога дали прирост до 191 631 (превышение 143 байта). HIBP в клиентский бандл не входит. Запас после подъёма — 881 байт.
- Проверено: `npm run typecheck`, `npm run lint`, `npm test` (после правки `confirm-password.test.tsx` повторно гоняется этот файл).

## Spec Change Log

## Review Triage Log

- `medium` → patch — `parseJsonBody` вешал `PASSWORD_TOO_SHORT` на любой отказ поля `password`, включая пустой пароль входа. Причина длины нового пароля ставится только с `{ newPassword: true }` на регистрации и сбросе. Тест входа с пустым паролем.
- `low` → patch — таймер HIBP не снимался после быстрого ответа. `cancel()` чистит таймер.
- `low` → patch — проверка утечки шла до уникальности email/ника и задерживала «email занят». Теперь после локальной проверки занятости и до записи.
- `false` — смена пароля хеширует новый пароль до проверки текущего: это порядок Better Auth; путь `/change-password` в том же списке, тест хука его покрывает.
- `low` → patch — подсказки Storybook всё ещё говорили «8 символов».
- `low` → patch — решение в memlog PRD стояло выше более ранних записей. Перенесено в конец.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm test` -- expected: exit 0, включая новые тесты HIBP и `/api/auth/reset-password`
- `npm run lint` -- expected: exit 0
- `npm run build` -- expected: exit 0; если следом `node scripts/measure-web-size.mjs` превысит бюджет немного, поднять лимит в этом PR и записать величину в Implementation Notes
