---
title: '1.7 Слияние main в PR сброса пароля и dev-origins через env'
type: 'chore'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-7-сброс-пароля-по-email.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-cle-42-dev-origins-expo.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PR #18 (Story 1.7, CLE-40) отстал от `main` на CLE-41…CLE-44 и конфликтует в 9 файлах, поэтому CI GitHub Actions на нём не запускается. Вдобавок коммит «CORS для Expo web» кладёт в `trustedOrigins` `exp://`, `exp+giftlist://` и localhost-origins Expo web по `NODE_ENV`, а CLE-42 в `main` требует: в `trustedOrigins` только `giftlist://`, dev-origins — только из `AUTH_DEV_TRUSTED_ORIGINS` через `getEnv()`.

**Approach:** Влить `origin/main` в ветку PR, конфликты разрешить объединением (Resend/App Links-переменные и `AUTH_DEV_TRUSTED_ORIGINS` вместе, тесты обеих сторон). `trustedOrigins = ["giftlist://", ...AUTH_DEV_TRUSTED_ORIGINS]`; dev-CORS `/api/v1` в `proxy.ts` разрешает только `http(s)`-origins из того же `AUTH_DEV_TRUSTED_ORIGINS`, без захардкоженных портов и проверки `NODE_ENV`. Поведение сброса пароля не меняется.

</frozen-after-approval>

## Implementation Notes

- Решение (без вопросов к человеку): один список `AUTH_DEV_TRUSTED_ORIGINS` и для Better Auth, и для CORS — разработчик Expo web дописывает `http://localhost:8081`; второй переменной не вводим. Образец в `apps/web/.env.example` остаётся закомментированным.
- `proxy.ts` в Next 16 работает в Node.js runtime, `getEnv()` доступен.
- Конфликты: `auth.ts`, `env.ts`, `.env.example`, `auth.test.ts`, `env.test.ts`, `apps/mobile/package.json` (+`happy-dom`), `vitest.config.ts` (`.ts,tsx`), `form-issue.test.ts` (оба набора тестов), `deferred-work.md` (оба набора записей), `package-lock.json` (пересобрать `npm install`).
- Пуш в ветку PR — только с разрешения человека: ветка и карточка CLE-40 у другого автора.
- Сделано: `auth.ts` — версия `main` (`trustedExpoWebOrigins` и импорт `dev-cors` убраны). `dev-cors.ts` — вместо списка портов и `NODE_ENV` функция `allowedDevCorsOrigin(origin, devTrustedOrigins)`: только `http(s)`, точное совпадение (хвостовой `/` у записи срезается). `proxy.ts` зовёт `getEnv()` только при наличии `Origin`. `dev-cors.test.ts` переписан под env. `.env.example` — образец дополнен `http://localhost:8081`. `package-lock.json` — из `main` + `npm install`.
- Проверки: `typecheck`, `lint` (с `check-boundaries`), `build` зелёные. `npm test`: 1 падение — `auth.test.ts` «exposes handler…» по таймауту 5000 мс при параллельном прогоне на Windows (известный пункт `deferred-work.md` от CLE-42); файл отдельно — 5/5.
- После ревью: CORS снова выключен при `NODE_ENV=production` (proxy в проде выходит до `getEnv()`), совпадение origin точное, без нормализации; строка про Expo web в `README.md`.

## Review Triage Log

- `medium` → patch — слияние сняло прод-гард: при утечке `AUTH_DEV_TRUSTED_ORIGINS` в прод `/api/v1` отдал бы credentialed CORS. Вернул проверку `NODE_ENV=production` в `proxy.ts` и `allowedDevCorsOrigin`, тест.
- `medium` → patch (тот же корень) — `proxy.ts` звал `getEnv()` на каждый запрос с `Origin`, в проде кривая переменная дала бы 500 на всех записях. В проде proxy выходит до `getEnv()`.
- `low` → patch — хвостовой `/` срезался только для CORS, не для Better Auth. Нормализация удалена, совпадение точное.
- `low` → patch — README не говорил, что Expo web теперь надо прописать в `AUTH_DEV_TRUSTED_ORIGINS`. Строка добавлена.
- `low` reject — `https://` в списке получает CORS: после прод-гарда это только dev-машина разработчика.
- `false` — пункт `deferred-work.md` про `AUTH_DEV_TRUSTED_ORIGINS` устарел: после гарда CORS в проде не включается, риск прежний (только `trustedOrigins`).
- `low` reject — нет тестов на http-origin в `trustedOrigins` и на запрос без `Origin`: передача списка в `trustedOrigins` покрыта тестом CLE-42, ранний выход тривиален; прод-ветка теперь покрыта.
- `low` reject — дублирование setup env в тестах `env.test.ts` / `auth.test.ts`: косметика, наследие обеих сторон слияния.
- `false` — порядок скриптов в `apps/mobile/package.json` взят из `main` намеренно, чтобы не плодить diff с `main`.
- `low` reject — смешение языков комментариев в `.env.example`: каждая сторона слияния писала свой блок.
