---
title: 'Story 4.1.1 R1 — сериализация пары при встречных приглашениях'
type: 'fixup'
created: '2026-11-06'
status: 'in-review'
route: 'dispatch'
baseline_commit: 'b1a29cc'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** в 4.1.1 две одновременные отправки A→B и B→A могли обе прочитать «встречного pending нет» и вставить по направленной строке `FriendshipInvite`. UNIQUE `(fromUserId, toUserId)` не сериализует пару: остаются два встречных pending, и следующий accept вынужден разбирать противоречивое состояние. Это нарушает AD-10, где пара заканчивается одним ребром `Friendship` или одним согласованным pending.

**Approach:** сериализовать все записи протокола одной канонической пары транзакционной блокировкой PostgreSQL `pg_advisory_xact_lock` по ключу `userLowId:userHighId`. Обе стороны берут один и тот же ключ до чтения Block/Friendship/инвайтов; вторая транзакция ждёт коммита первой, затем видит встречный invite и делает auto-accept. HTTP, экраны, Story 4.2 и создание Block не трогаем.

## Boundaries & Constraints

**Always:** блокировка берётся первой инструкцией транзакции, до чтения состояния; ключ строится из упорядоченной пары, поэтому направления совпадают; транзакция явно `READ COMMITTED`, чтобы после ожидания блокировки следующая инструкция увидела закоммиченный invite; порядок исходов и тексты 4.1.1 не меняются; Block остаётся только для чтения; миграция 4.1.1 накатывается только на одноразовую PostgreSQL.

**Never:** HTTP/UI, Story 4.2 (reject/cancel/cooldown), Story 4.5 (создание Block), подписка, уведомления, общая или боевая база, `.env`, push/PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| OPPOSITE_RACE | одновременные A→B и B→A, связей нет | один `INVITED`, один `FRIENDS_CREATED`; одна `Friendship` с `userLowId < userHighId`, 0 инвайтов | вторая транзакция ждёт lock |
| SAME_RACE | одновременные A→B и A→B | один `INVITED`, один `PENDING`; ровно одна строка инвайта | — |
| LOCK_HELD | другая транзакция держит lock пары | отправка не завершается, пока lock не отпущен; затем обычный исход | ожидание, не ошибка |
| BLOCKED / SELF / FRIENDS / REPEAT / COUNTER | как в 4.1.1 | прежние исходы без изменений | `FORBIDDEN` / no-op |
| CONSTRAINTS | обратная пара `Friendship`, дубль ребра, self-инвайт | CHECK / UNIQUE / CHECK отклоняют запись | PostgreSQL 23514 / 23505 |

</frozen-after-approval>

## Code Map

- `apps/web/src/domain/friendship.ts` — порт получает `lockPair(pair)`, `sendFriendInvite` берёт lock до чтений.
- `apps/web/src/lib/friendship-store.ts` — `pg_advisory_xact_lock(hashtextextended(...))` и явный `ReadCommitted`.
- `apps/web/src/domain/friendship.test.ts` — lock в памяти, одинаковые ключи направлений, сериализованные сценарии.
- `apps/web/src/db/disposable-pg/friendship.pgtest.ts` — реальная PostgreSQL: воспроизведение старой гонки, lock-wait, 10 раундов встречных отправок, ограничения.
- `apps/web/vitest.pg-friendship.config.ts`, `apps/web/package.json` — отдельный запуск `verify:friendship-concurrency`.

## Tasks & Acceptance

**Execution:**
- [x] `domain/friendship.ts` — добавить `lockPair` в `FriendshipTransaction`, вызывать до проверок.
- [x] `lib/friendship-store.ts` — advisory lock по канонической паре и `READ COMMITTED`.
- [x] `domain/friendship.test.ts` — проверки lock-порядка и сериализованных исходов.
- [x] `db/disposable-pg/friendship.pgtest.ts` + конфиг + npm-скрипт — доказательство на одноразовой PostgreSQL.
- [x] `4.1.1-R1-report.md` и `4.1.1-R1-pg-evidence-*.md` — отчёт с хешами, гейтами и свидетельствами.

**Acceptance Criteria:**
- Given одновременные встречные отправки, when обе проходят протокол, then остаётся одно ребро дружбы и ни одного pending.
- Given одновременные одинаковые отправки, when обе проходят, then остаётся ровно одна pending-строка.
- Given старая последовательность без lock, when чтения завершаются до вставок, then на реальной PostgreSQL воспроизводятся два встречных pending.
- Given ограничения миграции, when вставить обратную пару, дубль или self-инвайт, then PostgreSQL отклоняет запись.

## Implementation Notes

Механизм выбран самостоятельно: транзакционный advisory lock на каноническую пару. Он не требует новой таблицы и роста данных, работает на обычной PostgreSQL (AD-16), отпускается автоматически при commit/rollback и не меняет продуктовые исходы. READ COMMITTED закреплён явно, потому что при `REPEATABLE READ` транзакция сохранила бы снимок, взятый до ожидания блокировки.

## Verification

**Commands:**
- `npm exec -w @gift-list/web -- vitest run src/domain/friendship.test.ts` — 12 тестов.
- `npm run verify:friendship-concurrency -w @gift-list/web` — 5 проверок на одноразовой PostgreSQL.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.

**Limitations:** доказательство действительно только для одноразовой БД; создание Block (4.5) и accept (4.2) должны брать тот же ключ, когда появятся, иначе их гонка с отправкой остаётся вне этого исправления.
