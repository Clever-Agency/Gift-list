---
title: 'Story 4.1.1 — FriendshipInvite/Friendship/Block: схема и протокол отправки'
type: 'feature'
created: '2026-11-06'
status: 'in-review'
route: 'dispatch'
baseline_commit: 'dece5624fe67013dea51412c55f8efe26df621cd'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** в схеме нет таблиц дружбы, `relationshipReader` — заглушка «связей нет», поэтому `FRIENDS` никому не открывается, а протокол отправки приглашения (AD-10, ARCH-A12) не существует. Без него Story 4.1 не может создать приглашение и не может отличить друга от постороннего.

**Approach:** добавить в Prisma три таблицы (`FriendshipInvite`, `Friendship`, `Block`) с миграцией и реализовать отправку приглашения как чистую доменную функцию поверх транзакционного порта. Prisma-адаптер порта и настоящий `relationshipReader` живут в `lib`. HTTP, экраны и контракты не трогаем.

## Boundaries & Constraints

**Always:** Block проверяется внутри транзакции до любой записи; приглашение себе отсекается до обращения к базе. `Friendship` — одно ненаправленное ребро с канонической парой `userLowId < userHighId` и UNIQUE; `FriendshipInvite` — направленная пара с UNIQUE, pending = наличие строки, отдельного статуса нет. Встречный pending принимается одной транзакцией: одно ребро + удаление всех приглашений пары. `subscriber` и `contactMatch` остаются `false`; таблиц подписки и телефонной книги нет. Видимость `FRIENDS` решает только существующая `VisibilityPolicy`.

**Never:** маршруты `api/v1`, экраны и `packages/contracts`, правки `wishlist-read.ts`/`VisibilityPolicy`; `InviteCooldown`, `Notification`, `Subscription`, `ContactMatch`, `InviteLink`; запуск миграции против общей или боевой базы; подмена подписчика в тестах.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| SELF | `fromUserId === toUserId` | `ok:false, code:FORBIDDEN, reason:SELF_INVITE`; транзакция не начинается, строк нет | отказ, без записи |
| BLOCKED | `Block` в любую сторону | `ok:false, code:FORBIDDEN, reason:BLOCKED`; строк нет | отказ, без записи |
| FRESH | связи нет | `ok:true, outcome:INVITED`; ровно одна `FriendshipInvite(from→to)` | — |
| REPEAT | свой pending уже есть | `ok:true, outcome:PENDING`; второй строки нет | — |
| FRIENDS | `Friendship` уже есть | `ok:true, outcome:ALREADY_FRIENDS`; записей нет | — |
| COUNTER | встречный pending `to→from` | `ok:true, outcome:FRIENDS_CREATED`; одна транзакция: ребро с упорядоченными id + удалены все приглашения пары | — |
| READ_PENDING | `FRIENDS`-желание, есть только pending | `readWishlist` без `viaListToken` не отдаёт желание | `access:gifts, gifts:[]` |
| READ_FRIENDS | то же желание после ребра | `readWishlist` отдаёт `FRIENDS` и `PUBLIC`, не `SECRET` | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/db/schema.prisma` — модели `User`, `List`, `Gift`; сюда добавить три модели и обратные связи `User`.
- `apps/web/src/db/migrations/` — по одной папке на миграцию; образец ручных CHECK — `20261105120000_tags/migration.sql`.
- `apps/web/src/domain/friendship.ts` — сейчас пустая заглушка `export {}`; сюда протокол и типы.
- `apps/web/src/domain/visibility.ts` — `RelationshipReader`, `ViewerRelations`, `VisibilityPolicy`; менять не нужно.
- `apps/web/src/lib/relationships.ts` — заглушка чтения связей; заменить на Prisma-запросы.
- `apps/web/src/lib/relationships.test.ts` — сейчас требует «Prisma не трогать»; тест переписать под реальные запросы.
- `apps/web/src/actions/wishlist-read.ts` — единственное чтение списка; использует `relationshipReader` и `prisma` глобально, менять не нужно.
- `apps/web/src/actions/profile.ts` — профиль уже ходит через `readWishlist`; не менять.
- `apps/web/src/actions/my-gifts.test.ts` — мок Prisma без новых моделей; дополнить заглушками `friendship`/`block`.
- `apps/web/src/domain/index.ts` — реэкспорт чистых правил; добавить `friendship`.
- `apps/web/src/db/client.ts` — ленивый Prisma-клиент; в тестах подменяется через `vi.mock`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/db/schema.prisma` — добавить `FriendshipInvite`, `Friendship`, `Block` и обратные связи `User`; UNIQUE-пары и индексы.
- [x] `apps/web/src/db/migrations/20261106200000_friendship_protocol/migration.sql` — таблицы, UNIQUE, FK `Cascade`, CHECK на порядок пары и запрет self-пары.
- [x] `apps/web/src/domain/friendship.ts` — типы исхода, `orderFriendPair`, порт `FriendshipStore`/`FriendshipTransaction` и `sendFriendInvite` по матрице.
- [x] `apps/web/src/domain/index.ts` — `export * from "./friendship"`.
- [x] `apps/web/src/lib/friendship-store.ts` — Prisma-адаптер порта через `prisma.$transaction`.
- [x] `apps/web/src/lib/relationships.ts` — `friend` из `Friendship`, `blocked` из `Block` в любую сторону, `subscriber`/`contactMatch` — `false`.
- [x] `apps/web/src/domain/friendship.test.ts` — сценарии SELF…COUNTER на in-memory store с подсчётом транзакций и записей.
- [x] `apps/web/src/lib/relationships.test.ts` — friend, block в обе стороны, аноним/сам, порядок id, ложные `subscriber`/`contactMatch`.
- [x] `apps/web/src/actions/wishlist-friendship.test.ts` — READ_PENDING/READ_FRIENDS на in-memory Prisma-фейке через `readWishlist`.
- [x] `apps/web/src/actions/my-gifts.test.ts` — добавить в мок Prisma `friendship.findUnique` и `block.findFirst`.
- [x] `_bmad-output/implementation-artifacts/opencode-microtasks/4.1.1-report.md` — отчёт с хешами и кодами выхода.

