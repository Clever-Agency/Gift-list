# Независимый аудит fixup F1–F10

Снимок: архив `fixup-independent-review-bc82a75`, SHA256 `6361a549b09af4a407bdc93e6a6e7ed87c59ac8d9e4939ffb50d254fc7edbe2e` (совпал с манифестом). Ветка по манифесту: `evivanchikov/story-24-25-auth-fixups`. Заявленный HEAD: `bc82a75718e86b391dc9c2aaac1782890fb1c142`. База fixup: `057805d295ef844ddf96d8c67c55e3e5a31de6d2`. В архиве 22 коммита `057805d..HEAD` и дерево `source/` (без `.git`). Хеш git-объекта отдельно не пересчитывался: в архиве нет `.git`. Идентичность пакета — совпадение SHA256 и состав манифеста.

OpenCode не запускался. Отчёты OpenCode не использовались как доказательство. Исходники продукта не правились и не коммитились. Проверки шли из распакованного снимка `/tmp/fixup-audit/source` через npm workspaces, Node.js **24.22.2**, Prisma **7.10.0**.

## Итог

| Пункт | Вердикт | Коротко |
|---|---|---|
| F1 | **pass** | Data-миграция идемпотентна, подписи ADMIN сохраняются, недостающий ключ локали добирается. Проверено на одноразовой PostgreSQL. |
| F2 | **pass** | Пустой каталог — успешное чтение; обрыв БД — исключение. Маршрут переводит его в пустой 500. Живой Next-сервер не поднимался. |
| F3 | **pass** | У нажимаемой карточки одно имя по фразе DESIGN, включая скрытые теги, бронь и видимость. Диктор не проверялся. |
| F4 | **fail** | На реальном Prisma 7.10 вложенный `gift.create` с удалённым тегом каталога даёт P2003 с `modelName: "Gift"`. Маппер его не узнаёт и пробрасывает. Конверт AD-12 на create не строится. |
| F5 | **pass** | Harness 15/15 на изолированной PostgreSQL 16.15. Цель — только `DISPOSABLE_*`. Образ PostgreSQL 17 в среде отсутствует. |
| F6 | **pass** | Адаптеры и их отказы покрыты юнит-тестами, они прошли. Запись в системный буфер браузера и телефона не выполнялась. |
| F7 | **pass** | Ошибка и пояснение блокировки связаны с `radiogroup` в DOM. Диктор и нативный фокус не проверялись. |
| F8 | **pass** | `tags.N` остаётся на том же чипе после снятия и повторного выбора; чужой чип не подсвечивается. Диктор не проверялся. |
| F9 | **pass** | Список создаётся при регистрации. Гонка вставки по `ownerId` оставляет один токен. `createGift` список по-прежнему не создаёт — это граница пункта. |
| F10 | **pass** | Порядок «явный origin → API → origin страницы» соблюдён, неверное явное значение не подменяется, native-ветка в коде отсечена `Platform.OS`. Устройство и реальный деплой не проверялись. |

Высший приоритет: **F4, создание желания**. Гонка «тег каталога удалён между проверкой и вложенной записью» на этом Prisma по-прежнему уходит из `POST /api/v1/me/gifts` необработанным исключением. Желание при этом не остаётся в базе. Обновление набора через `giftTag.createMany` на той же версии отображается в конверт.

## Как проверялось

- Распаковка архива, сверка SHA256, чтение спек `spec-f1`…`spec-f10`, плана и кода. Очередь `meta/fixup-queue.unstaged.md` — контекст границ, не доказательство.
- `npm ci` в снимке. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — все с кодом выхода 0.
- Отдельный кластер PostgreSQL только на `127.0.0.1:55432`, каталог данных `/tmp/pg-f5-audit`, синтетический пароль, пустая БД `gift_f5_defa304a92addb02`. Кластер по умолчанию на порту 5432 этой проверкой не использовался. Общих и боевых баз нет.
- `npm run verify:disposable-pg -w @gift-list/web`: **15/15**. В окружении родителя стоял ложный `DATABASE_URL` на `127.0.0.1:1/should_not_be_used`. Миграции попали в одноразовую БД.
- Отдельный прогон `/tmp/audit-probes/probe.test.ts` (вне дерева исходников): повтор SQL F1, метаданные реальных ошибок Prisma, гонка `List`, пустой каталог и мёртвый порт.

## Подтверждённые дефекты

### F4 — высокий. Вложенный create не попадает в конверт

`createGift` пишет теги вложенным `prisma.gift.create({ tags: { create } })` и рассчитывает отобразить P2003 в `VALIDATION` с `field: "tags"`:

