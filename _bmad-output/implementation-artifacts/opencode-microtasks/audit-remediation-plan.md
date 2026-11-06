# План устранения находок независимого аудита F1–F10

Дата: 2026-11-06
Ветка: `evivanchikov/story-24-25-auth-fixups`
База: `bc82a75` (`bc82a75718e86b391dc9c2aaac1782890fb1c142`)
Источник находок: `_bmad-output/implementation-artifacts/opencode-microtasks/independent-audit-f1-f10.md`
Область: три микрозадачи — R1 (F4, высокий), R2 (F10, низкий), R3 (F6, низкий).
Правило: R1, R2 и R3 реализованы отдельными заходами; R3 закрыт последним.

## Общие границы захода

- Не пушить в `main`, не делать force-push, не открывать PR, не мержить, не деплоить.
- Не использовать живую, общую или боевую PostgreSQL. Все проверки с БД — только на одноразовой локальной.
- Не читать и не менять `.env*` репозитория, не коммитить секреты и реальные строки подключения.
- Не убивать общий `opencode serve`, не запускать второго писателя в рабочее дерево.
- Сохранить грязные и несвязанные файлы: `apps/web/AGENTS.md`, `fixup-queue.md`, логи, промпты, `keyword/*`, `_scratch-*`.
- Коммиты только по просьбе; в этом заходе разрешены два scoped-коммита: код/тесты/спека/план и отдельный отчёт R1.
- Документы в `_bmad-output/` — на русском.
- Контракты AD-12 не меняются: существующие коды `VALIDATION`, `CONFLICT`, `NOT_FOUND`, поля `field` и HTTP-статусы остаются прежними.

## R1 — F4: вложенный `gift.create` с пропавшим тегом каталога (ВЫСОКИЙ, реализуется сейчас)

### Проблема

На реальном Prisma 7.10.0 + `@prisma/adapter-pg` вложенный `prisma.gift.create({ tags: { create } })` с несуществующим `tagId` даёт `P2003`, но:

- `meta.modelName` = `"Gift"` (корень операции, не `GiftTag`);
- имя ограничения лежит в `meta.driverAdapterError.cause.constraint.index` = `"GiftTag_tagId_fkey"`;
- `meta.field_name` и `meta.target` отсутствуют.

Текущий `constraintDetail()` читает только `modelName`/`field_name`/`target`, получает строку `"Gift"`, не находит `/tag/i` и возвращает `null`. `createGift` пробрасывает ошибку, `POST /api/v1/me/gifts` не ловит её, клиент видит сетевую ошибку вместо конверта AD-12 `VALIDATION` с `field: "tags"`.

### Цель

Расширить маппинг на реальную мету драйвера, не расширяя область: P2003 по `GiftTag_tagId_fkey` → `VALIDATION`/`tags`; P2002 по уникальному индексу `GiftTag` → `CONFLICT`/`tags`; P2003 по `Gift_listId_fkey` и другие чужие ограничения → проброс. Атомарность не меняется: при ошибке вложенного create строка `Gift` не остаётся.

### Границы

**Всегда:**
- Маппинг применяется только когда операция действительно пишет строки тегов (`tagRows.length > 0` на create, `tags !== undefined` на update).
- Для P2003 достаточно точного признака `GiftTag_tagId_fkey` (в том числе с префиксом схемы), а не общего `/tag/i` по всей ошибке.
- Для P2002 достаточно признака таблицы/модели `GiftTag` (реальная мета: `meta.table`, `cause.table`, `constraint.index`).
- Отсутствие меты у P2003 в уже существующем пути записи тегов сохраняет прежнее поведение: это отказ записи тегов → `VALIDATION`/`tags`.
- `Gift_listId_fkey` остаётся инфраструктурным отказом и пробрасывается.
- Вложенный create остаётся одним write; транзакция update остаётся атомарной.

