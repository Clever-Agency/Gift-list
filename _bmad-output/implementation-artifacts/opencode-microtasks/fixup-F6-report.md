# Отчёт по fixup F6 — Q-30, Story 2.4 (clipboard)

Дата: 2026-11-06. Ветка: `evivanchikov/story-24-25-auth-fixups`. База на входе: `fe651ae`. Коммит с кодом, тестами, спекой и планом: `1899902` (`F6: cover clipboard adapters with direct tests`). Отчёт добавлен отдельным коммитом.

## Процесс BMAD

`uv` установлен, но не на `PATH`: использован `C:\Users\Evgeniy\.local\bin\uv.exe`. Команда рендера скилла

```text
C:\Users\Evgeniy\.local\bin\uv.exe run --no-cache "D:\Clever\Gift-list\_bmad\scripts\render_skill.py" --project-root "D:\Clever\Gift-list" --skill "D:\Clever\Gift-list\.agents\skills\bmad-build"
```

завершилась успешно; работа шла по `bmad-build` (oneshot), спека — `spec-f6-clipboard-adapters.md`. Проведён один слой ревью Blind Hunter.

## Что сделано

Добавлены прямые unit-тесты обоих адаптеров; продакшен-код **не менялся**, потому что тесты не выявили дефекта, требующего правки.

### Web — `apps/mobile/src/platform/clipboard.test.ts`

`@vitest-environment happy-dom`, 9 тестов:

- успех `navigator.clipboard.writeText`: точный текст, `true`, `execCommand` не вызывается, временного поля нет;
- отказ `writeText` (rejected promise): переход на `execCommand`, в поле лежит точный текст, поле удалено;
- `navigator.clipboard` отсутствует: сразу `execCommand`;
- `navigator.clipboard` есть, но без `writeText`: `TypeError` перехвачен, переход на `execCommand`;
- синхронное исключение `writeText`: переход на `execCommand`;
- `execCommand` вернул `false`: результат `false`, поле удалено;
- `execCommand` бросил исключение: результат `false`, поле удалено;
- нет `document` и нет `document` + `navigator`: результат `false`, без исключения.

`document.execCommand` в happy-dom не реализован, поэтому в тестах это шпион. Проверяется ветка адаптера, а **не** реальное копирование браузера.

### Native — `apps/mobile/src/platform/clipboard.native.test.ts`

Мок `expo-clipboard`, 4 теста: успех `setStringAsync` → `true`; `false` → `false`; rejected promise → `false`; синхронное исключение → `false`. Во всех ветках проверяется один вызов с точным текстом.

### Границы

- `copy-link.ts` и экран не менялись: их тесты по-прежнему мокают `copyText`.
- Owner-схема с обязательным `publicToken` (часть Q-30) не затрагивалась — это F9.
- Runtime-проверка копирования из F10 (Q-14, `EXPO_PUBLIC_WEB_ORIGIN`) не выполнялась.
- F5, F8 и остальная очередь не начаты.

## Файлы

- `apps/mobile/src/platform/clipboard.test.ts` — новый, web-адаптер.
- `apps/mobile/src/platform/clipboard.native.test.ts` — новый, native-адаптер.
- `_bmad-output/implementation-artifacts/spec-f6-clipboard-adapters.md` — спека F6.
- `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-plan.md` — статус F6 и уточнение F10.
- `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-queue.md` — запись по Q-30 **оставлена незакоммиченной**, как требовалось.
- `apps/web/AGENTS.md`, промпты, логи и keyword-файлы оставлены как были, в коммиты не входят.

## Проверки (фактические результаты)

| Команда | Результат |
| --- | --- |
| Focused `vitest` (clipboard web/native, `copy-link`, `my-wishlist-screen`) | 4 файла, 83 теста, 0 падений |
| `npm run typecheck` | успешно: mobile, web (prisma generate + next typegen + tsc), contracts, ui |
| `npm run lint` | успешно: web, mobile, contracts, ui + `check-boundaries` без ошибок |
| `npm test` | mobile 42 файла / 570 тестов; web 46 / 489; contracts 6 / 164; ui 14 / 78; `check-boundaries` 5/5. Итого 1306 тестов, 0 падений |
| `npm run build` | успешно: Expo-web экспорт, Prisma generate, Next.js 16.4.3 standalone (19 маршрутов + middleware), copy-standalone-assets |

Сборка не изменила отслеживаемые файлы, кроме уже бывшего грязным `apps/web/AGENTS.md`.

## Ревью

Blind Hunter дал 15 находок. Исправлено в тестах: проверки `toHaveBeenCalledTimes(1)` в failure-ветках; синхронный throw `writeText` и `clipboard` без `writeText`; убраны вакуумные проверки при подменённом `document`; спека получила Verification, актуальный `context`, точную формулировку об очистке и границы F9/F10.

Отклонено как low/вне F6: очистка при исключении `appendChild`/`select()` и `document.body === null` (прежние защитные ветки, в поддерживаемом потоке кнопки недостижимы); `execCommand`, вернувший `undefined` (в целевых браузерах boolean, вызывающий код и так трактует `undefined` как неуспех); восстановление фокуса после fallback (прежнее поведение редкой ветки); проверки внутренних атрибутов временного поля; интеграционный тест «адаптер + helper» (обе части уже покрыты раздельно).

## Что остаётся непроверенным

Реальная запись в буфер **не проверялась**:

- браузер: успех/отказ `navigator.clipboard`, поведение при отказе в разрешении и вне secure context, реальный возврат `document.execCommand("copy")`, очистка и фокус после fallback;
- iOS Safari: резервный путь с `readonly` + `select()` — известное слабое место `execCommand`, отдельно не проверено;
- Android Chrome/WebView и встраиваемые браузеры: `expo-clipboard`/`setStringAsync`, права и системный буфер;
- выбор `.native.ts` против `.ts` силами Metro при сборке web/устройства: тесты импортируют файлы напрямую и этот выбор не проверяют;
- сквозной сценарий кнопки и toast на реальном устройстве: тест экрана мокает `copyText`.

Всё перечисленное — только mock/happy-dom проверки. Успешное копирование в реальном браузере, Android и iOS из F6 **не доказано**; утверждать обратное нельзя. Runtime-проверка копирования в сборке остаётся за F10, реальные устройства — за ручным проходом.

## Одноразовая PostgreSQL

По прежним проверкам и содержимому репозитория изолированного одноразового окружения нет: `fixup-F1-report.md` прямо фиксирует его отсутствие, `fixup-plan.md` держит F5 в статусе «ждёт окружения», compose-файла с БД в репозитории нет. В F6 PostgreSQL не поднималась, подключение и секреты не читались, `migrate`/`seed` не запускались. F5 не начат.

## Очередь после F6

Порядок из `fixup-plan.md`: **F5** — только при появлении одноразовой PostgreSQL; **F8** (Q-09) — следующий кодовый пункт после F4; **F10** (Q-14) — origin и runtime-проверка копирования; **F9** (Q-13) — ждёт продуктового решения по строке `List`. Пункты P2/P3 не начинались. Story 2.4 остаётся в `review`; F6 не переводит её в `done`.

Следующий пункт не начат.
