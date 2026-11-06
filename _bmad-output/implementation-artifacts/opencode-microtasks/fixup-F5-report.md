# F5 — проверка миграции/сида/транзакций на одноразовой PostgreSQL (Q-04)

Дата: 2026-11-06. Ветка: `evivanchikov/story-24-25-auth-fixups`, HEAD на входе `192918d`. Пункт очереди: **Q-04**. Статус: **заблокировано окружением (blocked-on-environment)**. Реальная PostgreSQL **не запускалась**, `migrate`/`seed` нигде не выполнялись, F5 **не проверен и не закрыт**.

## 1. Итог

Одноразовую PostgreSQL в этом заходе поднять нельзя без изменения прав Windows: Docker-движок не стартует, потому что компонент `VirtualMachinePlatform` выключен и его включение требует администратора и перезагрузки. Такое изменение в задаче не авторизовано, поэтому вместо ложного «пройдено» подготовлен безопасный harness и зафиксирован точный блокер.

Что это означает для F5:

- доказательств на реальной БД по-прежнему нет; все прежние проверки тегов остаются mock-only;
- F1 (data-миграция каталога) на PostgreSQL не подтверждён;
- после разблокировки окружения проверка выполняется одной командой, но её результат ещё нужно получить и приложить.

## 2. Точный блокер (фактические пробы)

Все пробы ниже — только чтение состояния; настройки Windows, WSL и Docker не менялись.

| Проба | Фактический результат |
|---|---|
| `docker version` | Клиент 27.3.1, контекст `desktop-linux`; сервер не отвечает. |
| `docker info` (таймаут 10 с) | `error during connect: ... open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.` |
| `wsl --status` / `wsl --list --verbose` | WSL установлен; дистрибутив `docker-desktop` в состоянии `Stopped`, версия 2. |
| `wsl -d docker-desktop -e /bin/true` (одна ограниченная попытка, без `--shutdown`/`--reset`/`--update`) | `Wsl/Service/CreateInstance/CreateVm/HCS/0x80070032`, exit `-1`; дистрибутив остался `Stopped`. |
| `Get-CimInstance Win32_OptionalFeature` | `VirtualMachinePlatform` = 2 (**Disabled**), `HypervisorPlatform` = 2 (Disabled), `Microsoft-Hyper-V-All` = 2 (Disabled), `Microsoft-Windows-Subsystem-Linux` = 1 (Enabled). |
| `Win32_ComputerSystem.HypervisorPresent` | `False`; `VirtualizationFirmwareEnabled` = `True` (виртуализация в прошивке есть, но гипервизор Windows не активен). |
| Службы | `vmcompute` — Running; `HvHost`, `LxssManager`, `com.docker.service` — Stopped. |
| `psql`, `pg_isready`, `pg_ctl`, `initdb`, `postgres` | Не найдены в `PATH`. |
| Слушающие порты 5432/5433/54320/54321/55432 | Ничего не слушает; локального PostgreSQL нет. |

Вывод: это не сбой конкретного контейнера и не проблема образа. Платформа виртуализации выключена, поэтому HCS не может создать VM для `docker-desktop` (`0x80070032` — «запрос не поддерживается»). Без включения компонента и перезагрузки Docker Desktop не запустится, а других установленных PostgreSQL-бинарников нет.

Дополнительно: `uv` в окружении отсутствует (`uv --version` → команда не найдена), поэтому BMAD-инструменты через `uv` не запускались. Продуктовые документы и планировочные артефакты не менялись; добавлена только спека harness в `_bmad-output/implementation-artifacts/`, как в предыдущих fixup-пунктах.

## 3. Что требуется от человека

Один из вариантов, на выбор:

