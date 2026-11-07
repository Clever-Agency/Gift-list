---
title: 'Story 4.2.1: InviteCooldown и протокол записи принятия/отказа'
type: 'feature'
created: '2026-11-07'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 4.2 требует явного принятия и отказа от приглашения, но после Story 4.1 сервер умеет только отправлять инвайт и автоматически принимать встречный pending. Отказ нигде не запоминается, поэтому отправитель может повторить приглашение сразу, а явное принятие пришлось бы писать вторым протоколом с собственным insert ребра. Без доменного гейта и таблицы `InviteCooldown` HTTP-слой 4.2.2 не сможет ни показать «отклонено», ни запретить повтор раньше 24 часов (A-16, AD-10 п. 3).

**Approach:** добавить Prisma-модель `InviteCooldown` (каноническая пара `userLowId < userHighId`, UNIQUE, `until`, `rejectedFromUserId` — отправитель отклонённого инвайта) и файл миграции, не применяя его к базе. В домене `domain/friendship.ts`: вынести существующие шаги «одно ребро + удалить все инвайты пары» в одну функцию принятия, которую вызывают и встречный pending в `sendFriendInvite`, и новое явное `acceptFriendInvite`; добавить `rejectFriendInvite` только для получателя (удалить этот инвайт, записать cooldown до `now + 24h` UTC, без ребра); в `sendFriendInvite` после замка пары и проверки Block не создавать инвайт при живом cooldown и удалять просроченный cooldown в той же транзакции. Все три операции берут один и тот же `lockPair` первой командой транзакции на READ COMMITTED. Замок, Block, self-invite и отправка остаются прежними; HTTP, экран, Notification, создание Block и cancel 4.3 не входят.

</frozen-after-approval>

## Implementation Notes

- `apps/web/src/db/schema.prisma` — модель `InviteCooldown`: `userLowId`, `userHighId`, `rejectedFromUserId`, `until @db.Timestamptz(3)`, `createdAt`; `@@unique([userLowId, userHighId])`, `@@index([userHighId])`; три связи с `User` (`InviteCooldownLow`, `InviteCooldownHigh`, `InviteCooldownRejectedFrom`) с `onDelete: Cascade`.
- `apps/web/src/db/migrations/20261107120000_invite_cooldown/migration.sql` — аддитивная миграция: таблица, UNIQUE-индекс, индекс `userHighId`, три FK и два CHECK: `userLowId < userHighId` (тот же порядок, что `Friendship`) и `rejectedFromUserId IN (userLowId, userHighId)`. К базе не применялась; `prisma migrate diff --from-empty --to-schema` подтвердил совпадение имён таблицы, индексов и FK (exit 0).
- `apps/web/src/domain/friendship.ts` — порт `FriendshipTransaction` расширен `findInviteCooldown`, `createInviteCooldown` (upsert на пару), `deleteInviteCooldown`, `deleteInvite`. Принятие вынесено в одну функцию `acceptFriendPair`: одно ребро, удаление всех инвайтов пары, удаление cooldown. Её вызывают и встречный pending в `sendFriendInvite`, и явное `acceptFriendInvite`.
- `acceptFriendInvite({ fromUserId, viewerId })` — `viewerId` это сессия-получатель; принимается только pending `fromUserId → viewerId`, иначе закрытый `NOT_FOUND`. Block — `FORBIDDEN`. Ветка `ALREADY_FRIENDS` не вставляет второе ребро, но снимает устаревшие инвайты и cooldown пары.
- `rejectFriendInvite({ fromUserId, viewerId })` — только получатель: удаляет ровно этот инвайт, пишет одну строку cooldown с `until = now + 24h` и `rejectedFromUserId = fromUserId`, ребра не создаёт. Нет pending — `NOT_FOUND`; Block — `FORBIDDEN` без строки cooldown; self — `NOT_FOUND` без транзакции. Отмена отправителем не входит (4.3).
- `sendFriendInvite` — после `lockPair`, Block, проверки дружбы и собственного pending читает cooldown: живой (`until > now`) возвращает закрытый доменный отказ `{ ok: false, code: "RATE_LIMITED", reason: "INVITE_COOLDOWN", hours }`, где `hours = max(1, ceil((until - now) / 1h))`; просроченный удаляется в той же транзакции. Гейт стоит и перед auto-accept встречного pending, поэтому живой cooldown не даёт создать ребро даже при устаревшей встречной строке.
- `apps/web/src/lib/friendship-store.ts` — адаптер Prisma для новых методов: `findUnique`/`upsert`/`deleteMany` по `userLowId_userHighId`, `deleteMany` по направленному инвайту. Транзакция по-прежнему одна: `READ COMMITTED`, первый оператор — `pg_advisory_xact_lock(hashtextextended(low:high, 0))`; второго замка нет.
- Тесты: `apps/web/src/domain/friendship.test.ts` (in-memory порт) — принятие явное и встречное, один primitive, порядок id, cooldown до/после `until`, Block, self, не-получатель, отсутствие pending, сериализация reject+send одним замком; `apps/web/src/actions/wishlist-friendship.test.ts` — fake Prisma дополнен `inviteCooldown` и направленным `deleteMany`.
- Проверки: точечный Vitest 5 файлов / 61 тест — exit 0; `prisma validate` — exit 0; `prisma generate` — exit 0; корневой `npm run typecheck` — exit 0; корневой `npm run lint` — exit 0. Полные `npm test` и `npm run build` — зона 4.2.4.

## Review Triage Log

- Гейт cooldown стоял после auto-accept встречного pending — medium, исправлено: чтение cooldown перенесено до ветки встречного pending, добавлен тест «живой cooldown не даёт auto-accept».
- `rejectFriendInvite`/`acceptFriendInvite` не принимали актора, поэтому отправитель мог передать направление pending и снять свой инвайт — medium, исправлено: вход `{ fromUserId, viewerId }`, `viewerId` — сессия-получатель; self и обратное направление дают `NOT_FOUND`.
- `ALREADY_FRIENDS` в явном accept не снимал cooldown/устаревший инвайт — low, исправлено: ветка чистит строки пары, второго ребра не вставляет.
- Fake `inviteCooldown.upsert` игнорировал `update` — low, исправлено: существующая строка обновляется, новая вставляется.
- `sendInviteByNick` по-прежнему сворачивает `RATE_LIMITED` в `FORBIDDEN` — отложено: это провод 4.2.2, в 4.2.1 HTTP не меняется; доменный отказ уже содержит `INVITE_COOLDOWN` и `hours`.
- Замечаний к схеме и миграции нет: имена индексов/FK совпали с `prisma migrate diff`, CHECK-и повторяют инварианты `Friendship`; миграция аддитивная и не применялась.

