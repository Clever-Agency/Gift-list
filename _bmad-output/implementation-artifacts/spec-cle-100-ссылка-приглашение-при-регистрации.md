---
title: 'Ссылка-приглашение при регистрации'
type: 'bugfix'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
baseline_commit: '32fbf05c0c9db8a71cd89e9ba4a38f230aeeb954'
review_loop_iteration: 0
context:
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `GET /api/v1/me/invite-link` пишет `InviteLink` через `ensureInviteLink`, если строки нет. У новых аккаунтов ссылка уже создаётся при регистрации; у аккаунтов до Story 4.7 её нет до копирования.

**Approach:** Решение владельца: «ссылку-приглашение выдавай всем одинаково, сейчас только тестовые аккаунты». Один механизм: создание при регистрации в той же транзакции, GET только читает, ветки «старый аккаунт» нет. Существующим тестовым пользователям без строки — SQL-бэкфилл в новой миграции Prisma.

## Boundaries & Constraints

**Always:** `registerUser` создаёт `InviteLink` в той же транзакции, что User, List и Friendship; токен — `createId()`, не из ника. GET с сессией возвращает сохранённый `token` без записи. Контракт `{ token }`, клиент, превью и accept не меняются. Бэкфилл не переписывает чужой токен. `20261116150000_invite_link` не редактировать. К живым БД не применять.

**Never:** Не оставлять «если строки нет — создать» на GET, входе или POST. Не трогать seed. Не выводить токен бэкфилла из ника или `userId`. Не менять тексты, страницу `/i` и дружбу.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| REGISTER | новая регистрация | `InviteLink` в той же транзакции, токен CUID2 | P2002 email/nick откатывает транзакцию, как сейчас |
| GET_HAS_LINK | сессия, строка есть | `200 { token }` сохранённого токена, записей нет | — |
| GET_NO_SESSION | нет сессии | `401` до чтения `InviteLink` | без записи |
| GET_NO_ROW | сессия, строки нет | ни `create`, ни `update` | `findUniqueOrThrow`, без выдачи |
| BACKFILL | есть ссылка и нет | вставка только отсутствующих; известный токен тот же | повтор — no-op |
| PREVIEW | `GET /i/:token` | только чтение | `NOT_FOUND`, как сейчас |

</frozen-after-approval>

## Code Map

- `apps/web/src/actions/register.ts` `registerUser` ~111–113 — nested `inviteLink.create`. Не менять. Это уже проверяет `register.test.ts`.
- `apps/web/src/lib/invite-link-store.ts` `ensureInviteLink` ~28–47 — удалить. `inviteLinkTransaction` оставить.
- `apps/web/src/actions/invite-link.ts` `getMyInviteLink` ~50–56 — только чтение. Превью и accept не менять.
- `apps/web/src/app/api/v1/me/invite-link/route.ts` — убрать комментарий про ленивую выдачу.
- `schema.prisma` `InviteLink` ~113–124 — PK `userId`, unique `token`. Комментарий «всегда CUID2» поправить.
- `20261116150000_invite_link` и `invite-link-migration.test.ts` не ослаблять. Образец data-миграции: `20261106120000_fixed_tags_catalog`. `seed.ts`, `public-token.ts`, `copy-link.ts` не трогать.
- Тесты к замене: `invite-link-store.test.ts`, `actions/invite-link.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/db/migrations/20261118163100_invite_link_backfill/migration.sql` — `INSERT` `replace(gen_random_uuid()::text, '-', '')` для `User` без строки, `ON CONFLICT ("userId") DO NOTHING`. Без `UPDATE`/`DELETE`.
- [x] `apps/web/src/db/invite-link-backfill-migration.test.ts` — файл позже `20261116150000`; вставляет только отсутствующие; известный токен не меняет; другие таблицы не трогает.
- [x] `invite-link-store.ts` и его тест — `findUniqueOrThrow` по `userId`, `select: { token }`; нет строки — отказ без `create`.
- [x] `invite-link.ts` и `invite-link.test.ts` — `getMyInviteLink` только читает; без сессии не читает; превью не пишет.
- [x] Комментарии `route.ts` и модели — убрать «выдаётся лениво».

