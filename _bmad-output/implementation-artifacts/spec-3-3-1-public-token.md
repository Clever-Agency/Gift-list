---
title: 'Story 3.3.1: публичное чтение списка по publicToken (GET /api/v1/l/:token)'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** в Story 3.3 нужен публичный вход в чужой вишлист по `/l/:publicToken`, но сервер умеет отдавать только свой список (`GET /api/v1/me/gifts`). Аноним и вошедший зритель не могут прочитать список по ссылке, а ответ списка не содержит имени и ника владельца: будущая страница `/l` и экран приложения иначе были бы вынуждены обойти единственное чтение `readWishlist` и заново решать видимость.

**Approach:** добавить `GET /api/v1/l/:token`, который читает только через `readWishlist({ viewer, target: { publicToken }, viaListToken: true, locale })`: зритель — сессия приложения или `null`, локаль — `negotiateLocale` от `Accept-Language`. При `access: "gifts"` ответ дополнительно содержит владельца `{ displayName, nick }` из `User.name` и `User.nick`; неизвестный, битый или заблокированный токен даёт одинаковый `not_found` без владельца и без желаний. `publicToken` по-прежнему получает только владелец, скрытые желания не читаются.

</frozen-after-approval>

## Verification

**Commands:**
- `npx vitest run apps/web/src/app/api/v1/l apps/web/src/actions/wishlist-read.test.ts apps/web/src/actions/my-gifts.test.ts apps/web/src/app/api/v1/me/gifts/route.test.ts packages/contracts/src/index.test.ts` — все тесты зелёные.
- `npm run typecheck` — без ошибок.
- `npm run lint` — без ошибок.

## Implementation Notes

- `readWishlist` (`apps/web/src/actions/wishlist-read.ts`) сам отдаёт владельца, когда чтение идёт по `publicToken`: в выборку `List` добавлены `owner.name` и `owner.nick`, блок `owner` попадает в оба ответа `access: "gifts"` (и в пустой, и в обычный). Владелец по-прежнему один получает `publicToken`; `not_found` не содержит ни владельца, ни желаний.
- Флаг `viaListToken` теперь учитывается только при `target: { publicToken }`: `/u/:nick` или `/me` не могут открыть `PUBLIC` из-за случайно переданного флага.
- Новое действие `getWishlistByToken(token, headers)` (`apps/web/src/actions/public-wishlist.ts`) — единственное место, где живут сессия, локаль и проверка формы токена. Маршрут `apps/web/src/app/api/v1/l/[[...token]]/route.ts` — тонкий AD-12 адаптер.
- Маршрут сделан опциональным catch-all намеренно: `/api/v1/l`, `/api/v1/l/`, лишний сегмент и `%2f`/`%5c` внутри сегмента попадают в тот же обработчик и получают тот же `not_found`, а не общий 404 `api/v1/[...slug]`. Токен в логи не пишется ни на одной ветке.
- HTTP-статус закрытого ответа — 200 с `ok: true, data: { access: "not_found", gifts: [] }`, как у всех gate-ответов AD-12; Block и неизвестный токен сравниваются побайтно в тесте.
- `HEAD` у маршрута не переопределён: Next выводит его из `GET`, как у `/api/v1/me/gifts`; остальные методы отдают общий `not_found`.
- Ограничение окружения: `node_modules` воркtree — junction на `D:\Clever\Gift-list\node_modules`, а `@gift-list/*` там указывали на другой чекаут. Для проверки созданы локальные junction `apps/web/node_modules/@gift-list/contracts` и `.../ui` на пакеты этого воркtree (в git не попадают); выполнен `prisma generate`.

## Review Triage Log

- `viaListToken` открывает PUBLIC и при `target: { ownerId }` — high, исправлено: флаг учитывается только при чтении по токену, добавлен обратный тест.
- `isTokenSegment` — denylist, `%00` и управляющие символы доходят до Prisma — low, не менял: план прямо запрещает придумывать более строгий синтаксис токена, реальные токены — CUID2; ответ на такой запрос всё равно без данных.
- Комментарий про `safeNextPath`/128 — false: в `contracts/src/auth.ts` токен сброса пароля ограничен `{1,128}`, ориентир назван верно по сути.
- `HEAD = notFoundResponse` отвечает 404 там, где GET даёт 200 — low, исправлено удалением экспорта: Next выводит HEAD из GET, как в соседнем маршруте.
- Нет `Vary: Accept-Language` — false: AD-27 и план для API требуют `Cache-Control: private, no-store`; `Vary` относится к странице 3.3.2.
- Локаль не покрыта тестом — low, отложено: `negotiateLocale` уже покрыт в `packages/contracts`, а подпись тега проверяется в тестах `readWishlist`.
- Ветка `allowed.length === 0` без проверки `owner` — medium, исправлено: тест «opens nothing without the viaListToken fact» теперь проверяет и владельца.
- `owner` выбирается и для `/me` — low, оставлено: один `select` проще условного, лишние два поля `User` не влияют на ответ.
- Неточная формулировка в комментарии контракта — low, исправлено: `owner` привязан к чтению по токену, а не к роли зрителя.
- `listOwnerSchema` не экспортирован, `min(1)` и `NICK_PATTERN` не заданы — low, отложено: страницы 3.3.2/3.3.3 возьмут тип из `ListData`; пустые имя и ник в БД невозможны по регистрации.
- Тест кодирует сегмент и передаёт сырой `params` — false: так и моделируется декодированный параметр Next; покрыты и `[]`, и лишний сегмент.
- Друг не проверяет отсутствие `publicToken` — low, исправлено: добавлена проверка ключа.
- Нет теста «токен не в логах» — low, отложено: в новом коде нет ни одного `console.*`; регрессию ловит ревью, отдельный spy-тест ценности не добавляет.
- Дубль константы `notFound` — low, оставлено: у действия и чтения разные зоны ответственности, импорт ради константы не оправдан.
- Локальный `owner`-boolean рядом с блоком `owner` — low, отложено: переименование затронуло бы существующий код без пользы для поведения.
- Ошибка Prisma отдаётся HTML 500, а не `infrastructureErrorResponse` — low, отложено: план не требует, у `/me` то же поведение; кандидат в `deferred-work.md`.
- Спека без отчёта и `sprint-status` в `backlog` — исправлено этим проходом.