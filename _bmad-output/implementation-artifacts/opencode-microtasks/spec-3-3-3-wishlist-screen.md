---
title: 'Story 3.3.3: экран приложения /wishlist/[token]'
type: 'feature'
created: '2026-11-06'
status: 'review'
route: 'oneshot'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** после 3.3.2 ссылка `/l/:publicToken` открывает серверную страницу для анонима, а вошедшего уводит на `/wishlist/:token`, где до сих пор стоит заглушка: она только переводит анонима на вход и не читает список. Друг не может посмотреть PUBLIC и FRIENDS в приложении, а пустой список, закрытый гейт и ошибка сети не отличимы от заглушки.

**Approach:** заменить заглушку экраном, который для анонима уходит на `/login` с проверенным `next=/wishlist/{token}`, а для сессии читает `GET /api/v1/l/:token` через существующий `apiRequest` (cookie на вебе, bearer на телефоне). Экран рисует имя владельца, `@nick` и карточки из `@gift-list/ui`; видимость не пересчитывает — её уже применил `VisibilityPolicy` на сервере. Пусто — «Пока нет открытых желаний», `not_found` — «Список не найден», ошибка — существующие тексты и «Повторить». Битый сегмент даёт not-found без запроса и без редиректа.

</frozen-after-approval>

## Verification

**Commands:**
- `npm run typecheck` — без ошибок.
- `npm run lint` — без ошибок.
- `npm test` — все workspace-тесты и `check-boundaries` зелёные.
- `npm run build` — Expo web export, `next build` и standalone-ассеты завершились.

## Implementation Notes

- `apps/mobile/app/wishlist/[token].tsx` — экран вместо заглушки. Состояния: `loading` (3 skeleton с подписью «Загружаем вишлист»), `ready` (имя владельца, `@nick`, сетка карточек), `missing` (точная фраза «Список не найден»), `error` (`network` / `generic` с «Повторить» и toast). Сессия истекает во время чтения — `signOut` и вход с тем же безопасным `next` и `reason=session_expired`.
- `apps/mobile/src/wishlist/public-token.ts` — единственная проверка сегмента: непустой, ≤128 символов, без `/`, `\`, `?`, `#`, `%`, управляющих символов и `..`, и `safeNextPath('/wishlist/{token}')` возвращает ровно этот же путь. Отсюда берутся и `token` для API, и `next` для входа.
- `apps/mobile/src/api/public-wishlist.ts` — `fetchPublicWishlist` через `apiRequest` на `/api/v1/l/{encodeURIComponent(token)}`, разбор `listDataSchema`, без клиентской фильтрации видимости. Ответ `gifts` без `owner` считается тем же закрытым гейтом, как на странице Next.
- `apps/mobile/src/ui/public-gift-card.tsx` — карточка из `@gift-list/ui` (`WishCard`, `StatusPill`, `TagChipList`) без чипа видимости и без счётчика скрытых; карточка не нажимается, потому что публичного маршрута желания нет.
- `packages/contracts/src/i18n/ru/app.json` — в `app.wishlist` добавлены точные строки `notFound` и `emptyTitle`. Остальные тексты переиспользованы из `app.myWishlist` и `app.form`, второй формулировки нет.
- `apps/mobile/src/ui/empty-state.tsx` — `body` стал необязательным, как у `EmptyState` из `@gift-list/ui`: публичному пустому состоянию вторая строка не нужна.
- `apps/mobile/src/session/public-wishlist-screen.test.tsx`, `apps/mobile/src/api/public-wishlist.test.ts`, `apps/mobile/src/wishlist/public-token.test.ts` — экран, API-адаптер и проверка сегмента.

## Tests

- Экран: аноним не запрашивает API и уходит на вход с `next=/wishlist/tok_1`; битые сегменты не дают ни запроса, ни редиректа; имя/ник и все карточки из ответа видны; скрытое желание из фикстуры не появляется; пусто и `not_found` — точные разные фразы; ответ без владельца — закрытый гейт; skeleton с подписью; сеть, toast и «Повторить»; ответ не по контракту — общая ошибка.
- API: точный путь `/api/v1/l/tok_1`, `not_found`, отсутствие запроса для битого сегмента, проброс сетевой ошибки, отказ от тела вне контракта.
- Сегмент: безопасный путь и отказ для пустого, длинного, многосегментного, `?`, `#`, `%`, `\`, `.` и `..`.

## Review Triage Log

- Повторное использование маршрута с другим токеном могло на один кадр показать список прошлого владельца — исправлено: состояние `ready` хранит токен, а рендер показывает loading, пока токены не совпали.
- `token as string` внутри эффекта — убрано: токен зафиксирован в `currentToken` после проверки на `null`.
- Отдельная ветка `NOT_FOUND` от API — оставлена как страховка: сервер отвечает `ok: true, access: "not_found"`, но экран не должен падать, если адаптер когда-нибудь пробросит код.
- В `app.wishlist` остались неиспользуемые `title` и `toHome` от заглушки — не удалял: каталог не является кодом экрана, удаление не входит в микрозадачу.
- Публичная карточка не показывает видимость и не является кнопкой — соответствует `DESIGN.md` для `/l` и не даёт лишнего маршрута.
