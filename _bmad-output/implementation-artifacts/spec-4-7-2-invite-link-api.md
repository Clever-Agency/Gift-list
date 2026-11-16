---
title: '4.7.2: Контракты, API и клиент ссылки-приглашения'
type: 'feature'
created: '2026-11-16'
status: 'in-progress'
route: 'dispatch'
baseline_commit: '3d33f24903d7ee359256280f0d8f1f6b96e3a3fd'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Домен ссылки-приглашения и регистрация по токену готовы (4.7.1), но ни веб-, ни мобильный клиент не могут ни получить свою ссылку, ни показать превью `/i/:token`, ни принять приглашение вошедшим: у них нет ни контрактов, ни маршрутов `api/v1`, ни клиента.

**Approach:** Добавить в `@gift-list/contracts` закрытые схемы превью (`inviter` + необязательный `state` для вошедшего), DTO своей ссылки (`token`, URL собирает клиент — как у `/l`) и исходы accept (`FRIENDS | ALREADY_FRIENDS`); тонкие маршруты `GET /api/v1/me/invite-link`, `GET /api/v1/i/:token`, `POST /api/v1/i/:token/accept` поверх действий `actions/invite-link.ts` и существующего домена; клиент `apps/mobile/src/api/invite-link.ts`.

## Boundaries & Constraints

**Always:** Токен проверяется как один безопасный сегмент пути; невалидный сегмент и `Block` в любую сторону дают одинаковый `NOT_FOUND` (404, одно тело). Превью только читает (никаких записей на GET). Своя ссылка требует сессию; токен выдаётся лениво `ensureInviteLink`. Accept: сессия обязательна, self → `FORBIDDEN` без `reason`, повтор → `ALREADY_FRIENDS` (200), тело запроса не читается. Прочие методы маршрутов — `notFoundResponse` по образцу соседей. Ответы — через `toResponse` (AD-12). i18n, Next-страница `/i` и UI приложения — не трогать.

**Never:** Не менять домен, схему, миграцию, регистрацию (кроме теста маршрута, что `inviteToken` доходит до действия), PRD/UX/architecture/epics, `sprint-status.yaml`. Не подключаться к БД, не применять миграции, не ставить пакеты, не запускать Docker/Storybook/dev-серверы. Не отдавать анониму ник, если `/l` его не отдаёт; аватара в DTO нет — только `displayName` и `nick`, как в публичном DTO `/l`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| MY_LINK | сессия | `ok: true, { token }`, ленивое создание строки | — |
| MY_LINK_NO_SESSION | без сессии | `UNAUTHENTICATED` | 401, до `ensureInviteLink` |
| PREVIEW_ANON | аноним, живой токен | `inviter { displayName, nick }`, `state` отсутствует, ноль записей | — |
| PREVIEW_STATE | вошедший | `state: self / friends / can_accept` | — |
| PREVIEW_NOT_FOUND | невалидный сегмент, неизвестный токен, `Block` в любую сторону | одинаковый `NOT_FOUND` без имени | 404, одно тело |
| ACCEPT | вошедший, живой токен | `outcome: FRIENDS` | — |
| ACCEPT_IDEMPOTENT | уже друзья | `outcome: ALREADY_FRIENDS` | 200, ничего не пишется |
| ACCEPT_SELF | вошедший, свой токен | `FORBIDDEN` без `reason` | 403 |
| ACCEPT_NO_SESSION | без сессии | `UNAUTHENTICATED` | 401, до домена |
| REGISTER_TOKEN | `POST /api/v1/register` с `inviteToken` | токен доходит до действия без изменений | — |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/friendship.ts`, `block.ts` — образец закрытых исходов (`z.enum([...])`, `strictObject`), `index.ts` — блок реэкспортов.
- `apps/web/src/domain/invite-link.ts` — `readInviteLinkState` (только чтение), `acceptInviteLink` (транзакция, `FORBIDDEN`/`NOT_FOUND`), типы `InviteLinkOwner`, `InviteLinkState`.
- `apps/web/src/lib/invite-link-store.ts` — `ensureInviteLink` (живой токен), `inviteLinkStore` (reader + `transaction`).
- `apps/web/src/lib/public-token.ts` — `isPublicTokenSegment` (гейт одного сегмента, как у `/l`).
- `apps/web/src/actions/block.ts` — образец действия: сессия, закрытые отказы, `toBlockedCard`.
- `apps/web/src/lib/api-v1.ts` — `toResponse`, `notFoundResponse`, `parseJsonBody`.
- `apps/web/src/app/api/v1/l/[[...token]]/route.ts`, `apps/web/src/app/api/v1/me/blocks/route.ts`, `apps/web/src/app/api/v1/u/[nick]/block/route.ts` — образцы маршрутов и набора «прочих методов».
- `apps/web/src/app/api/v1/register/route.ts` (+ `route.test.ts`) — маршрут регистрации: тело уже проходит `registerBodySchema` с `inviteToken`.
- `apps/mobile/src/api/friend-invite.ts`, `block.ts`, `public-wishlist.ts` (+ tests) — образец клиента: `apiRequest`, `safeParse` контракта, `network`/`invalid`/отказ.
- `apps/web/src/actions/block.test.ts`, `.../u/[nick]/block/route.test.ts` — образцы моков сессии и маршрута.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/invite-link.ts` — `INVITE_LINK_STATES`, `inviteLinkInviterSchema`, `inviteLinkPreviewSchema`, `inviteLinkDataSchema` (`{ token }`), `INVITE_LINK_ACCEPT_OUTCOMES`, `inviteLinkAcceptDataSchema` — один закрытый словарь для обоих клиентов.
- [x] `packages/contracts/src/invite-link.test.ts` — закрытые наборы, `state` отсутствует у анонима, лишние поля отвергнуты, конверт AD-12.
- [x] `packages/contracts/src/index.ts` — реэкспорт новых схем и типов.
- [x] `apps/web/src/actions/invite-link.ts` — `getMyInviteLink`, `getInvitePreview`, `acceptInviteByToken` — сессия, гейт токена, маппинг домена на провода.
- [x] `apps/web/src/app/api/v1/me/invite-link/route.ts` — `GET` + `notFoundResponse` для прочих методов.
- [x] `apps/web/src/app/api/v1/i/[token]/route.ts` — `GET` превью, прочие методы как у `/l`.
- [x] `apps/web/src/app/api/v1/i/[token]/accept/route.ts` — `POST` без чтения тела.
- [x] `apps/web/src/actions/invite-link.test.ts` — строки матрицы на моках сессии/стора; проверка, что превью не зовёт `transaction`.
- [x] `apps/web/src/app/api/v1/me/invite-link/route.test.ts`, `.../i/[token]/route.test.ts`, `.../i/[token]/accept/route.test.ts` — статусы 401/403/404, одинаковое тело гейта, прочие методы.
- [x] `apps/web/src/app/api/v1/register/route.test.ts` — `inviteToken` доходит до `registerUser`.
- [x] `apps/mobile/src/api/invite-link.ts` (+ test) — `getMyInviteLink`, `getInvitePreview`, `acceptInvite`.

