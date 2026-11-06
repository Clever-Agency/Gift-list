---
title: 'Story 4.1.2 — api/v1 приглашение по нику и отношение в профиле'
type: 'feature'
created: '2026-11-06'
status: 'in-review'
route: 'dispatch'
baseline_commit: '7b3e19e5d993689100c7f9bc2a51380ea61a66b9'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** протокол 4.1.1 умеет отправлять приглашение только как доменная функция, у него нет HTTP-адаптера. Профиль по нику не отдаёт зрителю отношение, поэтому клиент Story 4.1.3 не может отличить «нет связи» от исходящего или входящего pending и от дружбы. Без закрытого DTO клиент начнёт придумывать собственные состояния.

**Approach:** добавить тонкий AD-12 адаптер `POST /api/v1/u/:nick/invite`. Цель берётся только из ника в пути и нормализуется тем же `normalizeNick`, что и `GET /api/v1/u/:nick`; тело произвольного `userId` не принимает. Успех возвращает закрытый исход 4.1.1. В `packages/contracts` добавить закрытые значения исхода и закрытое отношение зрителя. `getProfileByNick` добавляет отношение только в свой ответ; чтение по ссылке `/l/:token` и свой список его не получают. Блокировка остаётся `not_found` без карточки и имени.

## Boundaries & Constraints

**Always:** сессия как у остальных мутаций `api/v1`; Block в любую сторону и приглашение себе — `FORBIDDEN` без записи; неизвестный, старый или кривой ник — `NOT_FOUND` без имени; повтор pending и уже существующая дружба — `ok: true` (не ошибка); `Cache-Control: private, no-store`; `FRIENDS`-желания отсутствуют при pending и появляются после ребра `Friendship` через существующий `readWishlist` без `viaListToken`; протокол R1 с advisory lock и `READ COMMITTED` не меняется.

