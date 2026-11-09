---
title: 'Story 4.2.2: HTTP принятия/отказа и cooldown в профиле'
type: 'feature'
created: '2026-11-07'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** После 4.2.1 домен умеет явно принимать и отклонять входящее приглашение и знает `InviteCooldown`, но HTTP этого не отдаёт: кнопкам на профиле некуда звонить, отказ нигде не виден, а живой cooldown на `POST /invite` сворачивается в общий `FORBIDDEN`. Профиль не сообщает, что приглашение отклонено и когда можно повторить (FR-14, A-16).

**Approach:** добавить два тонких POST рядом с существующим invite — `accept` и `reject` — с ником из одного сегмента пути и телом, которое не читается. Сессия обязательна, ник нормализуется как в `/u/:nick`. Домен 4.2.1 вызывается без второго протокола. В `packages/contracts` добавить `ERROR_REASONS.INVITE_COOLDOWN`, успешные DTO accept/reject, профильный DTO `inviteCooldown` и текст «Можно снова через {hours} ч». `sendInviteByNick` перестаёт сворачивать `RATE_LIMITED` в `FORBIDDEN`. `GET /api/v1/u/:nick` только в живом окне отдаёт `{ hours, rejected }`; `/l` и `/me` поле не получают.

## Boundaries & Constraints

**Always:** один доменный протокол 4.2.1 (`acceptFriendInvite`, `rejectFriendInvite`, `sendFriendInvite`), тот же `friendshipStore` с `lockPair` и READ COMMITTED; закрытые коды AD-12; `Cache-Control: private, no-store`; Block — `FORBIDDEN` без reason и без cooldown; не-получатель и отсутствующий pending — закрытый `NOT_FOUND`; старый/неизвестный ник — тот же `NOT_FOUND`; `hours` — целое ≥ 1, пока `until > now`; пока cooldown жив, `relationship` не `FRIENDS` и не `OUTGOING_PENDING`.