```230:256:apps/web/src/actions/gifts.ts
  try {
    const row = await prisma.gift.create({
      data: {
        // ...
        ...(tagRows.length > 0 ? { tags: { create: tagRows } } : {}),
      },
      select: ownerGiftSelect,
    });
    // ...
  } catch (error) {
    const tagFailure = tagRows.length > 0 ? tagWriteFailure(error) : null;
```

`tagWriteFailure` смотрит только на `meta.modelName`, `meta.field_name` и `meta.target`. Если строка непуста и в ней нет подстроки `tag`, ошибка пробрасывается:

```97:128:apps/web/src/actions/gifts.ts
function constraintDetail(error: Prisma.PrismaClientKnownRequestError): string {
  const meta = (error as { meta?: Record<string, unknown> }).meta;
  if (!meta) return "";
  return [meta.modelName, meta.field_name, meta.target]
    // ...
    .join(" ");
}
// ...
  const detail = constraintDetail(error);
  if (detail !== "" && !/tag/i.test(detail)) return null;
```

На Prisma 7.10.0 и `@prisma/adapter-pg` вложенный create с несуществующим `tagId` даёт такую мету (проба на одноразовой БД):

- код `P2003`;
- сообщение PostgreSQL: `insert or update on table "GiftTag" violates foreign key constraint "GiftTag_tagId_fkey"`;
- `meta.modelName` = `"Gift"`;
- имя ограничения лежит в `meta.driverAdapterError.cause.constraint.index` = `"GiftTag_tagId_fkey"`;
- полей `field_name` и `target` нет.

Строка для маппера получается `"Gift"`. Подстроки `tag` в ней нет, функция возвращает `null`, `createGift` делает `throw`. `POST` в `apps/web/src/app/api/v1/me/gifts/route.ts:13` исключение не ловит. Клиент получает не конверт AD-12 и показывает сетевую ошибку. Это исходный симптом Q-10 для создания.

Атомарность при этом держится: число желаний списка до и после неудачного вложенного create совпало (`1` и `1`).

Та же проба, другие операции:

| Операция | `modelName` | Ограничение | Что делает текущий маппер |
|---|---|---|---|
| `giftTag.create` с чужим `tagId` | `GiftTag` | `GiftTag_tagId_fkey` | `VALIDATION` |
| `giftTag.createMany` с чужим `tagId` | `GiftTag` | `GiftTag_tagId_fkey` | `VALIDATION` |
| повтор `giftId+tagId` | `GiftTag` | `GiftTag_giftId_tagId_key` | `CONFLICT` |
| повтор `customText` | `GiftTag` | `GiftTag_giftId_customText_key` | `CONFLICT` |
| `gift.create` с чужим `listId` и вложенным тегом | `Gift` | `Gift_listId_fkey` | проброс, так и задумано |
| `gift.create` с вложенным отсутствующим тегом | `Gift` | `GiftTag_tagId_fkey` | **проброс, это дефект** |

Путь обновления (`updateGift`, `tx.giftTag.createMany`, строки 369–386) на этой версии попадает в конверт: `modelName` равен `GiftTag`. Дефект сосредоточен на вложенной записи create.

Юнит-тест `apps/web/src/actions/gifts.test.ts:915-930` подставляет мету `{ modelName: "GiftTag", field_name: "GiftTag_tagId_fkey (index)" }`. У реального адаптера такого `field_name` нет, а у вложенного create другой `modelName`. Поэтому `npm test` остаётся зелёным и не ловит пропуск.

Воспроизведение на одноразовой БД после `prisma migrate deploy`:

1. Создать пользователя, список и строку каталога `dream`.
2. Вызвать `prisma.gift.create` с `tags.create`, где `tagId` не существует, `aggregateEligible: true`.
3. Поймать `PrismaClientKnownRequestError`: код `P2003`, `meta.modelName === "Gift"`, в `driverAdapterError.cause.constraint.index` — `GiftTag_tagId_fkey`.
4. Прогнать эту ошибку через `constraintDetail` / условие `/tag/i`: результат — проброс, не `VALIDATION`.

### F10 — низкий, вердикт пункта не меняет

`normalizeWebOrigin` в `apps/mobile/src/config/env.ts:12-16` объявлен как «схема, хост и необязательный порт». Регулярное выражение `^(https?:\/\/[^/?#\s]+)\/*$` принимает userinfo и обратную косую черту. Проба по тексту этой константы из снимка:

| Вход | Результат |
|---|---|
| `https://user:pass@gift.example` | `https://user:pass@gift.example` |
| `https://gift.example@evil.com` | `https://gift.example@evil.com` |
| `https://evil.com\@gift.example` | та же строка с обратной косой |
| `https://gift.example/path`, `javascript:alert(1)`, `null` | пусто |

