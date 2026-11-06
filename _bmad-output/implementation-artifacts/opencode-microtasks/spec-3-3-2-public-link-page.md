# Спека 3.3.2: серверная страница `/l/[token]`

Микрозадача Story 3.3 / CLE-53. Только первый показ публичной ссылки в Next.js; экран приложения `/wishlist/[token]` — 3.3.3.

## Что сделано

- `apps/web/src/app/l/[token]/page.tsx` — серверная страница и `generateMetadata`.
- `apps/web/src/app/l/[token]/link-page.ts` — одно чтение на запрос: сессия, локаль, проверка сегмента, `readPublicWishlist`, метаданные.
- `apps/web/src/app/l/[token]/public-wishlist-view.tsx` — презентационный клиентский компонент (SSR в первом HTML) из `@gift-list/ui`.
- `apps/web/src/lib/public-token.ts` — проверка одного безопасного сегмента и единственный относительный адрес `/wishlist/{token}`.
- `apps/web/src/lib/request-locale.ts`, `apps/web/src/lib/link-page-headers.ts` — локаль из `Accept-Language` и заголовки ответа.
- `apps/web/src/proxy.ts`, `apps/web/src/app/layout.tsx`, `apps/web/next.config.ts` — `lang` у `<html>`, `Cache-Control`/`Vary`.
- Каталог `web.wishlist` в `packages/contracts/src/i18n/ru/web.json`; `EmptyState.body` стал необязательным.

## Решения

1. **Одно чтение.** Страница и `generateMetadata` используют `getLinkPage`, обёрнутый в `cache()` React. Это тот же `readWishlist`, что и в `api/v1`, с `viewer: null` и `viaListToken: true`; скрытые желания отсекает `VisibilityPolicy`, а не страница. Владельца даёт блок `owner` из 3.3.1.
2. **Сессия.** До рендера `auth.api.getSession` с заголовками запроса. Валидная сессия и валидный сегмент → `redirect` ровно на `/wishlist/{token}`. Цель строится из проверенного сегмента, а не из pathname, query, `Referer` или cookie; `safeNextPath` к `/l/...` не применяется. Невалидная cookie — это `null` от `getSession`, страница остаётся публичной.
3. **Плохой сегмент.** `.`, `..`, `/`, `\`, `%`, `?`, `#`, пустая строка и больше 128 символов — тот же `not_found`, что неизвестный токен. Проверка идёт до сессии и БД, редиректа нет.
4. **HTML.** `h1` (`display-sm`) — имя владельца, ниже `@nick` (`caption`). Карточки — `WishCard`/`StatusPill`/`TagChipList` из `@gift-list/ui`, без чипа видимости и без счётчика скрытых. Пусто — `EmptyState` «Пока нет открытых желаний». `not_found` — один `h1` «Список не найден», без отдельной фразы для Block.
5. **CTA.** «Куплю сам» (формулировка DESIGN.md и эпика) — `<a href="/wishlist/{token}">` только при `quantity === "SINGLE" && status === "OPEN"`. `aria-label` — «Куплю сам: {название}». Брони, подтверждения и дружбы нет (AD-21, Epic 5). У `UNLIMITED` и не-`OPEN` ссылки нет.
6. **Метаданные.** Только имя владельца и бренд: «Вишлист {name} — {brand}»; для закрытого гейта — «Список не найден — {brand}» и то же описание. Названия, цены, описания, фото и число скрытых не читаются. `not_found`, Block, мусорный токен и редирект дают одинаковые метаданные.
7. **Язык и кэш.** `requestLocale` = `negotiateLocale(preferredFromAcceptLanguage(...))`, иначе `ru`. Proxy помечает только `/l/*` внутренним заголовком; корневой layout берёт его для `lang`, остальные маршруты (включая админку) остаются `ru`. `next.config.ts` отдаёт `/l/:path*` `Cache-Control: private, no-store` и `Vary: Accept-Language`.
8. **Граница RSC.** `public-wishlist-view.tsx` — клиентский компонент, потому что корневой экспорт `@gift-list/ui` содержит хуки (`Dialog`, `BottomSheet`, поля). Данные и метаданные остаются на сервере; SSR отдаёт разметку и CSS Tamagui в первом HTML.

## Тесты

- `link-page.test.ts`: аноним видит только PUBLIC, имя и ник; Block и неизвестный список дают один `not_found`; сессия редиректит на `/wishlist/tok-1`; битый сегмент не редиректит и не читает БД; метаданные без скрытых названий.
- `public-wishlist-view.test.tsx`: SSR-разметка, имя/ник, CSS в ответе, точные фразы пустого и not-found, CTA только SINGLE+OPEN с относительным `href`.
- `public-token.test.ts`, `request-locale.test.ts`, `link-page-headers.test.ts`, `proxy.test.ts`: сегмент, цель редиректа, локаль, заголовки, отметка только `/l/*`.

## Ограничения

- DOM/React-тесты не доказывают реальные HTTP-заголовки и `lang` в браузере: это проверяет сборка/ручной запрос. `next build` в этой среде не завершился из-за внешних причин (Expo-зависимости и junction `node_modules`), а не из-за страницы; `next build --webpack` компилирует страницу, но упирается в уже существующие типы route handler'ов Next 16.
- Страница не проверяет дружбу и бронь: это политика сервера и Epic 5.
- Обновление 2026-11-06: корневая сборка исправлена в 3.3.3 заменой junction `node_modules` на локальный `npm ci`; на `577ddfe` `npm run build` — exit 0. Подробности — `3.3.3-report.md`.