**Acceptance Criteria:**
- Given невалидный токен или `Block` в любую сторону, when `GET /api/v1/i/:token`, then 404 с одинаковым телом и без имени владельца.
- Given вошедший и свой токен, when `POST /api/v1/i/:token/accept`, then 403 `FORBIDDEN` без `reason`.
- Given `GET` превью, when он отвечает, then ни одной записи: транзакция и `ensureInviteLink` не вызываются.
- Given `npm test -w @gift-list/contracts`, `npm test -w @gift-list/web`, тесты mobile api, `npm run typecheck`, `npm run lint`, when выполняются, then exit 0; рост бандла в пределах бюджета или потолок поднят отдельным коммитом по правилу.

## Implementation Notes

- Выполнено 2026-11-16, ветка `evivanchikov/cle-73-invite`, база `3d33f24`. Коммиты: `feat(invite): invite link API and client (CLE-73)` и отдельный подъём потолка бандла.
- `GET /api/v1/i/:token`: аноним резолвит только владельца (`inviteLinkStore.findOwnerByToken`), вошедший идёт через `readInviteLinkState`. Гейт сегмента — `isPublicTokenSegment` (тот же, что у `/l`), поэтому невалидный токен не доходит до БД и не логируется.
- Превью пишется только в одном смысле: `getMyInviteLink` вызывает `ensureInviteLink` (ленивая выдача). Сам `GET /i/:token` транзакцию не открывает — проверено тестом действий (`store.transaction` не вызван, список записей пуст).
- `state` анониму не отдаётся (`inviteLinkPreviewSchema.state` необязательный); `not_found`, `self` и `Block` в домене уже разведены, действие только маппит `FORBIDDEN`→403 без `reason`, остальное →404.
- `inviteLinkDataSchema` содержит только `token`: URL собирает клиент, как `wishlistShareLink` для `/l` из `publicToken`.
- Аватара в DTO нет: в публичном `/l` его тоже нет — только `displayName` и `nick`.
- Клиент `apps/mobile/src/api/invite-link.ts` валидирует сегмент локально (тот же набор запрещённых символов и лимит 128) до запроса, как `block.ts`/`friend-invite.ts`; 4.7.4 может вынести общий `inviteRoute` для `next=/invite/{token}`.
- Регистрация: клиент регистрации живёт в `apps/mobile/app/(auth)/register.tsx`, а не в `src/api`, поэтому передача `inviteToken` — в 4.7.4; здесь только тест маршрута, что поле доходит до действия.
- Бюджет: прирост 181 184 → 181 409 (+225 байт gzip, превышение 161). Причина — barrel контрактов попадает в `__common-*.js` целиком; потолок поднят на минимальный шаг 1024 Б (181 248 → 182 272) отдельным коммитом.
- `sprint-status.yaml` не тронут (4.7.5), статус спеки оставлен `in-progress`: шаг 04 `bmad-build` (ревью) по плану координатора — в 4.7.5.

## Spec Change Log

## Review Triage Log

## Design Notes

- URL своей ссылки не отдаём: ссылка `/l` на клиенте строится из `publicToken` (`wishlistShareLink`), поэтому `/i` получает только `token`, а `https://{origin}/i/{token}` соберёт клиент тем же способом (4.7.4).
- Анонимному превью `state` не отдаётся: у него нет зрителя, а `self/friends/can_accept` — факты о зрителе.

## Verification

**Commands:**
- `npm test -w @gift-list/contracts` — все тесты passed.
- `npm test -w @gift-list/web` — все тесты passed.
- `npx vitest run apps/mobile/src/api/invite-link.test.ts -w @gift-list/mobile` — passed.
- `npm run typecheck`, `npm run lint`, `npm run build`, `node scripts/measure-web-size.mjs` — exit 0.