`wishlistShareLink` тогда собирает `https://gift.example@evil.com/l/<token>`: браузер откроет хост `evil.com`. Пароль из userinfo попадёт в копируемую ссылку. Источник — явно заданный `EXPO_PUBLIC_WEB_ORIGIN` или `EXPO_PUBLIC_API_BASE_URL`, не `window.location.origin` (у origin страницы userinfo не бывает). Регулярное выражение в diff F10 не менялось; новый запасной источник проходит через него. Для пустых переменных на вебе дыра не открывается.

### F6 — низкий, вердикт пункта не меняет

В `apps/mobile/src/platform/clipboard.ts:31-38` `appendChild` и `select()` стоят до `try`. Если `select()` бросит исключение, `finally` не снимет временный `textarea`, а `copyText` завершится отказом промиса. Внешний `copyWishlistShareLink` (`apps/mobile/src/wishlist/copy-link.ts:21-28`) переводит отказ в `"failed"`. На обычном `select()` в браузере это не воспроизводилось: живой буфер не проверялся.

## Пункты без дефекта, с доказательством

### F1 — pass

`apps/web/src/db/migrations/20261106120000_fixed_tags_catalog/migration.sql:18-26` вставляет `dream`, `need-now`, `someday` с `ON CONFLICT ("slug") DO UPDATE` и слиянием `EXCLUDED."labels" || "Tag"."labels"`. В jsonb PostgreSQL правый операнд перекрывает ключи левого, поэтому уже записанная подпись выигрывает, отсутствующий ключ добирается из стартового набора. `DELETE`/`TRUNCATE` по `Tag` в файле нет. Старая миграция `20261105120000_tags` не менялась.

На пустой БД `migrate deploy` записал все шесть миграций, включая каталог. После harness в строке `dream` было `{"en":"Dream","ru":"мечта ADMIN"}`. Повтор того же SQL не изменил `labels` и `updatedAt`. В откатываемой транзакции `need-now` с подписью `{"en":"Now only"}` после SQL стал `{"en":"Now only","ru":"нужно сейчас"}`. Двойной прогон не увеличил число строк. Финальная проверка harness тоже оставила три строки и сохранила правку ADMIN при повторном `db seed`.

### F2 — pass

`getTagCatalog` (`apps/web/src/actions/tags.ts:35-51`) исключений не глотает. Пустой `findMany` доходит до `{ ok: true, data: { tags: [] } }`. `GET` (`apps/web/src/app/api/v1/tags/route.ts:15-22`) ловит ошибку один раз, пишет в лог и отвечает `infrastructureErrorResponse()`: статус 500, тело пустое, без конверта (`apps/web/src/lib/api-v1.ts:31-36`). Клиент (`apps/mobile/src/api/client.ts:102-106`) трактует не-JSON как `network`. `useTagCatalog` кладёт пустой успешный ответ в `ready` с `[]`, а отказ — в `error` (`apps/mobile/src/ui/use-tag-catalog.ts:38-42`).

На живой БД `tag.findMany()` после удаления строк вернул `[]` (затем каталог восстановлен миграционным SQL). Клиент к закрытому порту `1` бросил ошибку соединения. Сквозной HTTP через поднятый Next не выполнялся: функция маршрута покрыта юнит-тестами прогона `npm test`.

### F3 — pass

`WishCard` собирает фразу «название, цена, статус, все теги, строка брони, видимость {значение}», пустые части выбрасывает (`apps/mobile/src/ui/gift-card.tsx:7-14`, `93-100`). В имя входят все `gift.tags`, а не только три видимых чипа. Кнопка получает это имя через `aria-label` только при `onPress` (`packages/ui/src/wish-card.tsx:100-108`). Без `onPress` общей кнопки нет; скрытые подписи остаются у чипа «+N» (`packages/ui/src/tag-chip.tsx:71-77`, `227-233`). Порядок чипов и визуальный ряд не менялись. Юнит-тесты карточки входят в 590 тестов mobile и прошли. NVDA, VoiceOver и TalkBack не запускались.

### F5 — pass

Guard (`apps/web/src/db/disposable-pg/guard.ts`) читает только `DISPOSABLE_*`, требует `127.0.0.1` или `[::1]`, порт `49152–65535`, имя `gift_f5_[a-z0-9_]{8,40}`, совпадение обеих строк и `DISPOSABLE_PG_CONFIRM`. `localhost` и query-параметры отвергаются.

