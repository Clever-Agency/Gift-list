# R3 / F6 — отчёт об устранении находки аудита

Дата: 2026-11-06
Ветка: `evivanchikov/story-24-25-auth-fixups`
База: `8606138` (`86061383154214018c80da3904c0f96a9d9be4eb`, отчёт R2)
Коммит R3: `a189956` (`a189956957f49072cdcb89a069d4e5140cfb6d4c`)
Статус: R3 — `done`; R1 и R2 — `done`; партия R1–R3 завершена. R1/R2 не переделывались.
Задача без истории Linear: микрозадача устранения находки независимого аудита F6, критерии продукта не меняются.

## Что было сломано

В `apps/mobile/src/platform/clipboard.ts` функция `legacyCopy` делала:

```ts
document.body.appendChild(field);
field.select();
try {
  return document.execCommand("copy");
} catch {
  return false;
} finally {
  field.remove();
}
```

`appendChild` и `select()` стояли до `try`. Если `select()` бросал исключение, управление покидало функцию до входа в `try/finally`, поэтому временный `textarea` оставался в `document.body`. `copyText` при этом завершался отказом промиса, а внешний `copyWishlistShareLink` (`apps/mobile/src/wishlist/copy-link.ts:21-28`) переводил отказ в `"failed"`: пользователь видел ошибку копирования, но узел оставался в DOM.

Тот же изъян касался `appendChild`, который успел вставить узел и затем бросил: `finally` в этом случае также не выполнялся.

## Что исправлено

- `apps/mobile/src/platform/clipboard.ts`:
  - `appendChild` и `select()` перенесены внутрь `try`;
  - `field.remove()` стоит в `finally` и выполняется на каждом пути. `remove()` — no-op, если узел не был присоединён, и снимает узел, если `appendChild` успел его вставить и затем бросил;
  - вложенный `try/catch` вокруг `document.execCommand("copy")` сохранён без изменений, поэтому его бросок по-прежнему даёт `false`;
  - добавлен короткий комментарий, объясняющий, почему `remove()` безопасен без проверки факта присоединения.
- `apps/mobile/src/platform/clipboard.test.ts`:
  - новый кейс «`select()` бросил»: промис отклоняется с прежней ошибкой, `execCommand` не вызывается, `textarea` в `document` нет;
  - новый кейс «`appendChild` отказал до присоединения»: промис отклоняется, `execCommand` не вызывается, узла нет;
  - новый кейс «`appendChild` вставил узел и затем бросил»: промис отклоняется, узел снят;
  - в `afterEach` добавлен `vi.restoreAllMocks()`, чтобы шпионы `HTMLTextAreaElement.prototype.select` и `document.body.appendChild` не протекали между тестами;
  - прежние кейсы `execCommand` true/false/throw и отсутствия `document` сохранены.
- `_bmad-output/implementation-artifacts/spec-audit-r3-clipboard-cleanup.md` — BMAD-спека R3, `status: done`.
- `_bmad-output/implementation-artifacts/opencode-microtasks/audit-remediation-plan.md` — R3 переведён в `done` с фактическими гейтами; статусы R1/R2 не менялись.

Сохранённые контракты:

- успешный `navigator.clipboard.writeText` по-прежнему возвращает `true` и не запускает фолбэк;
- отказ `writeText` по-прежнему переходит к `execCommand("copy")`;
- `execCommand`, вернувший `false` или бросивший исключение, по-прежнему даёт `false`;
- бросок `select()`/`appendChild` по-прежнему завершает промис отказом, а не превращается в «успех» или «тихий `false`»; `copyWishlistShareLink` ловит его и отдаёт `"failed"`;
- `clipboard.native.ts`, сигнатуры `copyText`/`copyWishlistShareLink`, строки интерфейса и контракты AD-12 не менялись.

## Доказательство регрессии

Новые тесты прогнаны против кода `HEAD` до правки (временно восстановленная версия `clipboard.ts`) и против исправленной версии:

- на старом коде: 2 падения из 12 — «cleans up and rejects when select throws» и «cleans up when appendChild attaches the field and then fails»; в обоих в DOM оставался `<textarea readonly style="position: fixed; opacity: 0;">`;
- на новом коде: focused-набор зелёный.

Это подтверждает, что тесты ловят именно исходный дефект, а не просто фиксируют текущее поведение.

## Гейты (фактические)

- Focused: `npm run test -w @gift-list/mobile -- src/platform/clipboard.test.ts src/wishlist/copy-link.test.ts src/platform/clipboard.native.test.ts` — 3 файла / 22 теста, падений 0.
- `npm run typecheck` — код 0 (mobile, web с `prisma generate`/`next typegen`, contracts, ui).
- `npm run lint` — код 0, включая `node scripts/check-boundaries.mjs`.
- `npm test` — mobile 43 файла / 598, web 48 / 518, contracts 6 / 164, ui 14 / 81, 5 проверок границ; падений 0.
- `npm run build` — standalone-сборка Next.js успешна, Expo-web экспорт пересобран.

Живая БД не использовалась: изменение чисто клиентское и от PostgreSQL не зависит. Секреты и `.env*` не читались и не менялись.

## Ограничения

- Реальный буфер обмена в браузере и на устройстве не проверялся: тесты идут в `happy-dom` с подменёнными `navigator.clipboard`, `select()` и `execCommand`. Поведение iOS Safari/Android и системного буфера не воспроизводилось.
- `select()` в обычном браузере на практике не бросает; кейс закрыт юнит-регрессией, а не живым воспроизведением. Аудит также не воспроизводил его вживую.
- Тест «`appendChild` вставил узел и затем бросил» имитирует частичное присоединение через шпион; реальный `appendChild` либо вставляет узел, либо бросает до вставки, поэтому это защитный сценарий, а не воспроизведение известного бага браузера.
- `clipboard.native.ts` не менялся: `expo-clipboard` не затронут, native-гейты остались прежними.
- Blind Hunter как отдельный длительный цикл не запускался по границам захода (bounded completion); после зелёных гейтов работа завершена.

## Итог партии R1–R3

- R1/F4: код `ae01bc0` (`ae01bc01f0da4ffce2993cc3bafd8f1d17fba342`), отчёт `658ebdc` (`658ebdc0352e5450cc6e3081169eb970f93ffe2b`).
- R2/F10: код `5557e57` (`5557e57d1a1453d72051380710fa40240e206bfb`), отчёт `8606138` (`86061383154214018c80da3904c0f96a9d9be4eb`).
- R3/F6: код/тесты/спека/план `a189956` (`a189956957f49072cdcb89a069d4e5140cfb6d4c`), этот отчёт — отдельным коммитом.

Незакрытых пунктов R1–R3 нет. Ветка не пушилась, PR не открывался, `main` не менялся.
