---
title: 'Story 3.3.1: публичное чтение списка по publicToken (GET /api/v1/l/:token)'
type: 'feature'
created: '2026-11-06'
status: 'in-progress'
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