Прогон: PostgreSQL **16.15**, не 17.11 (образа и пакетов 17 в среде нет). До миграции пользовательских таблиц было 0. После — шесть миграций, все `finished`. Повторный deploy не добавил историю. Двойной seed не размножил строки. CHECK `23514`, уникальные индексы `23505`, FK `RESTRICT` `23503`, откат и коммит `$transaction`, `createMany`, одна победившая гонка уникального индекса, гонка delete/insert без висящих `GiftTag`, порядок карточки и сохранение подписи ADMIN — в журнале `/opt/cursor/artifacts/f5-harness-evidence.md`. Harness дописал этот журнал в дерево снимка; файл вынесен в артефакты и из `source/` удалён.

Ограничение guard: он проверяет форму URL, а не то, что за loopback-портом нет чужих баз. SQL миграций и теста работает в подключённой базе. Для аудита поднят отдельный кластер с одной пустой базой.

### F6 — pass

`apps/mobile/src/platform/clipboard.ts` при отказе `navigator.clipboard.writeText` переходит к `execCommand("copy")` и снимает `textarea` в `finally`, если выполнение дошло до `try`. `clipboard.native.ts` возвращает `false` при исключении `expo-clipboard`. Прямые тесты обоих файлов входят в прошедшие 590 тестов mobile. Это happy-dom и мок `expo-clipboard`. Metro-выбор `.native.ts`, iOS Safari с `readonly` + `select()`, Android и iOS не проверялись. Весь mobile-прогон подменяет `react-native` на `react-native-web` (`apps/mobile/vitest.config.ts:12-13`).

### F7 — pass

`ChoiceList` (`packages/ui/src/choice.tsx:124-165`) ставит на `radiogroup` `aria-invalid` при ошибке и `aria-describedby` на текст ошибки и на описание. У ошибки `role="alert"`. `aria-errormessage` намеренно нет: тот же приём, что у `TextField`, дублировать текст не стали. На каждое радио тот же текст попадает в `accessibilityHint`, потому что группа на телефоне не фокусируется. Тесты `packages/ui/src/choice.test.tsx` проверяют DOM-связь и уникальность id; они в 81 тесте UI и прошли. Позиция пояснения блокировки относительно «над группой» в DESIGN в этот пункт не входила. Диктор не проверялся.

### F8 — pass

Сервер по-прежнему отдаёт путь zod: `firstIssueField` (`apps/web/src/lib/api-v1.ts:46-48`). `tagErrorKey` (`apps/mobile/src/ui/gift-form-validation.ts:118-128`) берёт индекс из последней отправки (`submittedTagKeys`, `gift-form.tsx:254`, `442-443`) и оставляет ошибку только если этот ключ ещё есть в текущем наборе. Снятие и повторный выбор фиксированного тега сохраняют ключ `catalog:<id>`. Удаление и индекс вне отправки дают групповую ошибку без `aria-invalid` на чужом чипе. Чип получает `aria-invalid`, `aria-describedby` и `accessibilityHint` (`packages/ui/src/tag-chip.tsx:134-141`). Соответствующие тесты формы прошли в составе 590. Экранный диктор и визуальная обводка чипа вне DOM-атрибутов не проверялись.

Повторный submit во время полёта запроса отсекается `inFlight` (`edit.tsx:210-211`, `new.tsx:92-93`), кнопка в этом состоянии не вызывает `onPress` (`packages/ui/src/button.tsx:119-138`). Отдельной гонки «поздний ответ от предыдущего тела» при двух одновременных запросах в коде экрана нет.

### F9 — pass

`registerUser` создаёт пользователя, учётную запись и один `List` одним вложенным `user.create` (`apps/web/src/actions/register.ts:59-78`). `createGift` при отсутствии списка отвечает `NOT_FOUND` и строку не создаёт (`gifts.ts:216-224`) — так и записано в границе F9. `readWishlist` для владельца даёт `not_found` только когда строки `List` нет (`wishlist-read.ts:77-84`, политика владельца в `visibility.ts:127-135` не маскирует существующий список). `getMyGifts` тогда вызывает `ensureOwnerList` и перечитывает (`my-gifts.ts:40-46`).

`ensureOwnerList` (`owner-list.ts:17-33`) только вставляет. При P2002 ищет строку по `ownerId` и не перезаписывает токен. Если строки так и нет, исключение пробрасывается. На PostgreSQL два параллельных `list.create` с одним `ownerId` и разными токенами оставили ровно одну строку; сохранённый токен совпал с токеном победителя. Повторная вставка получила P2002, токен не изменился. Сам helper из-за `server-only` в пробу не импортировался; его ветвление покрыто юнит-тестами внутри прошедших 517 тестов web.