**Never:** произвольный `user id`, email, `publicToken` или счётчики в ответе; отношение в ответах `/l` и `/me`; новые `ERROR_REASONS` для успешных no-op; Story 4.2 (accept/reject, `InviteCooldown`), 4.3, 4.5 (создание Block), 4.6 (подписка), поиск, уведомления, `/i/:token`; UI-кнопка 4.1.3; полный приёмочный прогон 4.1.4; общая/боевая PostgreSQL, `.env`, push, PR, `main`, deploy.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| INVITED | связи нет, Block нет | `200 {ok:true,data:{outcome:"INVITED"}}`, одна pending-строка | — |
| PENDING | свой pending уже есть | `200 {ok:true,data:{outcome:"PENDING"}}`, второй строки нет | успешный no-op |
| ALREADY_FRIENDS | `Friendship` уже есть | `200 {ok:true,data:{outcome:"ALREADY_FRIENDS"}}`, записей нет | успешный no-op |
| FRIENDS_CREATED | встречный pending | `200 {ok:true,data:{outcome:"FRIENDS_CREATED"}}`, ребро и удаление пары инвайтов | успешный no-op |
| SELF | ник указывает на себя | `403 FORBIDDEN`, строк нет | отказ без `reason` |
| BLOCKED | `Block` в любую сторону | `403 FORBIDDEN`, строк нет | отказ без `reason`, имя не раскрывается |
| UNKNOWN / BAD NICK | нет пользователя или ник не по AD-13 | `404 NOT_FOUND` в конверте AD-12 | без имени, email и токена |
| NO SESSION | нет сессии | `401 UNAUTHENTICATED` | база не читается |
| PROFILE_NONE | профиль, связи нет | `relationship:"NONE"`, только PUBLIC | — |
| PROFILE_OUT | профиль, pending зрителя | `relationship:"OUTGOING_PENDING"`, FRIENDS-желаний нет | — |
| PROFILE_IN | профиль, pending владельца | `relationship:"INCOMING_PENDING"`, FRIENDS-желаний нет | — |
| PROFILE_FRIENDS | есть ребро | `relationship:"FRIENDS"`, FRIENDS-желания видны | — |
| PROFILE_BLOCKED | Block | прежний `not_found` без `relationship`, карточки и имени | — |
| LINK_AND_ME | `/l/:token`, `/api/v1/me/gifts` | поля `relationship` нет | — |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/friendship.ts` — закрытые исходы, DTO успеха, закрытое отношение профиля.
- `packages/contracts/src/index.ts` — реэкспорт и необязательное `relationship` только в ветке `gifts` у `listDataSchema`.
- `apps/web/src/lib/relationships.ts` — чтение отношения зрителя к владельцу профиля (Friendship + два направления `FriendshipInvite`).
- `apps/web/src/actions/friend-invite.ts` — use-case приглашения по нику: сессия, `normalizeNick`, резолв ника, вызов `sendFriendInvite`, маппинг в AD-12.
- `apps/web/src/actions/profile.ts` — добавляет `relationship` в ответ профиля после `readWishlist`.
- `apps/web/src/app/api/v1/u/[nick]/invite/route.ts` — тонкий POST-адаптер; остальные методы — `NOT_FOUND`.
- Тесты: `packages/contracts/src/friendship.test.ts`, `apps/web/src/actions/friend-invite.test.ts`, `apps/web/src/lib/relationships.test.ts`, `apps/web/src/app/api/v1/u/[nick]/invite/route.test.ts`, `apps/web/src/app/api/v1/u/[nick]/invite/route.action.test.ts`, обновления тестов профиля, `/l` и `/me/gifts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/friendship.ts` — `FRIEND_INVITE_OUTCOMES`, `friendInviteDataSchema`, `PROFILE_RELATIONSHIPS`, `profileRelationshipSchema` и типы.
- [x] `packages/contracts/src/index.ts` — реэкспорт; `relationship` только в `access:"gifts"`.
- [x] `apps/web/src/lib/relationships.ts` — `readProfileRelationship(viewerId, ownerId)`: FRIENDS → исходящий pending → входящий pending → NONE; сам/аноним без запросов.
- [x] `apps/web/src/actions/friend-invite.ts` — `sendInviteByNick`: сессия, ник, резолв, домен, маппинг; без `reason` у отказов.
- [x] `apps/web/src/actions/profile.ts` — `relationship` в ответе профиля; `not_found` без поля.
- [x] `apps/web/src/app/api/v1/u/[nick]/invite/route.ts` — POST-адаптер, тело не читается, прочие методы `notFoundResponse`.
- [x] Точечные тесты контрактов, use-case, отношения, профиля и маршрута; проверки отсутствия утечки в `/l` и `/me`.
- [x] `spec-4-1-2-api-invite-and-profile-relationship.md` и `4.1.2-report.md` — русские документы с хешами, гейтами и ограничениями.

**Acceptance Criteria:**
- Given A и B не друзья и Block нет, when A отправляет приглашение по нику B, then создаётся одна pending-строка, ответ `INVITED`, FRIENDS-желания B не видны.
- Given pending A→B, when A повторяет отправку, then второй строки нет и ответ `PENDING` с `ok:true`.
- Given `Friendship`, when A отправляет приглашение, then `ALREADY_FRIENDS` с `ok:true` и без записей.
- Given встречный pending B→A, when A отправляет, then `FRIENDS_CREATED`, одно ребро, инвайтов пары нет, FRIENDS-желания видны.
- Given Block в любую сторону или свой ник, when отправка, then `FORBIDDEN` и ни одной записи.
- Given неизвестный/кривой ник или нет сессии, when запрос, then `NOT_FOUND`/`UNAUTHENTICATED` без имени, email и токена.
- Given профиль по нику, when зритель связан с владельцем, then ответ содержит одно из `NONE`/`OUTGOING_PENDING`/`INCOMING_PENDING`/`FRIENDS`; при Block — прежний `not_found` без поля.
- Given ответ `/l/:token` или `/api/v1/me/gifts`, then поля `relationship` нет.

## Implementation Notes

- `POST /api/v1/u/:nick/invite` — тонкий адаптер: ник берётся только из одного сегмента пути, тело не читается. `sendInviteByNick` повторяет порядок `GET /api/v1/u/:nick`: сессия → `normalizeNick` → `isValidNick` → `User.nickNormalized` → `sendFriendInvite`.
- Отказы домена (`SELF_INVITE`, `BLOCKED`) сведены к одному `FORBIDDEN` без `reason`: новых `ERROR_REASONS` нет, клиент покажет общий текст кода.
- `FRIEND_INVITE_OUTCOMES` в контрактах совпадают по значениям с доменом 4.1.1. `PENDING` и `ALREADY_FRIENDS` — успешные no-op, не ошибки.
- `relationship` добавлено необязательным полем только в ветку `access:"gifts"` общей `listDataSchema`: этой же схемой пользуются `/l/:token` и `/me`, которые поле не добавляют. `not_found` его не принимает.
- `readProfileRelationship` читает ребро и два направления pending. Дружба имеет приоритет; R1 оставляет не более одного pending на пару. Block в это чтение не входит: `readWishlist` по-прежнему превращает его в `not_found`, и профиль отбрасывает отношение.
- `getProfileByNick` читает отношение и список параллельно, но добавляет поле только после успешного `readWishlist`; при `not_found` ответ остаётся прежним. Протокол R1 не менялся: адаптер вызывает тот же `sendFriendInvite` с тем же `friendshipStore`.

## Verification

**Commands:**
- `npm exec -w @gift-list/contracts -- vitest run src/friendship.test.ts src/index.test.ts` — 2 файла, 53 теста, exit 0.
- `npm exec -w @gift-list/web -- vitest run src/actions/friend-invite.test.ts src/lib/relationships.test.ts "src/app/api/v1/u/[[...nick]]/route.test.ts" "src/app/api/v1/u/[nick]/invite/route.test.ts" "src/app/api/v1/u/[nick]/invite/route.action.test.ts" "src/app/api/v1/l/[[...token]]/route.test.ts" "src/app/api/v1/me/gifts/route.test.ts" src/domain/friendship.test.ts src/actions/wishlist-friendship.test.ts` — 9 файлов, 87 тестов, exit 0.
- `npm exec -w @gift-list/mobile -- vitest run src/api/profile.test.ts src/profile/profile-route.test.ts` — 2 файла, 27 тестов, exit 0.
- `npm run typecheck` — mobile, web (`prisma generate`, `next typegen`, `tsc`), contracts, ui; exit 0.
- `npm run lint` — все workspace и `check-boundaries.mjs`; exit 0.

**Limitations:** живая PostgreSQL и полный `npm test`/`npm run build` не входят в 4.1.2; `InviteCooldown` и accept/reject — Story 4.2. Отдельного HTTP-прогона на одноразовой PostgreSQL нет: harness 4.1.1 проверяет доменный протокол, а 4.1.2 его не меняет.