**Никогда:**
- Не маппить любой P2003 с `modelName: "Gift"` в `VALIDATION`.
- Не матчить широкое `/tag/i` по `originalMessage`/`detail`, где может встретиться произвольный текст.
- Не менять схему, миграции, контракты, коды AD-12, лимиты тегов, поведение `CLOSED`/`RESERVED`.
- Не добавлять новых публичных API и не трогать R2/R3.

### Критерии приёмки

1. **Реальная мета.** На одноразовой PostgreSQL реальный вложенный `gift.create` с отсутствующим `tagId` даёт `P2003`; тест фиксирует `meta.modelName === "Gift"` и `meta.driverAdapterError.cause.constraint.index === "GiftTag_tagId_fkey"`, отсутствие `field_name`/`target`.
2. **Сквозной маппинг.** Тот же реальный отказ, полученный через `createGift` (гонка «тег удалён после проверки»), возвращает `{ ok: false, code: "VALIDATION", field: "tags" }`, а не исключение.
3. **Атомарность.** После такого отказа в `Gift` нет строки создаваемого желания и нет осиротевших `GiftTag`.
4. **Чужая FK.** Реальный P2003 по `Gift_listId_fkey` через `createGift` пробрасывается (не становится `VALIDATION`/`tags`).
5. **Уникальность.** P2002 по `GiftTag` (реальная мета адаптера) остаётся `CONFLICT`/`tags`; P2002 по другой таблице не маппится.
6. **Юнит-моки.** `apps/web/src/actions/gifts.test.ts` и route-тесты используют аутентичную мету адаптера (`driverAdapterError.cause.constraint.index`), а не выдуманные `field_name: "GiftTag_tagId_fkey (index)"` с `modelName: "GiftTag"`.
7. **Гейты.** Focused-тесты, `npm run typecheck`, `npm run lint`, полный `npm test`, `npm run build` — зелёные.
8. **Отчёт.** Отдельный `audit-R1-report.md` на русском с хешами коммитов, фактическими гейтами, причиной, исправлением, доказательством на одноразовой PG, ограничениями и статусом R2/R3.

### План работ

1. Снять реальную форму ошибки на одноразовой PostgreSQL (контейнер `postgres:17-alpine`, уникальное имя `gift_f5_<random>`, loopback-порт из динамического диапазона, оба `DISPOSABLE_*` URL и `DISPOSABLE_PG_CONFIRM`).
2. Заменить `constraintDetail()` на сбор имён ограничений из реальных путей меты; отдельно распознавать `GiftTag_tagId_fkey` и `GiftTag` для unique.
3. Обновить `tagWriteFailure()` с сохранением P2002→`CONFLICT`, P2003→`VALIDATION` и проброса чужих FK.
4. Обновить юнит- и route-моки на аутентичную мету; добавить негативный кейс `Gift_listId_fkey`.
5. Расширить `apps/web/src/db/disposable-pg/verify.pgtest.ts` регрессией: реальная форма ошибки, сквозной `createGift` → `VALIDATION`, отсутствие остатка, `Gift_listId_fkey` → проброс.
6. Прогнать гейты, обновить спеку и статус R1 в этом плане, сделать scoped-коммит.
7. Отдельным коммитом добавить русский `audit-R1-report.md`.

### Статус R1

`done` — реализовано в этом заходе. Задача без истории Linear: это микрозадача устранения находки аудита F4, продуктовые критерии не меняются.

Фактические гейты:

- `npm run typecheck` — код 0.
- `npm run lint` — код 0, включая `check-boundaries`.
- `npm test` — mobile 43 файла / 590, web 48 / 518, contracts 6 / 164, ui 14 / 81, 5 проверок границ; падений 0.
- `npm run build` — standalone-сборка успешна.
- `npm run verify:disposable-pg -w @gift-list/web` — 18/18 на одноразовой PostgreSQL 17 (`gift_f5_c6f7c90bbd16`, loopback-порт 62617). Доказательство: `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-F5-evidence-2026-11-06T084454.md`.

