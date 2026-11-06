---
title: 'F10: публичный origin веб-сборки без домена в коде (Q-14 fixup-queue; исходно Q-2)'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 1
context:
  - '{project-root}/apps/mobile/src/config/env.ts'
  - '{project-root}/apps/mobile/src/config/env.test.ts'
  - '{project-root}/apps/mobile/src/config/env.web.test.ts'
  - '{project-root}/apps/mobile/src/session/my-wishlist-screen.test.tsx'
  - '{project-root}/apps/mobile/src/wishlist/share-link.ts'
  - '{project-root}/apps/web/scripts/sync-spa.mjs'
  - '{project-root}/apps/mobile/.env.example'
  - '{project-root}/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Проблема:** в локальной и deploy-сборке Expo-web `EXPO_PUBLIC_WEB_ORIGIN` может отсутствовать, а `EXPO_PUBLIC_API_BASE_URL` в вебе законно пуст: сайт и API живут на одном домене (AD-26), запросы идут относительным путём. Тогда `getPublicWebOrigin()` возвращает пустую строку, `wishlistShareLink()` — `null`, и «Скопировать ссылку» всегда показывает ошибку (Q-14, F-2.4-2).

**Подход:** на вебе, если явный origin и API-base не заданы, публичным origin считается origin текущей страницы (`window.location.origin`): это тот же домен, который обслуживает SPA, без выдуманного домена и без зашитого localhost. Явно заданный, но неверный origin по-прежнему не подменяется. На native поведение не меняется: там нет страницы, источник — только env, пустое значение остаётся ошибкой. Образец env и README объясняют, когда переменная нужна.

</frozen-after-approval>

## Implementation Notes

- `env.ts`: `resolvePublicWebOrigin(configured, apiBase, pageOrigin?)` — порядок прежний (явный → `EXPO_PUBLIC_API_BASE_URL` → origin страницы). Третий источник появился только как запасной и проходит тот же `normalizeWebOrigin`.
- `readPageOrigin()` проверяет `Platform.OS === "web"`: React Native определяет `window` как глобальный объект, поэтому одной проверки `window` мало. На native и в Node `location` нет, результат остаётся `""`.
- `getPublicWebOrigin()` вызывает resolver с двумя аргументами; origin страницы подставляет значение по умолчанию в `resolvePublicWebOrigin`. Вызов ленивый (на нажатие), поэтому origin не вшивается в бандл.
- Явно заданный неверный `EXPO_PUBLIC_WEB_ORIGIN` или `EXPO_PUBLIC_API_BASE_URL` по-прежнему даёт `""` без отката: опечатка не должна уводить ссылку на другой хост. Это записано комментарием у ветки API-base.
- `my-wishlist-screen.test.tsx` (happy-dom) проверяет, что без env на вебе копируется ссылка от текущего origin; ошибка без адреса проверяется явно неверным значением.
- `env.web.test.ts` (happy-dom) фиксирует URL страницы `https://gift.example` и проверяет приоритет: env → origin страницы; неверный явный origin не откатывается. `env.test.ts` покрывает whitespace, пустой `pageOrigin`, «окно без location» (native-форма) и отсутствие DOM.
- Документация: `apps/mobile/.env.example`, `README.md`. `sync-spa.mjs` не менялся: он и так передаёт `process.env` в Expo, а `.env` грузит Expo CLI (в логе сборки — `env: load .env`).
- Известное ограничение: fallback верен только там, где SPA и `/l/*` на одном хосте. В `npm run mobile:web` страница — Metro (:8081), `/l/*` там нет; для локальной копируемой ссылки нужен `EXPO_PUBLIC_WEB_ORIGIN=http://localhost:3000`. Ссылка с preview-деплоя ведёт на preview-хост, а не на будущий публичный домен.
- Вне области: серверные ссылки наружу (письма, приглашения) по-прежнему берут домен из серверной конфигурации (`BETTER_AUTH_URL`), этот fixup меняет только клиентскую сборку Expo-web.

## Verification

