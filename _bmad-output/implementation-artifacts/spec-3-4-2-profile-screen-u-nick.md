---
title: 'Story 3.4.2: экран профиля /u/[nick] в приложении'
type: 'feature'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** после 3.4.1 сервер отдаёт чужой профиль по `GET /api/v1/u/:nick`, но в приложении нет маршрута `/u/[nick]`: открыть профиль по нику нечем, а без экрана Story 3.4 не даёт зрителю увидеть то, что ему открыто.

**Approach:** добавить в `apps/mobile` маршрут `app/u/[nick].tsx`. Аноним уходит на `/login` с проверенным `next=/u/{nick}` — тем же приёмом, что `/wishlist/[token]`. Вошедший читает только `GET /api/v1/u/:nick` через `apiRequest` и сам видимость не фильтрует. Экран рисует имя и `@nick`, желания — карточки `@gift-list/ui` без чипа видимости и счётчика скрытых; пусто — «Пока нет открытых желаний», `not_found` и Block — «Пользователь не найден». Ошибки, skeleton и «Повторить» — как на экране ссылки. Кнопок дружбы, подписки и блока нет (Epic 4), дат нет (Epic 7), поиска нет (Story 3.5).

</frozen-after-approval>

## Implementation Notes

- `apps/mobile/src/profile/profile-route.ts` — один проверенный сегмент ника: trim, нижний регистр (AD-13), `NICK_PATTERN` (3–24, `[a-z0-9_]`), затем `safeNextPath("/u/{nick}")` должен вернуть ровно этот путь. Помощник даёт `{ nick, next }` для API и для `next` при входе; `?`, `#`, `/`, `%`, dot-сегменты и невалидный ник отсекаются без запроса.
- `apps/mobile/src/api/profile.ts` — `fetchProfile(nick)` поверх `apiRequest`, разбор существующим `listDataSchema`. `not_found` остаётся `not_found`; `access: "gifts"` без блока `owner` — тот же закрытый ответ, что на экране ссылки, имя не выдумывается. Никакой фильтрации по `visibility` на клиенте.
- `apps/mobile/app/u/[nick].tsx` — экран по образцу `app/wishlist/[token].tsx`: skeleton `WishCardSkeleton` под `aria-busy`, ошибка сети/общая с «Повторить», `UNAUTHENTICATED` → `signOut` и тот же безопасный `next`, `not_found` → заголовок «Пользователь не найден». `ready` хранит ник, к которому относится ответ: смена параметра показывает skeleton, а не прошлый профиль. Желания рисует существующий `PublicGiftCard` (та же карточка `@gift-list/ui`, что на `/l` и `/wishlist`, без чипа видимости и счётчика).
- `packages/contracts/src/i18n/ru/app.json` — только новые ключи `profile.pageTitle`, `profile.notFound`, `profile.loading`; пустое состояние — существующий `app.wishlist.emptyTitle`, тексты ошибок и «Повторить» — существующие `app.myWishlist.*`.
- Тесты: `src/profile/profile-route.test.ts`, `src/api/profile.test.ts`, `src/session/profile-screen.test.tsx` (аноним, загрузка, карточка и `@nick`, отсутствие чипа видимости, пусто, `not_found`, сеть и повтор, смена ника, сессия истекла).
- Не трогать: `GET /api/v1/u/:nick` и его действия, `VisibilityPolicy`, `readWishlist`, экран `/wishlist/[token]`, `apps/web`, схему БД, `sprint-status.yaml` (история не `done`; статус — зона 3.4.3).
- Проверки: точечный Vitest по новым и смежным файлам, `npm run typecheck`, `npm run lint` с кодами выхода. Полные `npm test` и `npm run build` — зона 3.4.3.
- Решения по ходу: ник в пути нормализуется в нижний регистр до проверки: `/u/AnyA` и `/u/anya` дают один и тот же запрос и один и тот же `next`, как и серверное сравнение по `nickNormalized` (AD-13).
- Желания рисует существующий `PublicGiftCard`: это та же карточка `@gift-list/ui`, что на `/l` и `/wishlist`, без чипа видимости и счётчика скрытых; второй такой компонент не заводился.
- `sprint-status.yaml` не менялся: история не `done`, статус и полные гейты — зона 3.4.3. Ревью-слои (включая Blind Hunter) не запускались по указанию микрозадачи.