Подтверждено на реальной БД: P2003 вложенного create имеет `modelName: "Gift"` и `driverAdapterError.cause.constraint.index: "GiftTag_tagId_fkey"`; `createGift` возвращает `VALIDATION`/`tags` без остатка `Gift`/`GiftTag`; `Gift_listId_fkey` пробрасывается, а не превращается в `VALIDATION`.

## R2 — F10: `normalizeWebOrigin` принимает userinfo и обратную косую (НИЗКИЙ, реализован)

### Проблема

`apps/mobile/src/config/env.ts` объявляет нормализатор как «схема, хост и необязательный порт», но регулярное выражение `^(https?:\/\/[^/?#\s]+)\/*$` принимает:

- `https://user:pass@gift.example` — пароль попадёт в копируемую ссылку;
- `https://gift.example@evil.com` — браузер откроет `evil.com`;
- `https://evil.com\@gift.example` — обратная косая черта меняет разбор.

Источник — явно заданный `EXPO_PUBLIC_WEB_ORIGIN` или `EXPO_PUBLIC_API_BASE_URL`, не `window.location.origin`.

### Цель

Сузить нормализатор до схемы `http(s)`, хоста и необязательного порта; отвергать userinfo, обратную косую черту и некорректные значения. Сохранить порядок «явный origin → API-base → origin страницы» и правило «неверное явное значение не подменяется следующим источником».

### Границы

**Всегда:**
- Разрешены только `http://` и `https://`, валидный хост и необязательный числовой порт.
- Значение с userinfo (`@` в authority), обратной косой чертой, путём, query или fragment отклоняется и даёт `""`.
- Пустое значение по-прежнему означает «перейти к следующему источнику»; непустое негодное — не переходить.
- Домены и порты не выдумываются, production-хосты не хардкодятся.

**Никогда:**
- Не менять `wishlistShareLink` и формат ссылки `/l/<token>`.
- Не менять серверные ссылки по `BETTER_AUTH_URL`.
- Не ослаблять проверку ради удобства локальной разработки.

### Критерии приёмки

1. `https://gift.example` и `https://gift.example:8443` нормализуются без изменений.
2. `https://user:pass@gift.example`, `https://gift.example@evil.com`, `https://evil.com\@gift.example` дают `""`.
3. `https://gift.example/path`, `javascript:alert(1)`, `null`, пустая строка — отвергаются по существующим правилам.
4. Явный негодный origin не подменяется API-base или origin страницы.
5. Тесты `env.test.ts`/`env.web.test.ts` покрывают новые отказы и прежний приоритет; гейты зелёные.

### Статус R2

`done` — реализовано в этом заходе. Задача без истории Linear: это микрозадача устранения находки аудита F10, продуктовые критерии не меняются. Спека: `_bmad-output/implementation-artifacts/spec-audit-r2-strict-web-origin.md`.

Что сделано: `WEB_ORIGIN` в `apps/mobile/src/config/env.ts` сужен до `http(s)://` + хост (DNS-имя, IPv4, `localhost`, IPv6 в скобках) + необязательный порт `1…65535`; `@` и обратная косая черта в authority больше не проходят, хвостовые слэши по-прежнему срезаются. Порядок источников и fail-closed для явного значения не менялись. Тесты: `env.test.ts` (userinfo, backslash, порт, localhost/IPv6, fail-closed), `share-link.test.ts` (атакующий origin → `null`).

Фактические гейты:

- `npm run typecheck` — код 0.
- `npm run lint` — код 0, включая `check-boundaries`.
- `npm test` — mobile 43 файла / 595, web 48 / 518, contracts 6 / 164, ui 14 / 81, 5 проверок границ; падений 0.
- `npm run build` — standalone-сборка успешна.

## R3 — F6: `appendChild`/`select` вне `try` в веб-буфере (НИЗКИЙ, реализован)

