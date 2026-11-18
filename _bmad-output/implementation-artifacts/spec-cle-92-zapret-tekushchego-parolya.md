---
title: 'CLE-92: запрет текущего пароля при сбросе'
type: 'feature'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5d9663997b74c94c38ad4ed496b0bf8c5ec8f661'
context:
  - '{project-root}/_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-18-password-policy.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** По ссылке сброса можно задать тот же пароль, что уже стоит на аккаунте. Сергей (2026-11-18, CLE-92) запретил только текущий пароль: без истории хешей, без новой таблицы и без миграций. Это правка Story 1.7 / FR-3.

**Approach:** Перед записью нового пароля сервер сверяет его с действующим хешем через `ctx.password.verify`. Совпадение — `VALIDATION`, поле `password`, причина `PASSWORD_REUSED`, текст «Этот пароль уже используется. Выберите другой.» Ссылка сброса не гаснет. Та же сверка на сырых `POST /api/auth/reset-password` и `POST /api/auth/change-password`. Запрос «забыли пароль» не меняется.

## Boundaries & Constraints

**Always:**
- Сверка только через `ctx.password.verify({ password, hash })`. Свой хеш, сравнение строк хеша и логирование пароля или хеша запрещены.
- Проверка стоит в хуке `hash` Better Auth, который вызывается и из `auth.api.resetPassword`, и из сырых маршрутов, и строго до `consumeVerificationValue` (better-auth 1.7.14: хеш, затем транзакция с consume).
- На `/change-password` отказ `PASSWORD_REUSED` только после того, как `currentPassword` из тела подтверждён тем же `verify`. Неверный текущий пароль остаётся `INVALID_PASSWORD` и не сообщает, совпал ли новый с хранимым.
- Нет credential-хеша (первый пароль) — сверка пропускается.
- Причина едет тем же конвертом, что CLE-90, и показывается у поля на web и mobile (одна веб-сборка Expo и каталог `ru`).

**Never:**
- Таблица истории, миграция, подключение к Neon и к любой общей базе.
- Смена одинакового ответа forgot (AD-3) и проверка на входе или регистрации.
- Текст, который называет хеш, прежние пароли или факт существования email сверх уже открытой ссылки.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Совпадает с текущим | Живая ссылка, новый пароль проходит длину и HIBP и совпадает с хешем | `VALIDATION`, `field: password`, `reason: PASSWORD_REUSED`; токен на месте | Ссылка принимается повторно |
| Другой пароль | Та же ссылка, другой пароль | Пароль записан, ссылка погашена | N/A |
| Повтор после отказа | После `PASSWORD_REUSED` тот же токен и другой пароль | Успех | N/A |
| Сырой reset | `POST /api/auth/reset-password` с тем же паролем | 400, код `PASSWORD_REUSED`, токен не потреблён | Не обходит хук |
| Сырой change | Сессия, верный `currentPassword`, новый равен текущему | 400, `PASSWORD_REUSED`, хеш не меняется | Неверный `currentPassword` — не `PASSWORD_REUSED` |
| Forgot | Любой email | Прежний одинаковый ответ | AD-3 |

</frozen-after-approval>

## Code Map

