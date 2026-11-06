# Отчёт по fixup F10 — `EXPO_PUBLIC_WEB_ORIGIN` (Q-14)

Ветка: `evivanchikov/story-24-25-auth-fixups`, база на входе — `6dd05e2`.
Коммит с кодом, тестами, спекой и планом: `bb8c1ef` (`F10: derive the web public origin from the served page`). Отчёт добавлен следующим коммитом.

## BMAD

`uv` не был в `PATH`, но установлен в `C:\Users\Evgeniy\.local\bin\uv.exe` (0.13.6). Через него отрендерен `bmad-build`:

```text
uv run --no-cache "_bmad/scripts/render_skill.py" --project-root ... --skill ".agents/skills/bmad-build"
```

Маршрут — `oneshot`: изменение небольшое, необратимых действий нет. Ревью-слой `blind-hunter` запускался отдельным субагентом; его находки разобраны в `spec-f10-spa-public-origin.md` → `## Review Triage Log`. Код правился только по подтверждённым находкам, остальное записано как ограничения.

## Проблема и решение

В deploy-сборке Expo-web `EXPO_PUBLIC_WEB_ORIGIN` может отсутствовать, а `EXPO_PUBLIC_API_BASE_URL` в вебе законно пуст: сайт и API на одном домене (AD-26), запросы идут относительным путём. Тогда `getPublicWebOrigin()` возвращал `""`, `wishlistShareLink()` — `null`, и кнопка «Скопировать ссылку» всегда показывала ошибку.

Решение — без выдуманного домена и без зашитого localhost:

- `resolvePublicWebOrigin` сохранил порядок «явный `EXPO_PUBLIC_WEB_ORIGIN` → `EXPO_PUBLIC_API_BASE_URL` → origin текущей страницы».
- Новый запасной источник работает только на вебе: `Platform.OS === "web"` + наличие `window.location.origin`. React Native определяет `window` как глобальный объект, поэтому одной проверки `window` недостаточно.
- Origin страницы проходит тот же `normalizeWebOrigin`: только http(s)-origin без пути/query/fragment.
- Явно заданное неверное значение по-прежнему не подменяется — лучше ошибка, чем чужой хост.
- Native не изменился: страницы нет, нужна одна из env-переменных, пустое значение остаётся ошибкой.

`sync-spa.mjs` не менялся: он передаёт `process.env` в Expo, а `.env` грузит Expo CLI (в логе сборки — `env: load .env`). В локальной сборке из `apps/mobile/.env` побеждает `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`; в deploy без обеих переменных сработает origin страницы.

## Файлы

- `apps/mobile/src/config/env.ts` — origin страницы как последний источник, платформенная проверка, комментарий о неверном API-base.
- `apps/mobile/src/config/env.test.ts` — whitespace, пустой `pageOrigin`, «окно без location» (native-форма), отсутствие DOM.
- `apps/mobile/src/config/env.web.test.ts` (новый) — happy-dom, URL страницы задан явно, проверяется литерал; приоритет env → страница, неверный явный origin не откатывается.
- `apps/mobile/src/session/my-wishlist-screen.test.tsx` — без env на вебе копируется ссылка от текущего origin; неверный адрес даёт ошибку.
- `apps/mobile/.env.example`, `README.md` — когда переменная нужна, что делает веб-fallback, ограничения Metro `:8081` и preview-хоста.
- `_bmad-output/implementation-artifacts/spec-f10-spa-public-origin.md` — спека и триаж ревью.
- `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-plan.md` — статус F10.

`fixup-queue.md` обновлён, но оставлен вне коммита по условию пакета.

## Проверки (фактические)

| Команда | Результат |
| --- | --- |
| `npm test -w @gift-list/mobile -- src/config/env.test.ts src/config/env.web.test.ts src/wishlist/share-link.test.ts src/wishlist/copy-link.test.ts src/session/my-wishlist-screen.test.tsx` | 5 файлов, 97 тестов, 0 падений |
| `npm run typecheck` | успешно: mobile, web (prisma generate + next typegen + tsc), contracts, ui |
| `npm run lint` | успешно: web, mobile, contracts, ui + `check-boundaries` без ошибок |
| `npm test` | mobile 43 файла/590, web 46/489, contracts 6/164, ui 14/81; `check-boundaries` 5/5. Итого 1329 тестов, 0 падений |
| `npm run build` | успешно: Expo-web (14 бандлов), Prisma generate, Next.js 16.4.3 (15 страниц), standalone-ассеты |

В собранном `__common-*.js` виден запасной путь `window.location.origin`; локально он не выбирается, потому что API-base из `.env` задан.

## Ограничения

- Реальное копирование в браузере, Android и iOS не проверялось: нет браузерного стенда и устройства. Runtime-проверка остаётся за F6/F10.
- Деплой и preview-хост не проверялись; домен не выдумывался.
- Fallback верен только там, где SPA и `/l/*` на одном хосте. В `npm run mobile:web` страница — Metro `:8081`, `/l/*` там нет; для локальной копируемой ссылки нужен `EXPO_PUBLIC_WEB_ORIGIN=http://localhost:3000`.
- Ссылка с preview-деплоя ведёт на preview-хост, а не на будущий публичный домен.
- Серверные ссылки наружу (письма, приглашения) по-прежнему берут домен из серверной конфигурации (`BETTER_AUTH_URL`); этот fixup меняет только клиентскую сборку Expo-web.
- Если `EXPO_PUBLIC_API_BASE_URL` задан, но неверен, ссылка не собирается — осознанно, чтобы опечатка не уводила на чужой хост.

## F5: почему нет одноразовой PostgreSQL

Проверено в этом окружении (повторный безопасный probe, без запуска БД):

- Docker CLI есть: `C:\Program Files\Docker\Docker\resources\bin\docker.exe`, но движок не отвечает: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
- WSL: единственный дистрибутив `docker-desktop` в состоянии `Stopped`.
- `psql` и `pg_isready` в `PATH` отсутствуют.
- Службы Windows с именем `*postgres*` не найдены.

Поэтому F5 (Q-04) не начинался: развернуть одноразовую PostgreSQL не из чего, а mock-тесты доказательством не считаются. PostgreSQL не провижинилась, `migrate`/`seed` не запускались.

## Очередь

1. **F5 (Q-04)** — проверка миграций/сида/транзакций на одноразовой PostgreSQL; ждёт окружения.
2. **F9 (Q-13)** — `getMyGifts` без строки `List`; ждёт продуктового решения.

F5 и F9 не начаты. `main`, push, PR, merge, deploy, live DB, seed и migrate не трогались; настройки Vercel не менялись. `apps/web/AGENTS.md`, prompt/log-файлы и keyword-артефакты оставлены как были, вне коммитов.