**Acceptance Criteria:**
- Given нет связи, when A приглашает B, then одна pending-строка и `FRIENDS` не виден.
- Given pending A→B, when B приглашает A, then одна транзакция создаёт ребро с `userLowId < userHighId` и удаляет оба приглашения; после этого `FRIENDS` виден.
- Given Block в любую сторону или self, when отправка, then `FORBIDDEN` и ни одной записи.
- Given повторный вызов, when pending уже есть, then второй строки нет; given `Friendship`, then записей нет.

## Implementation Notes

- Схема и миграция добавлены без запуска против базы: `prisma validate` и `prisma generate` прошли, `prisma migrate` не вызывался.
- Протокол живёт в `domain/friendship.ts` без Prisma; транзакция — в `lib/friendship-store.ts` (`prisma.$transaction` с интерактивным клиентом).
- `relationshipReader` больше не заглушка: `friend` — строка `Friendship` по канонической паре, `blocked` — `Block` в любую сторону; для анонима и владельца база не читается.
- Полный прогон `npm test -w @gift-list/web` нашёл один старый мок без новых таблиц (`my-gifts.test.ts`) — мок дополнен, не код.
- Слои ревью BMAD не запускались по указанию микрозадачи («NO Blind Hunter»); проверены точечные тесты, полный набор тестов web, typecheck и lint.
- **R1 (2026-11-06):** гонка встречных отправок закрыта транзакционным advisory lock на каноническую пару; подробности — `spec-4-1-1-r1-pair-serialization.md` и `4.1.1-R1-report.md`.

## Design Notes

Порт `FriendshipStore` держит транзакцию снаружи домена: `domain/friendship.ts` остаётся без Prisma (AD-1), а адаптер в `lib` — единственное место, знающее `$transaction`. Возврат — закрытый union `{ok:true,outcome}` / `{ok:false,code:FORBIDDEN,reason}`; HTTP-конверт и значения для клиента появятся в 4.1.2.

## Verification

**Commands:**
- `npm exec -w @gift-list/web -- vitest run src/domain/friendship.test.ts src/lib/relationships.test.ts src/actions/wishlist-friendship.test.ts` — expected: все тесты зелёные.
- `npm test -w @gift-list/web` — expected: весь набор web зелёный.
- `npm run typecheck` — expected: exit 0.
- `npm run lint` — expected: exit 0.
- `npm exec -w @gift-list/web -- prisma validate` — expected: схема валидна; миграция на базу не накатывается.
