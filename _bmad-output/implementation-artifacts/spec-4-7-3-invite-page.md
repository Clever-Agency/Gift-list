---
title: '4.7.3: Серверная страница Next `/i/[token]`'
type: 'feature'
created: '2026-11-16'
status: 'done'
route: 'dispatch'
baseline_commit: '78e0954'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ссылка-приглашение `/i/:token` уже имеет домен (4.7.1) и API/клиент (4.7.2), но у человека без приложения ссылка открывается пустой: страницу `apps/web/src/app/i/[token]` никто не отдаёт. Превью мессенджера тоже пустое, а `/i/*` обязан обслуживать Next.js (AD-26), тогда как экран приложения живёт на `/invite/*`.

**Approach:** Серверная страница по образцу `/l/[token]` (Story 3.3): модуль логики `invite-page.ts` (гейт сегмента, сессия, превью через действие 4.7.2, мета-теги), клиентское представление на `packages/ui` с каркасом DESIGN (`next-header`, `next-panel`, Avatar-инициалы, `h1`, Primary и ghost-ссылки в приложение), `page.tsx` с `generateMetadata` и `redirect`. Только чтение: страница ничего не пишет.

## Boundaries & Constraints

**Always:** Один сегмент токена проверяется тем же гейтом, что у `/l`; невалидный сегмент и неизвестный токен — один закрытый `not_found` без имени. С сессией — сразу `redirect` на `/invite/{token}`, построенный из проверенного сегмента (никогда из сырого pathname). Аноним получает `next-header` (`BRAND_NAME`, справа «Войти» ghost), `next-panel` по центру, `h1` «{Имя} приглашает вас в друзья», body, Primary «Принять приглашение» → `/register?next=/invite/{token}`, ghost «У меня уже есть аккаунт» → `/login?next=/invite/{token}`, футер «Написать автору» и подпись агентства. Мета: title «{Имя} приглашает в друзья — {BRAND}», OG/Twitter по образцу `/l`; токен и ник в мета не попадают. Тексты — в `packages/contracts/src/i18n/ru/web.json` (namespace `web.invite`), UI — из `packages/ui`, `href` у `Button` — реальный `<a>`.

**Never:** Никаких записей на GET/HEAD/префетч (только действие превью 4.7.2). Не менять домен, схему, миграции, API-маршруты, экран приложения `/invite/[token]`, i18n приложения, PRD/UX/architecture/epics, `sprint-status.yaml`. Не подключаться к БД, не применять миграции, не ставить пакеты, не запускать Docker/Storybook/dev-серверы. Не делать нативные App Links (`/i/*`) — план п. 10.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PAGE_ANON | аноним, живой токен | серверный HTML каркаса: header, panel, `h1` с именем, body, две ссылки с `next=/invite/{token}`, футер; мета с именем | — |
| PAGE_REDIRECT | сессия, любой токен | `redirect('/invite/{token}')` из проверенного сегмента | до чтения превью |
| PAGE_NOT_FOUND | неизвестный токен | «Приглашение не найдено», без имени, тот же каркас; мета «Приглашение не найдено — {BRAND}» | закрытый ответ, 200 как у `/l` |
| PAGE_MALFORMED | `..`, `a/b`, `%2e%2e`, абсолютный URL | тот же `not_found` до сессии и БД | сегмент не логируется |
| NO_WRITE | любой GET/HEAD | ни транзакции, ни `InviteLink.create` | тест: мок записи не вызван |
| ROUTING | `/i/*` и `/invite/*` | `/i/*` — маршрут Next (`ƒ /i/[token]`), `/invite/*` — SPA-фолбэк | существующие тесты `spa-paths` |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/l/[token]/page.tsx`, `link-page.ts` (+ tests), `public-wishlist-view.tsx` — образец каркаса, мета-тегов, not found и передачи вошедшего в приложение.
- `apps/web/src/actions/invite-link.ts` — `getInvitePreview` (только чтение, 4.7.2).
- `apps/web/src/lib/public-token.ts` — `isPublicTokenSegment`, `wishlistPathForToken`; добавлен `invitePathForToken`.
- `apps/web/src/lib/link-page-headers.ts` — `LINK_PAGE_HEADERS` для `/l`; те же для `/i`.
- `apps/web/src/proxy.ts` (+ test), `src/lib/request-locale.ts` — язык публичной страницы из `Accept-Language`.
- `apps/web/src/lib/spa-paths.ts` (+ test) — `/i` уже в `NEXT_OWNED_PREFIXES`, `/invite` уже уходит в SPA.
- `packages/ui/src/button.tsx` (+ test, stories) — `href`: корень страницы-кнопки становится настоящим `<a href>`.
- `packages/contracts/src/i18n/ru/web.json` — namespace `web.invite`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/lib/public-token.ts` (+ test) — `invitePathForToken` с тем же гейтом, что у `/l`.
- [x] `apps/web/src/app/i/[token]/invite-page.ts` (+ test) — `InviteView`, `loadInvitePage`/`getInvitePage`, `buildInviteMetadata`.
- [x] `apps/web/src/app/i/[token]/invite-preview-view.tsx` (+ test) — каркас DESIGN, инициалы, две ссылки в приложение, футер.
- [x] `apps/web/src/app/i/[token]/page.tsx` — `generateMetadata`, `redirect` вошедшего.
- [x] `packages/contracts/src/i18n/ru/web.json` — `web.invite` (title, body, notFound, accept, haveAccount, signIn).
- [x] `packages/ui/src/button.tsx` (+ test, stories) — `href`, реальная ссылка на вебе, заблокированная кнопка остаётся `<button>`.
- [x] `apps/web/next.config.ts` — `LINK_PAGE_HEADERS` на `/i/:path*`.
- [x] `apps/web/src/proxy.ts` (+ test), `src/lib/request-locale.ts` — `/i/*` получает язык документа, как `/l/*`.