1. **Включить платформу виртуализации (нужны права администратора и перезагрузка).** В PowerShell от имени администратора:
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
   ```
   Затем перезагрузить Windows, запустить Docker Desktop и проверить `docker info`. После этого выполнить harness по инструкции из `spec-f5-disposable-pg-harness.md`.
2. **Предоставить иную одноразовую PostgreSQL**, доступную на loopback (не живую, не общую, не Supabase/Vercel/Neon), с пустой БД и уникальным портом. Подойдёт CI-service-контейнер, но его добавление в workflow — отдельное изменение и в этом заходе не делалось.
3. **Явно разрешить установку портативного PostgreSQL** в временный каталог (например, распакованный дистрибутив в `%TEMP%`) как отдельную задачу. Сейчас этого не делалось: загрузка и запуск сторонних бинарников БД — существенное изменение окружения, которое не входило в авторизованный объём.

После разблокировки F5 нельзя считать закрытым автоматически: нужен фактический вывод harness и его приложение к отчёту.

## 4. Что сделано в этом заходе

Добавлен harness, который **не входит** в обычный `npm test`/CI и запускается только явно:

- `apps/web/src/db/disposable-pg/guard.ts` — проверка цели. Принимает только literal loopback (`127.0.0.1`/`[::1]`), порт `49152`–`65535`, имя БД `gift_f5_[a-z0-9_]{8,40}`, одинаковые `DISPOSABLE_DATABASE_URL`/`DISPOSABLE_DIRECT_URL` и `DISPOSABLE_PG_CONFIRM`, равный имени БД. Читает **только** `DISPOSABLE_*`; `DATABASE_URL`/`DIRECT_URL` и `.env` как источник цели игнорируются.
- `apps/web/src/db/disposable-pg/guard.test.ts` — 22 unit-теста допуска и всех отказов; входят в обычный прогон.
- `apps/web/src/db/disposable-pg/verify.pgtest.ts` — проверки на реальной БД: пустота цели до миграции, обе миграции и их история, каталог, повторный `migrate deploy`, двойной `seed`, CHECK-ограничения, уникальные индексы, FK `RESTRICT`, вложенный create, `$transaction`/откат, `createMany`, гонки вставки и удаления, порядок и подписи тегов, сохранение подписи ADMIN. После миграции повторно проверяет `current_database()` и loopback-адрес сервера, чтобы исключить уход в другую БД.
- `apps/web/scripts/require-disposable-pg.mjs` — preflight: при отсутствии/небезопасности цели печатает причину и завершает запуск с ненулевым кодом до подключения.
- `apps/web/vitest.pg.config.ts` и скрипт `verify:disposable-pg` в `apps/web/package.json` — отдельный запуск, не пересекающийся с CI.
- `_bmad-output/implementation-artifacts/spec-f5-disposable-pg-harness.md` — спека harness, инструкция запуска и границы.

Логика приложения, схема, миграции, сид, API и UI не менялись. Ограничение AD-7 (чтение `Gift` только через `readWishlist`) не ослаблялось: гард-тест `read-guard.test.ts` сначала поймал `gift.count()` в harness, и проверки были переписаны на обычный SQL вместо правки гарда.

## 5. Фактические проверки (что реально прогнано)

| Проверка | Результат |
|---|---|
| `vitest run src/db/disposable-pg/guard.test.ts` | 1 файл, **22/22** теста зелёные. |
| `npm test -w @gift-list/web` | 47 файлов, **511/511** тестов, 0 падений (включая AD-7 read guard). |
| `npm run typecheck -w @gift-list/web` | Успешно: `prisma generate`, `next typegen`, `tsc --noEmit`. |
| `npm run lint -w @gift-list/web` | Успешно, без замечаний. |
| `npm run verify:disposable-pg` без env | Отказ с кодом 2: `missing-database-url`; до подключения дело не дошло. |
| Тот же запуск с `db.example.com` | Отказ: `not-loopback`. |
| Тот же запуск с портом `5432` | Отказ: `dynamic-port-required`. |
| Preflight с синтетической целью `127.0.0.1:55432/gift_f5_abc12345` | Цель принята (exit 0) — проверен только разбор URL, **подключения не было**. |
| Реальный прогон `verify.pgtest.ts` на PostgreSQL | **Не выполнялся** — PostgreSQL нет. |

`prisma generate` в typecheck — офлайн-команда, к БД не подключается. `prisma migrate deploy`, `prisma db seed`, `db push`, `migrate dev/reset` не запускались ни разу.

## 6. Что остаётся недоказанным (F5 не закрыт)

- Применение `20261105120000_tags` и `20261106120000_fixed_tags_catalog` к реальному PostgreSQL.
- Идемпотентность повторного `migrate deploy` и двойного `db seed` на реальных строках.
- CHECK-ограничения `Tag_labels_object_check` и `GiftTag_shape_check` (SQL принимается сервером, коды 23514).
- Уникальные индексы `Tag.slug`, `GiftTag(giftId, tagId)`, `GiftTag(giftId, customText)` и FK `ON DELETE RESTRICT`.
- Вложенный create тегов, `$transaction`/откат, `createMany` и гонки на реальных блокировках PostgreSQL.
- Реальная сортировка тегов и подписи `labels` из БД (не из моков).
- Сохранение подписи ADMIN при повторном сиде на реальной БД.
- Версия PostgreSQL, команды и вывод, которые F5 требует как результат, — отсутствуют.

Сам harness на PostgreSQL не исполнялся, поэтому его SQL-путь тоже остаётся непроверенным; доказаны только guard-тесты, отказы preflight, типы и линт. Это ограничение нельзя выдавать за проверку F5.

## 7. Безопасность выполненного захода

- Живая, общая, Supabase/Neon/Vercel или любая удалённая БД не затрагивались; строки подключения не читались и не выводились.
- `.env*` не читались и не менялись; постоянные переменные окружения не сохранялись. `DISPOSABLE_*` для проб задавались только в процессах проверки и удалены.
- Секреты не выводились; harness маскирует пароль в описаниях и не пишет его в evidence.
- Windows-компоненты, WSL (`--shutdown`/`--reset`/`--update`), Docker Desktop и его настройки не менялись; контейнеры не создавались.
- Нет `main`, push, PR, merge, deploy; коммиты только в рабочую ветку.

## 8. Коммиты

- `b6ab6c9` — `F5: add safety-gated disposable PostgreSQL harness` (guard, тесты, opt-in suite, preflight, конфиг, скрипт, спека, статус F5 в плане).
- Отчёт `fixup-F5-report.md` — отдельный коммит после `b6ab6c9`, как требует задание.

`fixup-queue.md` обновлён по Q-04, но оставлен вне коммита; `apps/web/AGENTS.md`, логи, промпты и прочие чужие незакоммиченные файлы не тронуты.

## 9. Очередь

- **F1–F4, F6–F8, F10** — готовы, на ревью (см. отдельные отчёты).
- **F5 / Q-04** — **заблокировано окружением**; harness готов; нужен реальный прогон после действия человека.
- **F9 / Q-13** — не начат, решение по `getMyGifts` без строки `List` и owner-схеме с `publicToken` остаётся за человеком.
- Ручные проверки Q-05/Q-06/Q-32 и решения Q-07, Q-11, Q-12, Q-15–Q-20, Q-31, Q-33 — без изменений, не кодировались.

## 10. Готовность

**F5 не готов и не закрыт.** Готов только безопасный инструмент проверки. Следующий шаг — разблокировать окружение (раздел 3), выполнить `npm run verify:disposable-pg -w @gift-list/web` на новой пустой БД `gift_f5_<random>` и приложить `fixup-F5-evidence-<UTC>.md` к этому отчёту; без этого F5 остаётся blocked-on-environment.
