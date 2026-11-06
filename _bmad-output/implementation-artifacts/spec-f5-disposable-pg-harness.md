# Спека F5 — harness проверки на одноразовой PostgreSQL (Q-04)

Дата: 2026-11-06. Ветка: `evivanchikov/story-24-25-auth-fixups`, база `192918d`. Пункт очереди: **Q-04**. Статус: **harness готов, реальная PostgreSQL не проверена — окружение заблокировано** (см. `fixup-F5-report.md`).

## 1. Зачем

F1 добавил data-миграцию `20261106120000_fixed_tags_catalog`, но ни она, ни `20261105120000_tags`, ни CHECK-ограничения, ни транзакционные пути тегов не проверялись на реальной PostgreSQL: все доказательства — Prisma-моки. F5 требует одноразовую БД, но запускать `migrate`/`seed` против живой или общей БД запрещено. Harness фиксирует безопасный, повторяемый способ такой проверки, чтобы её можно было выполнить сразу после разблокировки окружения.

## 2. Границы

- Harness не входит в обычный `npm test` и CI: `vitest.config.ts` собирает только `src/**/*.test.{ts,tsx}`, а файл проверки называется `verify.pgtest.ts` и запускается отдельным конфигом.
- Harness не создаёт контейнер и не управляет Docker: он проверяет уже подготовленную одноразовую БД. Это осознанно — создание контейнера требует окружения, которого в этом заходе нет.
- Harness не читает `.env`, `DATABASE_URL` или `DIRECT_URL` как источник цели: только `DISPOSABLE_*`.
- Harness не меняет схему, миграции, сид, продуктовый код и документы планирования.
- Harness не является доказательством F5, пока не выполнен на реальной одноразовой PostgreSQL и его вывод не приложен к отчёту.

## 3. Безопасность цели

`resolveDisposableTarget()` отказывается работать, если:

| Проверка | Причина отказа |
|---|---|
| Нет `DISPOSABLE_DATABASE_URL` или `DISPOSABLE_DIRECT_URL` | `missing-database-url` / `missing-direct-url` |
| Схема не `postgres:`/`postgresql:` | `not-a-postgres-url` |
| Есть query-параметры или fragment | `query-parameters-not-allowed` |
| Нет пользователя или пароля | `user-required` / `password-required` |
| Хост `localhost` | `ambiguous-host` |
| Хост не `127.0.0.1` и не `[::1]` | `not-loopback` |
| Порт не задан или вне `49152`–`65535` (в частности, `5432`) | `dynamic-port-required` |
| Имя БД не `gift_f5_[a-z0-9_]{8,40}` | `unsafe-database-name` |
| `DATABASE_URL` и `DIRECT_URL` называют разные цели/учётки | `target-mismatch` |
| `DISPOSABLE_PG_CONFIRM` не равен имени БД | `confirmation-required` |

Дополнительно harness:

- перед первой миграцией проверяет, что в БД нет ни одной пользовательской таблицы, а `current_database()` и loopback-адрес сервера совпадают с целью;
- передаёт дочерним процессам `DATABASE_URL`/`DIRECT_URL` только на время запуска и указывает `DOTENV_CONFIG_PATH` на пустой файл, чтобы `prisma.config.ts` не взял цель из `apps/web/.env`;
- после `migrate deploy` повторно проверяет `current_database()` — доказательство, что миграция не ушла в другую БД;
- не печатает и не сохраняет пароль; доказательства пишутся без учётных данных.

## 4. Что проверяется на реальной БД

1. Применение `20261105120000_tags` и `20261106120000_fixed_tags_catalog`; обе записи в `_prisma_migrations` завершены, без rollback.
2. Каталог после миграции: `dream`, `need-now`, `someday` с русскими подписями.
3. Повторный `prisma migrate deploy` — no-op, история и каталог не меняются.
4. Двойной `prisma db seed` — идемпотентно, те же id, три строки.
5. `Tag_labels_object_check`: массив и `null` отклоняются (23514).
6. `GiftTag_shape_check`: нет ни `tagId`, ни непустого `customText`; пробельный текст; `aggregateEligible=true` без `tagId` — отклоняются (23514).
7. Уникальные индексы `Tag.slug`, `GiftTag(giftId, tagId)`, `GiftTag(giftId, customText)` — 23505.
8. `GiftTag_tagId_fkey` с `ON DELETE RESTRICT` — удаление используемого тега отклоняется (23503).
9. Вложенный `create` тегов вместе с желанием; несуществующий `catalogId` → P2003, желание не остаётся.
10. `$transaction`: откат обновления желания и вставки тегов; следующий коммит сохраняется.
11. `createMany`: вставка пачки и P2002 на повторной пачке.
12. Гонка двух вставок одного `(giftId, tagId)`: ровно один коммит, второй P2002, одна строка.
13. Гонка удаления тега и вставки `GiftTag`: хотя бы одна сторона отклонена, осиротевших строк нет.
14. Порядок тегов карточки: сначала фиксированные по `slug`, затем свои по тексту; подписи из `labels`.
15. Сохранение подписи ADMIN при повторном сиде и дозаполнение отсутствующей локали.

## 5. Файлы

- `apps/web/src/db/disposable-pg/guard.ts` — безопасный разбор цели.
- `apps/web/src/db/disposable-pg/guard.test.ts` — unit-тесты отказа/допуска; входят в обычный прогон.
- `apps/web/src/db/disposable-pg/verify.pgtest.ts` — проверки на реальной БД; только по явному запуску.
- `apps/web/scripts/require-disposable-pg.mjs` — preflight с понятным отказом до vitest.
- `apps/web/vitest.pg.config.ts` — отдельный конфиг, не пересекается с CI.
- `apps/web/package.json` — скрипт `verify:disposable-pg`.

## 6. Запуск (после разблокировки окружения)

```powershell
# 1. Поднять одноразовый PostgreSQL на уникальном loopback-порту, без общих volume.
#    Пример (выполняет человек, не агент): docker run --rm -d --name gift-list-f5 \
#      -e POSTGRES_PASSWORD=<одноразовый> -p 127.0.0.1:55432:5432 postgres:17
# 2. Создать новую пустую БД gift_f5_<random>.
# 3. Экспортировать ТОЛЬКО на процесс:
$env:DISPOSABLE_DATABASE_URL = "postgresql://postgres:<пароль>@127.0.0.1:55432/gift_f5_<random>"
$env:DISPOSABLE_DIRECT_URL   = $env:DISPOSABLE_DATABASE_URL
$env:DISPOSABLE_PG_CONFIRM   = "gift_f5_<random>"
npm run verify:disposable-pg -w @gift-list/web
# 4. Удалить только свой контейнер; env-переменные процесса не сохранять.
```

Успешный прогон создаёт `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-F5-evidence-<UTC>.md`; этот файл прикладывается к отчёту F5. Без реального прогона F5 остаётся незакрытым.

## 7. Известное ограничение

Сам harness на PostgreSQL **не запускался**: окружение Docker недоступно (VirtualMachinePlatform выключен, нужны права администратора и перезагрузка). Проверены только guard-тесты, preflight-отказы, типы и линт. Это ограничение зафиксировано в `fixup-F5-report.md` и не считается доказательством F5.
