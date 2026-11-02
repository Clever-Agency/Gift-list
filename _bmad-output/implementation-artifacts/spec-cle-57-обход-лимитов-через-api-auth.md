---
title: 'Обход лимитов через /api/auth'
type: 'bugfix'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** После 5 запросов `POST /api/v1/password/forgot` (429) тот же IP получает ещё ответы 200 на `POST /api/auth/request-password-reset`, и письмо уходит. Встроенный лимитер Better Auth — память процесса и только в production (для сброса 3 за 60 с). `POST /api/auth/sign-in/email` так же проверяет пароль и открывает сессию мимо счётчика `POST /api/v1/session`. `POST /api/auth/sign-up/email` остаётся открытым рядом с регистрацией, хотя сырая регистрация уже запрещена (`disableSignUp`).

**Approach:** Expo и поток сброса ходят только в `/api/v1` и во внутренний `auth.api`. Сырые HTTP-пути `/sign-in/email`, `/sign-up/email` и `/request-password-reset` не отвечают (404) до лимитера и до обработчика. Внутренние `auth.api.signInEmail`, `requestPasswordReset`, `resetPassword`, `getSession` и `signOut` не меняются: вход, регистрация, письмо, ссылка `/reset?token=` и `POST /api/v1/password/reset` работают как сейчас. Остальные пути `/api/auth/*` (сессия, выход, `/ok`) не закрывать.

</frozen-after-approval>

## Implementation Notes

- Закрыты HTTP-пути Better Auth `disabledPaths`: `/sign-in/email`, `/sign-up/email`, `/request-password-reset`. Ответ — текст `Not Found` и 404, до лимитера в памяти и до обработчика. `auth.api.*` не менялся: вход, регистрация, письмо и `POST /api/v1/password/reset` идут как раньше.
- `1-7-сброс-пароля-по-email` в `sprint-status.yaml` уже `done`, это позже `in-progress` и `review`, статус не откатывался.
- Пункт `deferred-work.md` про `POST /api/auth/sign-in/email` зачёркнут.
- Сессия: `GET /api/auth/get-session` без cookie по-прежнему 200 и `null`; `GET /api/auth/ok` — 200. Ссылку сброса и `auth.api.resetPassword` не трогал.
- Ревью: комментарий у `disabledPaths` на русском; у закрытого пункта `deferred-work` evidence больше не описывает обход как открытый; проверка хвоста `/` смотрит тело и заголовки сессии.

## Review Triage Log

- `low` → patch — evidence закрытого пункта в `deferred-work.md` всё ещё описывал сырой вход как открытый обход. Текст заменён на факт закрытия.
- `false` — правки не закоммичены: коммит идёт следующим шагом, это не дефект кода.
- `false` — спека была `in-progress` без triage: так устроен oneshot до этого шага; статус выставлен `done`.
- `false` — в спеке CLE-56 строка `defer` остаётся записью того ревью. Живой трекер — `deferred-work.md`, пункт зачёркнут.
- `low` reject — нет теста, что `auth.api.signInEmail` и `requestPasswordReset` живы. `disabledPaths` срабатывает только в HTTP `onRequest` роутера Better Auth, не в `auth.api`. Вызовы из `signInUser` и `requestPasswordReset` не менялись, их тесты по-прежнему ждут `auth.api`. Живой вызов без БД — новый стенд, не правка на месте.
- `false` — `POST /api/auth/reset-password` не шлёт письмо и не тратит счётчики входа, регистрации и forgot. Токен гасит `auth.api.resetPassword` из `POST /api/v1/password/reset`. Intent оставляет прочие пути `/api/auth/*`.
- `low` → patch — запрос с хвостовым `/` проверял только статус. Тест теперь ждёт `Not Found` и пустые `set-auth-token` / `set-cookie`.
- `false` — реестр всех эндпоинтов Better Auth не нужен: счётчики Postgres обходят только три закрытых пути. Allowlist закрыл бы `get-session`, который Intent сохраняет.
- `low` → patch — комментарий у `disabledPaths` был на английском рядом с русским блоком про `trustedOrigins`. Переписан по-русски.
- `false` — `createsSession` для `/api/auth/*` старый: сломанное хранилище токена не блокирует вход. Этот дифф клиент не вызывает и не меняет.
- `false` — `peer-address` и спайн не в этом диффе. Спайн не правят мимо `bmad-architecture`.
- `false` — `sign-in.test.ts` без `consumeRateLimit` — покрытие CLE-56 в `session/route.test.ts`. `signInUser` не менялся.
- `false` — имя `REGISTER_LIMIT` общее для регистрации, входа и сброса ещё до этой задачи.
