---
title: '4.7.1: Схема InviteLink, миграция, домен и регистрация по приглашению'
type: 'feature'
created: '2026-11-16'
status: 'done'
route: 'dispatch'
baseline_commit: '4ec676a8750ca6873fe087b4fe8e398dc3e0d6c4'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** У пользователя нет ссылки-приглашения: новый человек не может стать другом в момент регистрации (FR-47, D-29, AD-21), а следующая подзадача 4.7.2 не сможет отдать ни токен, ни превью, ни исход «принять».

**Approach:** Модель `InviteLink` (один неизменный токен на пользователя) + SQL-миграция файлом. Правила приёма ссылки — чистый домен `domain/invite-link.ts` поверх существующего `FriendshipTransaction` (`lockPair`, `createFriendship`, `deleteInvitesBetween`), Prisma-адаптер и ленивая выдача токена — в `lib/invite-link-store.ts`. Регистрация создаёт `InviteLink` и, при валидном токене без блока, дружбу в той же транзакции, что User/List.

## Boundaries & Constraints

**Always:** Токен — `createId()`, immutable, один на пользователя (`userId` — PK). Невалидный токен и `Block` в любую сторону неотличимы (`NOT_FOUND`); self — `FORBIDDEN`. Приём — под `lockPair`. Регистрация с невалидным токеном или блоком успешна и дружбу не создаёт. AD-15-11: регистрация без `inviteToken` (в том числе с `next=/l/...`) дружбу и подписку не создаёт.