Чужому зрителю `publicToken` по-прежнему не отдаётся (`wishlist-read.ts:132-137`).

### F10 — pass

`resolvePublicWebOrigin` (`apps/mobile/src/config/env.ts:55-66`): непустое явное значение, затем непустой API-base, затем origin страницы. Любое из них проходит `normalizeWebOrigin`. Непустая, но негодная строка даёт `""` и не переходит к следующему источнику. `readPageOrigin` возвращает origin только при `Platform.OS === "web"` и наличии `window.location.origin`. На native страница в эту функцию не попадает.

Прошедшие тесты `env.test.ts`, `env.web.test.ts` (happy-dom, страница `https://gift.example`) фиксируют приоритет и отказ подменять `gift.example` без схемы. README снимка описывает Metro `:8081` (для локальной ссылки нужен `http://localhost:3000`) и то, что ссылка preview ведёт на хост preview. `apps/mobile/.env.example` и `apps/web/.env.example` в архив не входили, их текст не проверялся. Реальное копирование в браузере, на устройстве и на preview-хосте не выполнялось. Серверные ссылки по `BETTER_AUTH_URL` этот пункт не меняет.

## Независимые прогоны

Команды из корня снимка, Node 24.22.2.

| Команда | Результат |
|---|---|
| `npm run typecheck` | код 0 |
| `npm run lint` | код 0, eslint четырёх workspace и `check-boundaries` |
| `npm test` | код 0. mobile 43 файла / 590, web 48 / 517, contracts 6 / 164, ui 14 / 81, плюс 5 проверок границ. Итого 1352 теста и 5 границ, падений 0 |
| `npm run build` | код 0. Expo-web export, Prisma Client 7.10.0, Next.js 16.4.3, компиляция успешна, 15 статических страниц. В списке маршрутов есть `/api/v1/tags` |
| `npm run verify:disposable-pg -w @gift-list/web` | 15/15, PostgreSQL 16.15, БД `gift_f5_defa304a92addb02` |
| проба `/tmp/audit-probes/probe.test.ts` | 5/5 |

Юнит-тесты — Vitest. DOM-проверки доступности — happy-dom (`getAttribute`), это не экранный диктор и не устройство. Проба F4/F9/F1/F2 ходила в локальный PostgreSQL.

Сборка перегенерировала Prisma Client в `apps/web/src/db/generated` и экспорт SPA. Ручных правок продукта нет.

## Что не проверялось и не считается дефектом fixup

Ручное, отдельно от багов:

- NVDA / VoiceOver / TalkBack для карточки, чипа «+N», `ChoiceList` и ошибки тега (Q-05, Q-06).
- Вид ряда тегов, длинного своего тега и «+N» в браузере, Android и iOS.
- Реальная запись в буфер и жест пользователя.
- Сборка Expo-web на preview-хосте и копирование ссылки в развёрнутом стенде.
- PostgreSQL 17.11: в среде есть только 16.15. Поведение CHECK, FK, jsonb `||` и уникальных индексов на нём совпало с ожиданием F1/F5.

Осознанные продуктовые границы, не дефекты этого пакета:

- нет лимита числа тегов (Q-15);
- теги у `CLOSED` (Q-16);
- три фиксированных тега вытесняют свой за «+N» (Q-17);
- дефис в `need-now` (Q-18);
- каталог не подписан на смену языка без перезапуска (Q-19);
- фиксированный тег без подписи пропадает с карточки (Q-20);
- в имени карточки нет слова «Изменить» (Q-34);
- `createGift` не восстанавливает отсутствующий `List` (граница F9);
- `aria-errormessage` у `ChoiceList` не ставится;
- пояснение блокировки остаётся под группой;
- ссылка с preview-хоста ведёт на этот хост, а Metro `:8081` не обслуживает `/l/*`.

## Приоритет

1. **F4.** На Prisma 7.10 вложенное создание желания с пропавшим тегом каталога не превращается в `VALIDATION`/`field: "tags"`. Чинить маппер по реальной мете адаптера (`driverAdapterError.cause.constraint.index` и таблица из текста PostgreSQL), а не по `modelName` корня операции. Добавить пробу на одноразовой PostgreSQL: вложенный `gift.create` должен дать конверт, а `Gift_listId_fkey` — по-прежнему проброс. Обновление через `createMany` на этой версии уже попадает в конверт.
2. Остальные девять пунктов на этом снимке держат свои критерии. Низкие хвосты F10 (userinfo в явно заданном origin) и F6 (`select()` вне `try`) не ломают приёмку пунктов, но нормализатор origin стоит сузить до схемы, хоста и порта, раз комментарий обещает «не тот хост не подставлять».