**Never:** UI 4.2.3, cancel 4.3, миграции, запись в базу из тестов, `.env`, секреты, общая/боевая PostgreSQL, push/PR/merge/deploy, второй протокол accept/reject, тело как источник личности, cooldown в `/l` и `/me`, `Notification`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Accept | pending A→B, B в сессии | `200 {ok:true,data:{outcome:"FRIENDS_CREATED"}}` | — |
| Accept уже друзья | ребро есть | `200 {outcome:"ALREADY_FRIENDS"}` | — |
| Accept без сессии | нет cookie | `401 UNAUTHENTICATED` | домен не зовётся |
| Accept не получателем / нет pending / старый ник | — | `404 NOT_FOUND` | без имени |
| Accept при Block | Block в любую сторону | `403 FORBIDDEN` | без `reason`, без cooldown |
| Reject | pending A→B, B в сессии | `200 {outcome:"REJECTED"}`, cooldown 24 ч | — |
| Reject не получателем | A в сессии | `404 NOT_FOUND` | домен не создаёт cooldown |
| Повтор invite в окне | cooldown `until > now` | `429 RATE_LIMITED`, `reason: INVITE_COOLDOWN`, `params.hours` | не `FORBIDDEN` |
| Профиль A | cooldown, `viewer = rejectedFromUserId` | `inviteCooldown:{hours,rejected:true}`, relationship `NONE` | — |
| Профиль B | cooldown, `viewer ≠ rejectedFromUserId` | `inviteCooldown:{hours,rejected:false}`, relationship `NONE` | слова «отклонено» нет |
| Профиль без окна | нет/просрочен | поля `inviteCooldown` нет | — |
| Block в профиле | Block | тот же `not_found`, поля нет | без утечки |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/index.ts` — `ERROR_REASONS`, `listDataSchema`; сюда добавляются reason и профильное поле.
- `packages/contracts/src/friendship.ts` — закрытые DTO отправки; рядом добавляются accept/reject и `profileInviteCooldownSchema`.
- `packages/contracts/src/i18n/ru/common.json` — каталог `errors.reason`; i18n-тест требует текст на каждый reason.
- `apps/web/src/domain/friendship.ts` — `acceptFriendInvite`, `rejectFriendInvite`, `sendFriendInvite`, `hoursUntil`; переиспользовать, не копировать.
- `apps/web/src/lib/friendship-store.ts` — единственный `$transaction`, `lockPair`, READ COMMITTED; не менять.
- `apps/web/src/lib/relationships.ts` — `readProfileRelationship`; рядом добавить чтение живого cooldown.
- `apps/web/src/actions/friend-invite.ts` — `sendInviteByNick`; рядом accept/reject и общий резолв ника.
- `apps/web/src/actions/profile.ts` — `getProfileByNick`; единственное место, добавляющее профильные поля.
- `apps/web/src/app/api/v1/u/[nick]/invite/route.ts` — образец тонкого POST; новые `accept/route.ts` и `reject/route.ts` рядом.
- `apps/web/src/app/api/v1/u/[[...nick]]/route.ts` — `GET /u/:nick`; не менять контракт метода.
- Тесты-образцы: `actions/friend-invite.test.ts`, `.../invite/route.action.test.ts`, `.../invite/route.test.ts`, `.../[[...nick]]/route.test.ts`, `lib/relationships.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/index.ts` — `INVITE_COOLDOWN` в `ERROR_REASONS`, `inviteCooldown` в ветку `access: "gifts"`, реэкспорт DTO.
- [ ] `packages/contracts/src/friendship.ts` — `FRIEND_ACCEPT_OUTCOMES`, `FRIEND_REJECT_OUTCOMES`, `friendAcceptDataSchema`, `friendRejectDataSchema`, `profileInviteCooldownSchema`.
- [ ] `packages/contracts/src/i18n/ru/common.json` — «Можно снова через {hours} ч».
- [ ] `apps/web/src/domain/friendship.ts` — экспортировать расчёт живых часов; send использует его же.
- [ ] `apps/web/src/lib/relationships.ts` — `readProfileInviteCooldown(viewerId, ownerId)`.
- [ ] `apps/web/src/actions/friend-invite.ts` — `acceptInviteByNick`, `rejectInviteByNick`, `INVITE_COOLDOWN` в `sendInviteByNick`.
- [ ] `apps/web/src/actions/profile.ts` — `inviteCooldown` и защита `relationship` в `getProfileByNick`.
- [ ] `apps/web/src/app/api/v1/u/[nick]/invite/{accept,reject}/route.ts` — тонкие POST.
- [ ] Тесты: contracts, action/route accept/reject, cooldown-маппинг invite, профиль A/B/Block/нет окна, отсутствие поля в `/me` и `/l`.

**Acceptance Criteria:**
- Given pending A→B, when B зовёт accept, then 200 `FRIENDS_CREATED` и домен вызван с `fromUserId=A`, `viewerId=B`.
- Given живой cooldown, when A повторяет invite, then 429 с `reason: INVITE_COOLDOWN` и целым `params.hours ≥ 1`, не `FORBIDDEN`.
- Given живой cooldown, when A открывает профиль B, then `rejected: true`; when B открывает профиль A, then `rejected: false` и те же часы.
- Given Block или неизвестный ник, when любой из маршрутов, then закрытый ответ без cooldown и без имени.
- Given `/me` или `/l`, when ответ, then поля `inviteCooldown` нет.

## Implementation Notes

- Профильный DTO: `inviteCooldown: { hours: number; rejected: boolean }`, присутствует только пока `until > now`; само присутствие отвечает на «жив ли». `rejected = viewerId === rejectedFromUserId`.
- Пока cooldown жив, `relationship` принудительно `NONE`: протокол не оставляет ребра/pending, а защита не даёт показать `FRIENDS`/`OUTGOING_PENDING` на несогласованных данных.
- `readProfileInviteCooldown` не ходит в базу для себя и анонима, как `readProfileRelationship`.
- Контракты: `FRIEND_ACCEPT_OUTCOMES = ["FRIENDS_CREATED","ALREADY_FRIENDS"]`, `FRIEND_REJECT_OUTCOMES = ["REJECTED"]`; `profileInviteCooldownSchema` — strict, `hours` целое ≥ 1. `INVITE_COOLDOWN` добавлен в `ERROR_REASONS`; i18n-тест требует текст на каждый reason, поэтому `errors.reason.INVITE_COOLDOWN` = «Можно снова через {hours} ч» добавлен сразу.
- Домен: расчёт `inviteCooldownHoursLeft`/`liveInviteCooldownHours` экспортирован; `sendFriendInvite` использует тот же расчёт, поведение 4.2.1 не изменилось.
- `sendInviteByNick`: доменный `RATE_LIMITED` остаётся `RATE_LIMITED`, получает `reason: "INVITE_COOLDOWN"` и `params: { hours }`; `FORBIDDEN` (self/Block) не изменился.
- Маршруты: `POST /api/v1/u/:nick/invite/accept` и `.../reject`; тело не читается, ник — один сегмент, сессия обязательна.
- `/l` и `/me` код не меняли; их route-тесты дополнены проверкой отсутствия `inviteCooldown`.

## Review Triage Log

- Blind Hunter пропущен по прямому указанию микрозадачи («prefer no Blind Hunter»). Самопроверка: проверены повтор ника в `sendInviteByNick`, отсутствие второго протокола accept/reject, закрытые ответы Block/404, отсутствие `inviteCooldown` в `/l` и `/me`, точность `hours ≥ 1`.
- Найдено и исправлено до коммита: i18n-каталог `errors.reason` обязан покрывать новый `INVITE_COOLDOWN`, иначе падает `i18n.test.ts`; текст добавлен.
- Найдено и исправлено до коммита: тест `readProfileInviteCooldown` брал `Date.now()` на этапе объявления, что могло сделать окно просроченным; время вычисляется внутри теста.
- Отклонено как не-дефект: `relationship` при живом cooldown принудительно `NONE` — так выполняется требование «не FRIENDS и не OUTGOING_PENDING»; штатный протокол и так не оставляет ребра/pending.
- Отложено: живой аудит на одноразовой PostgreSQL — 4.2.4; миграция `InviteCooldown` к базе не применялась.

## Verification

**Commands:**
- `npm test -w @gift-list/contracts` — exit 0, 7 файлов / 187 тестов.
- `npm exec -w @gift-list/web -- vitest run <11 точечных файлов>` — exit 0, 11 файлов / 152 теста.
- `npm run typecheck` из корня — exit 0.
- `npm run lint` из корня — exit 0.

