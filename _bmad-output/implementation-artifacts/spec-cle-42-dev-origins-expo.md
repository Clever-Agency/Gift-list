---
title: 'CLE-42: dev-origins Expo в trustedOrigins через env'
type: 'chore'
created: '2026-11-01'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/web/src/lib/auth.ts` безусловно кладёт в `trustedOrigins` dev-origins Expo Go (`exp://`) и dev client (`exp+giftlist://`), поэтому они доверены и в проде; пункт `deferred-work.md` про dev-origins ещё открыт. Без истории (CLE-42), нужно к первому входу из Expo Go или dev client — Story 1.6; решения AD-3, AD-16.

**Approach:** Ввести необязательную `AUTH_DEV_TRUSTED_ORIGINS` в `envSchema` (список через запятую, trim, пустые отброшены, по умолчанию `[]`) и собирать `trustedOrigins = ["giftlist://", ...dev]` через `getEnv()`. Образец `exp://,exp+giftlist://` — в `apps/web/.env.example` с пометкой «только для разработки». Тесты в `auth.test.ts` (без переменной — только `giftlist://`, с переменной — плюс dev-origins) и в `env.test.ts` (парсинг). Закрыть пункт в `deferred-work.md`.

</frozen-after-approval>

## Implementation Notes

- Better Auth `matchesOriginPattern` (`dist/auth/trusted-origins.mjs`): для кастомной схемы шаблон без authority и пути (`exp://`) совпадает с любым `exp://host:port[/path]` той же схемы, `*` не нужен. Версию в worktree и логику сверяет проверка.
- `auth.ts` кэширует инстанс в `globalThis` вне прода; тесты должны сбрасывать этот кэш между случаями, иначе `vi.resetModules()` вернёт старые опции.
- Изменены: `apps/web/src/lib/env.ts` (`devTrustedOriginsSchema`, `AUTH_DEV_TRUSTED_ORIGINS` в `envSchema`), `apps/web/src/lib/auth.ts`, `apps/web/.env.example`, `auth.test.ts`, `env.test.ts`, `deferred-work.md`.
- Кэш в тестах: `globalThis.auth` удаляется в `afterEach` и перед импортом в новых тестах (типизированный cast, без `any`).

Ревью: образец в `.env.example` закомментирован, добавлены тест пустой строки и строка в README; отложенное — в `deferred-work.md`.

## Review Triage Log

- medium (patch): образец `AUTH_DEV_TRUSTED_ORIGINS` в `.env.example` был включён — при `cp` в прод dev-origins доверены; закомментирован.
- low (patch): нет теста пустой строки `AUTH_DEV_TRUSTED_ORIGINS=""`; добавлен.
- low (patch): README не упоминал переменную для входа из Expo Go/dev client; добавлена строка.
- maybe-false medium (defer): нет валидации значений и защиты в проде — `deferred-work.md`.
- medium (defer): `BETTER_AUTH_TRUSTED_ORIGINS` Better Auth в обход `getEnv()` — не вызвано этой правкой, `deferred-work.md`.
- maybe-false medium (defer): признак нативного клиента не учитывает `Origin: exp://` — сейчас клиент шлёт `expo-origin`, `deferred-work.md`.
- low (reject): устаревший `evidence` у закрытого пункта — формат закрытых пунктов сохраняет `evidence`.
- low (reject): повтор подготовки env в `auth.test.ts` — косметика.
- false: тест «тихо пройдёт» при переименовании ключа `globalThis.auth` — тест с переменной ждёт dev-origins и упадёт явно.
- false: в спеке нет Code Map/Verification — у oneshot-спеки эти разделы удаляются по шаблону.