- `apps/web/src/lib/hibp-password.ts` — хук `hash` уже видит путь (`tryGetCurrentAuthEndpointContext`) и бросает `APIError` до `originalHash`. Сюда встаёт сверка до HIBP. Не менять fail-open и список путей HIBP.
- `apps/web/src/lib/auth.ts` — `transaction: true`, `onPasswordReset`. Не закрывать `/reset-password` и `/change-password`: их держит хук.
- `apps/web/src/actions/password-reset.ts` — ловит коды Better Auth и кладёт `reason`. Добавить `PASSWORD_REUSED`. Forgot не трогать.
- `packages/contracts/src/index.ts`, `packages/contracts/src/i18n/ru/common.json` — закрытый `ERROR_REASONS` и текст. `i18n.test.ts` сверяет ключи.
- `apps/mobile/src/session/form-issue.ts` — без новой причины экран затирает её общим `VALIDATION`. `reset.tsx` уже рисует `issue.field === "password"` и `aria` живёт в `PasswordField`.
- `apps/web/src/lib/password-reset-tokens.ts` — гасит соседние ссылки только после успеха. Не звать из ветки отказа.
- Better Auth 1.7.14: `resetPassword` хеширует, потом `consumeVerificationValue`. `findCredentialAccount` ищет `userId` + `providerId: credential` + `accountId === userId` (так пишет `register.ts`). `changePassword` хеширует до проверки текущего пароля — поэтому сверку текущего делаем сами внутри хука.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-18-password-reuse.md` и правки FR-3, Story 1.7, AD-3, EXPERIENCE, memlog — курс утверждён Сергеем, ключи `sprint-status.yaml` не менять
- [x] `apps/web/src/lib/password-reuse.ts` + вызов из хука `hash` — `verify` до записи и до consume
- [x] `packages/contracts` и `form-issue.ts` — причина и русский текст у поля
- [x] `apps/web/src/actions/password-reset.ts` — маппинг кода, токен не тратится
- [x] Тесты: хук (совпал / не совпал / change только после верного текущего), action, сырой `/api/auth/reset-password` с повтором по той же ссылке, экран сброса (`describedBy` и `role="alert"`)

**Acceptance Criteria:**
- Given живой токен и пароль, равный текущему, when сброс идёт через action или сырой `/api/auth/reset-password`, then отказ `PASSWORD_REUSED` и тот же токен принимает другой пароль.
- Given смена пароля с верным текущим и тем же новым, when `POST /api/auth/change-password`, then отказ и хеш прежний; неверный текущий не получает `PASSWORD_REUSED`.
- Given экран нового пароля, when сервер вернул `PASSWORD_REUSED`, then у поля виден русский текст и он связан с полем доступно.

## Implementation Notes

- Сверка живёт в `rejectReusedPassword` и вызывается из хука `hash` до HIBP и до `originalHash`. На смене сначала `verify(currentPassword)`.
- Сырые маршруты покрыты `password-reuse-route.test.ts`: in-memory Prisma, HIBP замокан, без сетевой базы. Повтор той же ссылки другим паролем проходит; `/change-password` с неверным текущим не отдаёт `PASSWORD_REUSED`.
- Лимит web-бандла не поднимался: в клиент попала одна строка каталога, сборка CLE-90-бюджета хватило.

## Spec Change Log

## Review Triage Log

- high — `password-reuse.ts` читал токен через `??`, пустая строка в теле не падала в query, а Better Auth берёт `body.token || query.token`. Сырой сброс с `?token=` и `"token": ""` записывал текущий пароль и гасил ссылку. Исправлено: пустая строка считается отсутствием, добавлены запросы только с query и с пустым телом.
- false — токен только в query уже читался, когда в теле поля нет. Не было теста. Тест добавлен вместе с правкой пустой строки.
- low — ветки OTP и admin искали пользователя не тем ключом. Плагины не подключены, маршрутов нет. Ветки удалены, остались `/reset-password` и `/change-password`.
- false — `PASSWORD_COMPROMISED` до проверки текущего пароля на смене — порядок хука CLE-90, не эта задача. Записано в `deferred-work.md`.
- low — повторный `findVerificationValue` чистит просроченные строки. Окно — миллисекунды между проверкой Better Auth и хуком. Отдельный поиск добавил бы второй протокол. Не чинил.
- false — у смены нет экрана и конверта v1. Сырой маршрут отвечает кодом Better Auth, как `PASSWORD_COMPROMISED`. Экран сброса получает `PASSWORD_REUSED` через action.
- low — юнит смены принимал любой `APIError`. Сужен до кода `PASSWORD_REUSED`; при неверном текущем `verify` зовётся один раз и только с ним.
- false — совпадение с текущим сообщается раньше утечки. Матрица описывает пароль, который уже прошёл HIBP; для текущего пароля точнее «уже используется».
- false — формулировка «уже используется» утверждена Сергеем и записана в EXPERIENCE. Это не ошибка глобальной уникальности.
- false — `verify` на битом хеше бросает `Invalid password hash` без пароля и хеша. Ссылка не гаснет. Битый хеш в обычной работе не встречается.

## Design Notes

Хук `hash` — единственная точка, которую не обходят ни action, ни сырой маршрут. Бросок до `originalHash` не доходит до `consumeVerificationValue`, поэтому ссылка жива — так же, как уже жива при `PASSWORD_COMPROMISED`. На смене пароля Better Auth хеширует раньше, чем проверяет `currentPassword`; сверка «новый равен хранимому» до этой проверки была бы оракулом для сессии без знания текущего пароля. Поэтому сначала `verify(currentPassword)`, и только при успехе — `verify(newPassword)`.

## Verification

**Commands:**
- `npm test` — тесты сброса, хука, контракта и экрана зелёные; HIBP в тесте сырого маршрута замокан, база не настоящая
- `npm run typecheck` и `npm run lint` — без ошибок
- `npm run build` и замер бандла — серверная сверка не должна раздувать JS; если прирост в пределах небольшого текста каталога, лимит поднимается в этом же PR и называется в описании
