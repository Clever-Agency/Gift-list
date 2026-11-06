---
title: 'Story 3.4.1: чтение профиля по нику (GET /api/v1/u/:nick)'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** в Story 3.4 нужен прямой вход в чужой профиль по `/u/:nick`, но сервер умеет читать список только владельцу (`/api/v1/me/gifts`) или по публичному токену (`/api/v1/l/:token`). Без отдельного чтения экран профиля (3.4.2) либо не получит карточку человека и желания по отношению, либо будет вынужден обойти единственный `readWishlist`.

**Approach:** добавить `GET /api/v1/u/:nick` — тонкий AD-12 адаптер над действием `getProfileByNick(nick, headers)`. Без сессии — `UNAUTHENTICATED` без тела желаний. Ник нормализуется существующим `normalizeNick` (AD-13) и ищется по `nickNormalized`; неизвестный, старый после смены, невалидный и путь со слэшем дают одинаковый `{ access: "not_found", gifts: [] }` без имени, email и желаний. Найденный пользователь читается только через `readWishlist({ viewer, target: { ownerId }, locale })` без `viaListToken`; ответ при `access: "gifts"` дополняется карточкой `{ displayName, nick }` из `User.name` и `User.nick`. `hideFromSearch` прямой профиль не прячет. Отношения приходят из порта `relationshipReader`: нет отношения — карточка и пустые желания, друг — PUBLIC и FRIENDS, подписчик и `ContactMatch` — только PUBLIC, владелец своего ника — все видимости включая SECRET, Block — тот же `not_found`, что у неизвестного ника. Ответ с `Cache-Control: private, no-store`; email, личные даты, `publicToken` чужому и число скрытых не отдаются. Таблицы дружбы и Block не создаются, кнопки Epic 4 не рисуются.

</frozen-after-approval>

## Implementation Notes

- Действие `getProfileByNick(nick, headers)` (`apps/web/src/actions/profile.ts`) — единственное место с сессией, нормализацией ника, локалью и вызовом `readWishlist`. Сначала сессия (без неё `UNAUTHENTICATED`), затем `normalizeNick` + `isValidNick`, затем поиск `User` по `nickNormalized` с выборкой только `id`, `name`, `nick`. `hideFromSearch` в запрос не входит.
- Желания читаются только `readWishlist({ viewer: { id: session.user.id }, target: { ownerId }, locale })`; `viaListToken` не передаётся, поэтому PUBLIC у зрителя без отношения не открывается. Block и отсутствующий список возвращают `not_found` из самого чтения.
- При `access: "gifts"` к ответу добавляется `owner: { displayName, nick }` из `User.name` и `User.nick`; ответ проходит через `listDataSchema.parse`. `not_found` остаётся строго `{ access, gifts }` без имени. Email и личные даты не выбираются; `publicToken` чужому не добавляется (его отдаёт только ветка владельца внутри `readWishlist`).
- Маршрут `apps/web/src/app/api/v1/u/[[...nick]]/route.ts` — тонкий AD-12 адаптер по образцу `/api/v1/l/[[...token]]`: один сегмент — ник, пустой путь, лишний сегмент и слэш внутри сегмента дают тот же `not_found`, не доходя до базы. `toResponse` ставит `Cache-Control: private, no-store`.
- Комментарии контракта `listDataSchema`/`listOwnerSchema` уточнены: блок `owner` теперь принадлежит и чтению по нику, а не только по токену.
- Отношения в тестах подменяются через мок `@/lib/relationships`; боевой `relationshipReader` не менялся и до Epic 4 отвечает «нет отношений». Таблицы дружбы, подписки и Block не создавались.
- Проверки: точечный Vitest (12 тестов маршрута + 38 смежных), `npm run typecheck` — exit 0, `npm run lint` — exit 0. Полные `npm test` и `npm run build` — зона 3.4.3.