**Acceptance Criteria:**
- Given код после фикса, when ищешь создание `InviteLink` вне `registerUser` и миграции `20261118163100_invite_link_backfill`, then такой ветки нет.

## Implementation Notes

- `ensureInviteLink` удалён. `readInviteLinkToken` читает `findUniqueOrThrow` и ничего не пишет. Регистрация по-прежнему создаёт ссылку nested-записью.
- Бэкфилл — новый файл `20261118163100_invite_link_backfill`. Старый DDL не менялся. На одноразовом PostgreSQL 16 (loopback, каталог `/tmp`, затем удалён): пользователь без строки получил 32 hex, известный токен не изменился, повторный прогон вставил 0 строк. К живым БД не применялось.
- `typecheck`, `test` (mobile 1368, web 1273, contracts 324, ui 261, scripts 21), `lint`, `build` — exit 0 на Node 24.22.3.

## Spec Change Log

## Review Triage Log

- `low` reject — необработанный throw `findUniqueOrThrow` на `GET /api/v1/me/invite-link` не зовёт `infrastructureErrorResponse`, в отличие от каталога тегов. Строки после бэкфилла нет только при сломанном инварианте; клиент и так показывает один toast. Ловить ошибку — новая ветка, в обычном копировании её не видно.
- `medium` → patch — тест миграции сверяет подстроки сырого файла: выражение в комментарии, `ON CONFLICT DO UPDATE` и лишний предикат в `WHERE` его не роняют. Исполняемый SQL (без комментариев) должен фиксировать сам `INSERT`. Замечание про PostgreSQL 16 и 17 не противоречие: в заметках дизайна — кластер репозитория 17, в заметках реализации — этот прогон на 16; `gen_random_uuid` есть в обоих.
- `medium` → patch — тот же тест не отличает `DO NOTHING` в комментарии от `DO UPDATE` и не видит `TRUNCATE`. Та же дыра, что строка выше.
- `low` reject — коллизия `token` откатывает весь `INSERT`. Для тестовых строк `gen_random_uuid` это не повседневный случай; повтор по строкам усложняет миграцию, которую спека задала одним оператором.
- `false` — поддельный `RecordNotFoundError` не прячет запись: у `readInviteLinkToken` нет `catch`, а `create` в моке отсутствует и уронил бы тест. Описанного будущего `catch` на `P2025` в коде нет.
- `false` — заголовок 401 по-прежнему верен: без сессии токен не выдаётся. Список `writes` относится к методам превью; `getMyInviteLink` их не вызывает, а тест отсутствия строки проверяет, что действие пробрасывает отказ чтения.
- `false` — 32 hex проходит `isPublicTokenSegment` (длина, без `/`, `..` и `%2f`). Сужения сегмента до формы CUID2 в этом изменении нет.
- `low` reject — окно «код на Vercel раньше ручного `migrate deploy`» уже описано в `docs/deployment-environments.md`: миграция после мержа в `staging` и до проверки. Ленивую выдачу возвращать нельзя — это запрещено решением владельца.
- `low` reject — устаревшие номера строк в карте кода и узкий критерий приёмки правятся только в этой спеке.

## Design Notes

`gen_random_uuid()` есть в PostgreSQL 13+ (прогоны — 17). 32 hex проходит проверку сегмента; индекс `token` и `ON CONFLICT ("userId")` не дают вторую ссылку и не затирают выданный токен. Нет строки после бэкфилла — сломанный инвариант: `findUniqueOrThrow` ничего не пишет, клиент показывает один toast.

## Verification

**Commands:**
- `npm run typecheck && npm test && npm run lint && npm run build` -- expected: exit 0
- Одноразовая PostgreSQL до `20261116150000`, затем бэкфилл: у пользователя без ссылки появился hex-токен, известный не изменился, повтор no-op. Контейнер удалить.