**Acceptance Criteria:**
- Given аноним и живой токен, when открывает `/i/{token}`, then серверный HTML: `h1` «{Имя} приглашает вас в друзья», Primary и ghost со ссылками `/register?next=/invite/{token}` и `/login?next=/invite/{token}`, футер «Написать автору».
- Given аноним и живой токен, when мессенджер читает мета, then title «{Имя} приглашает в друзья — {BRAND}», OG/Twitter без токена и ника.
- Given сессия, when открывает `/i/{token}`, then редирект на `/invite/{token}` без чтения превью.
- Given невалидный сегмент или неизвестный токен, when открывает страницу, then один текст «Приглашение не найдено» и мета «Приглашение не найдено — {BRAND}».
- Given любой GET страницы, when он отрисован, then ни одной записи в БД (тест).
- Given `npm test -w @gift-list/web`, `npm run typecheck`, `npm run lint`, `npm run build -w @gift-list/web`, when выполняются, then exit 0; рост бандла в пределах бюджета или потолок поднят отдельным коммитом по правилу.

## Implementation Notes

- Выполнено 2026-11-16, ветка `evivanchikov/cle-73-invite`, база `78e0954`. Коммит: `feat(invite): /i/:token preview page (CLE-73)`.
- `/i/*` уже был в `NEXT_OWNED_PREFIXES`, `/invite` уже уходил в SPA-фолбэк — правок `spa-paths` не потребовалось; страница в сборке — `ƒ /i/[token]`.
- Вошедший всегда получает `redirect`: своя ссылка, уже друзья и `Block` показываются экраном приложения `/invite/{token}` (план п. 7, как `/l` → `/wishlist/:token`). Поэтому на самой Next-странице ветка `Block` неотличима от неизвестного токена: сессия редиректит до чтения превью.
- Not found — HTTP 200 с текстом, как у `/l` (в `/l` нет `notFound()` и нет `not-found.tsx`); настоящий 404 потребовал бы отдельного `not-found.tsx` вне этой подзадачи.
- `page` вызывает `auth.api.getSession`, затем действие превью вызывает его ещё раз (как `/l`: страница проверяет сессию, `readPublicWishlist` читает через гейт). Двойной lookup сессии — цена переиспользования действия 4.7.2.
- Avatar — круг с инициалами из `$avatar-lg`/`$muted`/`$full` внутри страницы: в `packages/ui` компонента Avatar нет, в публичном DTO аватара нет; DESIGN описывает Avatar как «круг, инициалы на muted».
- `Button.href`: на вебе корень — `<a href role="link">` с тем же видом; заблокированная кнопка остаётся `<button>` и цель игнорирует; на телефоне якоря нет — навигацию отдаёт роутер (в 4.7.3 не используется).
- Потолок бандла не поднимался: прирост 181 409 → 181 640 (+231 байт gzip), запас 632 при `BUDGET_GROWTH_BYTES = 182 272`; 18 файлов JS, новых зависимостей/чанков нет.