### Проблема

`apps/mobile/src/platform/clipboard.ts`: `appendChild` и `select()` стоят до `try`. Если `select()` бросит исключение, `finally` не выполнится, временный `textarea` останется в DOM, а `copyText` завершится отказом промиса; внешний `copyWishlistShareLink` покажет `"failed"`.

### Цель

Гарантировать снятие временного `textarea` после присоединения к DOM при любом отказе `select()`/`execCommand`, сохранив прежние результаты и ошибки фолбэка.

### Границы

**Всегда:**
- `textarea` удаляется в `finally`, если он был присоединён.
- Успешный `navigator.clipboard.writeText` не запускает фолбэк.
- Отказ `writeText` переходит к `execCommand("copy")`; отказ `execCommand` возвращает `false`, а не оставляет узел.
- `clipboard.native.ts` не меняется.

**Никогда:**
- Не менять сигнатуру `copyText`, `copyWishlistShareLink` и строки интерфейса.
- Не добавлять глобальные обработчики ошибок и не глотать исключения, которые меняют результат.

### Критерии приёмки

1. При `select()`, бросающем исключение, промис завершается отказом/`false` по текущему контракту, а `document.body` не содержит временного `textarea`.
2. При отказе `writeText` и успешном `execCommand("copy")` результат прежний, узел снят.
3. При отказе `appendChild`/недоступном `document` поведение остаётся безопасным и не бросает необработанное исключение.
4. Тесты `clipboard` покрывают бросок `select()`, отказ `execCommand` и отсутствие узла после каждого пути; mobile-гейты зелёные.

### Статус R3

`done` — реализовано в этом заходе. Задача без истории Linear: это микрозадача устранения находки аудита F6, продуктовые критерии не меняются. Спека: `_bmad-output/implementation-artifacts/spec-audit-r3-clipboard-cleanup.md`.

Что сделано: в `legacyCopy` вызовы `appendChild`/`select()` перенесены внутрь `try`, а `field.remove()` стоит в `finally`, поэтому узел снимается и при броске `select()`, и при `appendChild`, который вставил узел и затем бросил; `remove()` безопасен и без присоединения. Результаты не менялись: успешный `navigator.clipboard.writeText` не запускает фолбэк, бросок `execCommand` даёт `false`, бросок `select()`/`appendChild` по-прежнему завершает промис отказом, который `copyWishlistShareLink` переводит в `"failed"`. `clipboard.native.ts`, сигнатуры и строки интерфейса не менялись.

Тесты: `clipboard.test.ts` дополнен кейсами «бросок `select()`», «отказ `appendChild` до присоединения» и «`appendChild` вставил узел и бросил»; в каждом проверяется отсутствие `textarea` в `document`. Прежние кейсы `execCommand` true/false/throw сохранены. Новые тесты падают на коде `HEAD` (2 из 12) и проходят после правки.

Фактические гейты:

- Focused: `npm run test -w @gift-list/mobile -- src/platform/clipboard.test.ts src/wishlist/copy-link.test.ts src/platform/clipboard.native.test.ts` — 3 файла / 22 теста, падений 0.
- `npm run typecheck` — код 0.
- `npm run lint` — код 0, включая `check-boundaries`.
- `npm test` — mobile 43 файла / 598, web 48 / 518, contracts 6 / 164, ui 14 / 81, 5 проверок границ; падений 0.
- `npm run build` — standalone-сборка успешна.

## Порядок и зависимости

1. R1 — сейчас, отдельная ветка/PR, без R2/R3.
2. R2 — после R1 отдельным PR; затрагивает только `apps/mobile/src/config/env.ts` и его тесты.
3. R3 — после R1 отдельным PR; затрагивает только `apps/mobile/src/platform/clipboard.ts` и его тесты.

R2 и R3 не конфликтуют с R1 по файлам и могут идти параллельно после закрытия R1.