**Never:** Не читать и не писать `InviteCooldown`, не трогать `Subscription`, не делать backfill, не применять миграцию к БД, не подключаться к БД (Docker выключен), не добавлять API-маршруты, контракты превью, Next-страницу и UI — это 4.7.2–4.7.4. Не менять `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | viewer, живой токен, нет блока, дружбы нет | `ok: true, outcome: FRIENDS`, одно ребро пары, все `FriendshipInvite` пары удалены | — |
| ALREADY_FRIENDS | ребро пары уже есть | `ok: true, outcome: ALREADY_FRIENDS`, второго ребра нет, записей нет | — |
| SELF | `viewerId` — владелец токена | `ok: false, code: FORBIDDEN`, записей нет | 4.7.2 → 403 |
| BLOCK_EITHER | `Block` в любую сторону | `ok: false, code: NOT_FOUND`, ребра нет | тот же код, что неизвестный токен |
| UNKNOWN_TOKEN | токена нет | `ok: false, code: NOT_FOUND` | тот же код, что блок |
| PENDING_PAIR | pending-инвайты пары в обе стороны | при `FRIENDS` все удалены; `InviteCooldown` не тронут | — |
| PREVIEW_STATE | вошедший, токен | `self / friends / can_accept / not_found`, без единой записи | — |
| REG_BY_INVITE | регистрация + валидный `inviteToken` | User, List, InviteLink и Friendship в одной транзакции | ошибка дружбы откатывает регистрацию |
| REG_NO_TOKEN | без `inviteToken` (`next=/l/...`) | регистрация успешна, дружбы и подписки нет, InviteLink создан | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/db/schema.prisma` — модели `User` (добавить `inviteLink InviteLink?`) и новые `Friendship`/`Block`/`Subscription`/`InviteCooldown` как образец связей; `List` — образец `@unique`-токена.
- `apps/web/src/db/migrations/20261112130000_subscription/migration.sql` — стиль SQL (CreateTable, CreateIndex, AddForeignKey, комментарий-шапка).
- `apps/web/src/domain/friendship.ts` — `orderFriendPair`, `FriendshipTransaction` (`lockPair`, `hasBlockBetween`, `findFriendship`, `createFriendship`, `deleteInvitesBetween`, cooldown-методы **не вызывать**), `FriendshipStore`.
- `apps/web/src/domain/friendship.test.ts` — образец in-memory стора с `trace`/`writes`.
- `apps/web/src/lib/friendship-store.ts` — `transactionAdapter(tx)` (сделать экспортом), `friendshipStore`, `lockPair`, `hasBlockBetween`; `subscription-store.ts` — образец дублирования `hasBlockBetween`.
- `apps/web/src/lib/owner-list.ts` (+ `owner-list.test.ts`) — образец идемпотентного создания с P2002.
- `apps/web/src/actions/register.ts` (+ `register.test.ts`) — регистрация: `prisma.user.create` с nested `accounts`/`lists`, обработка P2002, `safeNextPath`.
- `packages/contracts/src/auth.ts` — `registerBodySchema` (+ `auth.test.ts`); `packages/contracts/src/index.ts` — реэкспорт.
- `apps/web/src/domain/index.ts` — реэкспорт домена (только существующие модули; новый не добавлять, чтобы не раздувать бандл).
- `apps/web/AGENTS.md` — правила Next.js 16 перед правкой `apps/web`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/db/schema.prisma` — модель `InviteLink { userId String @id, token String @unique, createdAt }` + `user User @relation(…, onDelete: Cascade)` и `inviteLink InviteLink?` в `User` — ER `User ||--o| InviteLink`.
- [x] `apps/web/src/db/migrations/20261116150000_invite_link/migration.sql` — DDL вручную по образцу соседей; сверить `prisma migrate diff --from-schema-datamodel … --to-schema-datamodel …` офлайн и `prisma validate`.
- [x] `apps/web/src/domain/invite-link.ts` — `InviteLinkOwner { id, displayName, nick }`, `InviteLinkReader/Transaction/Store`, `readInviteLinkState`, `acceptInviteLink`, `acceptInviteLinkInTransaction` — правила без Prisma.
- [x] `apps/web/src/domain/invite-link.test.ts` — все строки матрицы на in-memory сторе.
- [x] `apps/web/src/lib/friendship-store.ts` — экспортировать `transactionAdapter` — нужен регистрации.
- [x] `apps/web/src/lib/invite-link-store.ts` — `ensureInviteLink(userId)` (P2002 как в owner-list), `inviteLinkStore` (reader + `transaction`), `inviteLinkTransaction(tx)`.
- [x] `apps/web/src/lib/invite-link-store.test.ts` — идемпотентность, гонка, rethrow без строки.
- [x] `packages/contracts/src/auth.ts` (+ `auth.test.ts`) — необязательное `inviteToken` в `registerBodySchema` (только длина, без формата: плохой токен не должен ломать регистрацию).
- [x] `apps/web/src/actions/register.ts` (+ `register.test.ts`) — `$transaction` вокруг User/List/InviteLink/Friendship, тесты строк `REG_*`, AD-15-11 назван явно.

**Acceptance Criteria:**
- Given невалидный токен или блок, when регистрируется новый пользователь, then регистрация успешна, дружбы нет, ответ не отличается от регистрации без токена.
- Given валидный токен, when регистрация, then `Friendship` создана в той же транзакции, что `User`, `List` и `InviteLink`.
- Given `npm test -w @gift-list/web`, `npm test -w @gift-list/contracts`, `npm run typecheck`, `npm run lint`, when выполняются, then exit 0.

## Implementation Notes

- Выполнено 2026-11-16, ветка `evivanchikov/cle-73-invite`, база `4ec676a`.
- `ensureInviteLink(userId)` возвращает живой токен (созданный или существующий): 4.7.2 отдаст его в `GET /api/v1/me/invite-link` без второго чтения строки.
- `acceptInviteLinkInTransaction` принимает уже разрешённого владельца: регистрация резолвит токен в той же транзакции до вставки `User`, поэтому плохой токен не может сломать регистрацию. Ошибка вставки дружбы откатывает всю транзакцию — регистрация падает, аккаунта не остаётся (AD-21, «в той же транзакции»).
- `ALREADY_FRIENDS` ничего не пишет (ни ребра, ни «висящих» инвайтов пары): ссылка идемпотентна и не притворяется `acceptFriendInvite`. Это отличие от 4.2 записано в домене.
- AD-15-11 усилен на сервере: если `next` — ссылка на список (`safeNextPath` даёт `/wishlist/…`), `inviteToken` из тела игнорируется, даже если клиент его прислал.
- Владелец ссылки отдаётся как `{ id, displayName, nick }`: аватаров в DTO людей продукта нет (`BlockedPerson` и `listOwnerSchema` их не несут), поле `image` не добавлено.
- `domain/index.ts` не расширен: домен импортируется по прямому пути, новый модуль не тянет лишнего в бандл.
- `disposable-pg/*.pgtest.ts` не дописан: Docker Desktop выключен, кейс нельзя ни запустить, ни проверить — реальная гонка `ensureInviteLink` остаётся непроверенной на PostgreSQL (отмечено в отчёте).
- `sprint-status.yaml` не тронут (это 4.7.5), независимое ревью (шаг 04 `bmad-build`) не выполнялось — оно входит в 4.7.5 по плану координатора.