**Commands:**
- `npm test -w @gift-list/mobile -- src/config/env.test.ts src/config/env.web.test.ts src/wishlist/share-link.test.ts src/wishlist/copy-link.test.ts src/session/my-wishlist-screen.test.tsx` — 5 файлов, 97 тестов, 0 падений.
- `npm run typecheck` — успешно, все 4 workspace.
- `npm run lint` — успешно, включая `node scripts/check-boundaries.mjs`.
- `npm test` — mobile 43/590, web 46/489, contracts 6/164, ui 14/81; плюс `check-boundaries` 5/5. Итого 1329 тестов, 0 падений.
- `npm run build` — успешно: Expo-web экспорт (14 бандлов), Prisma generate, Next.js 16.4.3 production build (15 страниц), standalone-ассеты. В собранном `__common-*.js` виден запасной путь `window.location.origin`.

**Manual checks:**
- Реальное копирование в браузере и на устройстве, деплой и preview-хост не проверялись: нет домена, браузерного стенда и устройства. Локальная проверка: `npm run build`, затем standalone-сервер, открыть `http://localhost:3000/`, нажать «Скопировать ссылку»; в локальной сборке побеждает `EXPO_PUBLIC_API_BASE_URL` из `apps/mobile/.env` (`http://localhost:3000`), поэтому проверяется только он.

## Review Triage Log

- `fixup-plan.md` не отражал F10 — **исправлено**: строка статуса и раздел F10 обновлены в этом коммите.
- `fixup-queue.md` не отражал Q-14 — **исправлено**: запись Q-14 дополнена статусом; файл остаётся вне коммита по условию пакета.
- Q-14 в fixup-очереди против Q-2 в PRD/эпиках — **уточнено**: заголовок и заметки говорят «Q-14 fixup-queue; исходно Q-2», ID очереди не переименован.
- `status: in-progress` — **исправлено**: `done`.
- В `context` не было тестов и документации — **исправлено**: добавлены.
- В `Verification` не было результатов — **исправлено**: записаны фактические прогоны.
- Смешение локальной сборки Next и Metro :8081 — **исправлено**: ограничение записано в spec, README и `.env.example`; добавлен локальный рецепт с `:3000`.
- `.env.example` не давал рецепта для Metro — **исправлено**.
- Противоречие в README о обязательности `EXPO_PUBLIC_*` — **исправлено**: правило и исключение переставлены.
- Неясный референт «страницы, которая её отдала» и отсутствие local caveat в README — **исправлено**.
- `apps/web/.env.example` без `EXPO_PUBLIC_*` — **false**: это серверный env (`apps/web`), переменные SPA живут в `apps/mobile/.env.example`; README теперь явно на него указывает.
- React Native определяет `window`, поэтому проверки `typeof window` мало — **исправлено**: добавлен `Platform.OS === "web"` и тест «окно без location».
- Тесты `resolvePublicWebOrigin` зависели от отсутствия `window` — **исправлено**: `pageOrigin` передаётся явно, no-DOM тест назван по случаю.
- Ожидаемое значение считалось тем же `normalizeWebOrigin` — **исправлено**: в happy-dom задан URL и проверяется литерал; экранный тест больше не импортирует helper.
- Неверный API-base блокирует fallback — **низкий, оставлено осознанно**: «задано, но неверно» не подменяется, иначе опечатка уводит ссылку на чужой хост; решение записано комментарием и тестом.
- Формулировка «передаёт origin страницы» — **исправлено**: описан default-параметр.
- Нет тестов на whitespace и пустой `pageOrigin` — **исправлено**.
- Preview/staging-хост не упомянут — **исправлено**: ограничение в spec и README.
- Серверные ссылки вне области — **исправлено**: записано в spec.
- Ручная проверка была невоспроизводимой — **исправлено**: добавлены команды и шаги.
- Runtime-проверка копирования остаётся за F10/F6 — **не выполнена**: нет браузерного стенда и устройства; отмечено в отчёте и `fixup-plan.md`, отдельных задач не заводилось.
