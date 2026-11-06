# R2 / F10 — отчёт об устранении находки аудита

Дата: 2026-11-06
Ветка: `evivanchikov/story-24-25-auth-fixups`
База: `658ebdc` (`658ebdc0352e5450cc6e3081169eb970f93ffe2b`)
Коммит R2: `5557e57d1a1453d72051380710fa40240e206bfb`
Статус: R2 — `done`; R3/F6 — `planned-not-started`, код не менялся. R1 не переделывался.
Задача без истории Linear: микрозадача устранения находки независимого аудита, критерии продукта не меняются.

## Что было сломано

`normalizeWebOrigin` обещал «схема, хост и необязательный порт», но проверял строку как `^(https?:\/\/[^/?#\s]+)\/*$`. Класс `[^/?#\s]` исключал только `/`, `?`, `#` и пробельные символы, поэтому в authority проходило всё остальное, включая `@` (userinfo) и обратную косую черту. Значение возвращалось как есть и попадало в `wishlistShareLink` (`apps/mobile/src/wishlist/share-link.ts`), который собирает `{origin}/l/{token}`.

Последствия для явно заданного `EXPO_PUBLIC_WEB_ORIGIN` или `EXPO_PUBLIC_API_BASE_URL`:

| Вход | Было | Стало |
|---|---|---|
| `https://gift.example@evil.com` | принималось; браузер открывает `evil.com` | `""` |
| `https://user:pass@gift.example` | принималось; пароль в копируемой ссылке | `""` |
| `https://evil.com\@gift.example` | принималось; обратная косая меняет разбор authority | `""` |
| `https://gift.example`, `https://gift.example:8443`, `http://localhost:3000` | принималось | без изменений |
| `https://gift.example/`, `https://gift.example///` | срезались хвостовые слэши | без изменений |
| `https://gift.example/path`, `javascript:alert(1)`, `gift.example`, `https://` | `""` | `""` |

Дыра не открывалась для `window.location.origin`: origin страницы по спецификации не содержит userinfo. Источником был именно явно заданный env.

## Что исправлено

- `apps/mobile/src/config/env.ts`:
  - `WEB_ORIGIN` заменён на структурную проверку `^(https?:\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?)\/*$/i`: разрешены только `http(s)`, хост (DNS-имя/IPv4, `localhost`, IPv6 в скобках) и необязательный числовой порт; хвостовые слэши по-прежнему срезаются.
  - Порт дополнительно проверяется на диапазон 1…65535; `:0`, `:65536`, `:abc` и пустой порт отклоняются.
  - `@`, обратная косая черта, путь, query, fragment и другие схемы не проходят; негодное значение возвращает `""`.
  - `resolvePublicWebOrigin` не менялся: пустое значение по-прежнему переходит к следующему источнику, непустое негодное — нет; `Platform.OS`-guard для страничного origin не тронут.
- `apps/mobile/src/config/env.test.ts` — регрессии: userinfo (`host@evil`, `user:pass@`, `user@`, `@host`), обратная косая черта, нечисловой/пустой/внедиапазонный порт, `localhost` и IPv6, fail-closed для явного и API-значения.
- `apps/mobile/src/wishlist/share-link.test.ts` — атакующие origin дают `null`, то есть кнопка копирования не строит ссылку на чужой хост.
- `_bmad-output/implementation-artifacts/opencode-microtasks/audit-remediation-plan.md` — R2 отмечен `done` с фактическими гейтами; R3 остался `planned-not-started`.
- `_bmad-output/implementation-artifacts/spec-audit-r2-strict-web-origin.md` — BMAD-спека R2, `status: done`.

`wishlistShareLink`, формат `/l/<token>`, серверные ссылки по `BETTER_AUTH_URL`, контракты AD-12 и native-ветка не менялись. Production-хосты и порты не хардкодились, новых продуктовых правил нет.

## Гейты (фактические)

- Focused: `npm run test -w @gift-list/mobile -- src/config/env.test.ts src/config/env.web.test.ts src/wishlist/share-link.test.ts` — 3 файла / 31 тест, падений 0.
- `npm run typecheck` — код 0 (mobile, web с `prisma generate`/`next typegen`, contracts, ui).
- `npm run lint` — код 0, включая `node scripts/check-boundaries.mjs`.
- `npm test` — mobile 43 файла / 595, web 48 / 518, contracts 6 / 164, ui 14 / 81, 5 проверок границ; падений 0.
- `npm run build` — standalone-сборка Next.js успешна, Expo-web экспорт пересобран.

Живая БД не использовалась: изменение чисто клиентское и от PostgreSQL не зависит.

## Ограничения

- Хост принимается только в ASCII/punycode-форме: Unicode-домен и FQDN с точкой на конце (`gift.example.`) теперь отклоняются, хотя прежнее регулярное выражение их пропускало. Это fail-closed и вне критериев R2; при необходимости такие формы стоит задавать в env в punycode и без точки.
- Проверка структурная, а не через `new URL()`: на native `URL` ведёт себя по-разному в разных рантаймах, поэтому выбран переносимый regex. Совпадение с разбором браузера проверено только тестами на перечисленных примерах, не в живом браузере и не на устройстве.
- Реальный деплой и App Links не проверялись: изменение не выходит за пределы нормализации строки.
- Blind Hunter как отдельный длительный цикл не запускался по границам захода (bounded completion); после зелёных гейтов работа завершена.

## Что осталось

R3/F6 (`apps/mobile/src/platform/clipboard.ts`: `appendChild`/`select()` вне `try`) — `planned-not-started`, код не менялся. R1 не переделывался.
