---
title: 'F6: адаптеры clipboard и посильные runtime-тесты (Q-30)'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/apps/mobile/src/platform/clipboard.ts'
  - '{project-root}/apps/mobile/src/platform/clipboard.native.ts'
  - '{project-root}/apps/mobile/src/platform/clipboard.test.ts'
  - '{project-root}/apps/mobile/src/platform/clipboard.native.test.ts'
  - '{project-root}/apps/mobile/src/wishlist/copy-link.ts'
  - '{project-root}/apps/mobile/vitest.config.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Проблема:** Story 2.4 копирует ссылку через `copyText` из `apps/mobile/src/platform/clipboard.ts` (браузер: `navigator.clipboard`, при отказе — `execCommand("copy")`) и `clipboard.native.ts` (телефон: `expo-clipboard`). Оба адаптера проверены только косвенно: тесты `copy-link` и экрана мокают `copyText` целиком, поэтому успех и отказ `navigator.clipboard`, резервный путь `execCommand`, очистка временного поля, результат `expo-clipboard` и его исключение не покрыты. Без этого нельзя отличить реальную ошибку адаптера от ошибки вызывающего кода; реальный буфер в браузере, Android и iOS при этом не проверен.

**Подход:** добавить прямые unit-тесты обоих адаптеров на поддерживаемом Vitest/happy-dom: успешная запись, отказ и исключение `navigator.clipboard`, резервный `execCommand` (успех, `false`, исключение) с удалением временного поля, отсутствие `navigator.clipboard`/`document`, успех/`false`/исключение `expo-clipboard`. Продакшен-код менять только если тест покажет реальный дефект; реальную проверку буфера в браузере и на устройствах не имитировать и не заявлять.

</frozen-after-approval>

## Implementation Notes

- Добавлены `apps/mobile/src/platform/clipboard.test.ts` (web, `@vitest-environment happy-dom`) и `clipboard.native.test.ts` (мок `expo-clipboard`). Оба адаптера в проде не менялись: тесты подтвердили текущее поведение — успех и отказ обеих платформ, резервный `execCommand`, возврат `false` вместо исключения и удаление временного `textarea` при успехе и при исключении `execCommand`.
- Happy-dom не реализует `document.execCommand`, поэтому в web-тестах он подменяется шпионом; это проверка ветки адаптера, а не реального буфера браузера. `navigator.clipboard` в happy-dom существует как заглушка, поэтому каждый сценарий явно задаёт свой объект через `vi.stubGlobal`; после каждого теста глобалы восстанавливаются.
- Реальная запись в буфер не проверялась ни в браузере, ни на Android/iOS: runtime-проверки ограничены Vitest/happy-dom и моками. Не проверены также выбор `.native.ts`/`.ts` силами Metro при сборке, поведение iOS Safari с `readonly` + `select()` и встраиваемые WebView. Это остаётся ручной проверкой, а не доказанным результатом F6.
- Очистка поля подтверждена для успешного `execCommand`, его `false` и исключения. Ветки, где бросает `appendChild`/`select()`, и `document.body === null` тестами не покрыты; это прежнее защитное поведение адаптера, не дефект, проявившийся в F6.
- Runtime-проверка копирования из F10 (`fixup-plan.md`, Q-14) не выполнялась: F6 проверяет только адаптеры. Обязательный `publicToken` в owner-схеме (Q-30) относится к F9 и не затрагивался.
- Реальная PostgreSQL в F6 не использовалась и не поднималась; одноразового окружения по прежним проверкам нет, F5 не запускался.

## Verification

**Commands:**
- Focused: `npx vitest run src/platform/clipboard.test.ts src/platform/clipboard.native.test.ts src/wishlist/copy-link.test.ts src/session/my-wishlist-screen.test.tsx` — 4 файла, 83 теста, 0 падений.
- `npm run typecheck` — успешно, все 4 workspace.
- `npm run lint` — успешно, включая `scripts/check-boundaries.mjs`.
- `npm test` — mobile 42/570, web 46/489, contracts 6/164, ui 14/78, `check-boundaries` 5/5; итого 1306 тестов, 0 падений.
- `npm run build` — успешно: Expo-web экспорт, Prisma generate, Next.js 16.4.3 standalone, copy-standalone-assets.

## Review Triage Log

- `appendChild`/`select()` вне `try/finally` может оставить поле при исключении — **low, не менялось**: в поддерживаемом браузерном потоке `select()` не бросает, а `appendChild` требует отсутствующего `body`; это прежняя защитная ветка, не проявившаяся в F6. Ограничение записано.
- `document.body === null` пробрасывает исключение — **low, не менялось**: кнопка копирования доступна только после монтирования приложения, когда `body` уже есть; отдельный guard не нужен для Story 2.4.
- `execCommand` может вернуть `undefined` — **low, не менялось**: в целевых браузерах возвращается boolean, а вызывающий код и так трактует `undefined` как неуспех; приведение к `=== true` не меняет пользовательского результата.
- Нет проверок `select()`, `readonly`, позиционирования поля — **low, отклонено**: это внутренние детали реализации; тесты проверяют поведение и очистку, а не разметку временного узла.
- В failure-ветках нет `toHaveBeenCalledTimes(1)` — **исправлено**: добавлены проверки одного вызова в web- и native-тестах.
- Не покрыт синхронный throw `writeText` и `clipboard` без `writeText` — **исправлено**: добавлены оба сценария с переходом на `execCommand`.
- `expect(execCommand).not.toHaveBeenCalled()` при подменённом `document` ничего не доказывает — **исправлено**: вакуумные проверки убраны, осталось `resolves.toBe(false)`.
- Фокус и выделение не восстанавливаются после резервного пути — **low, вне F6**: это прежнее поведение редкой ветки, а восстановление фокуса меняет сценарий Story 2.4; отмечено в отчёте.
- Нет интеграционного теста «реальный адаптер + `copy-link`» — **low, отклонено**: helper и адаптеры покрыты раздельно, связь — один импорт; дублирующий тест не даёт новой защиты.
- Тесты импортируют адаптеры напрямую и не проверяют выбор файла Metro — **верно, ограничение**: записано в Implementation Notes и отчёте как непроверенное.
- В спеке не было Verification и финального статуса — **исправлено** в этом заходе; план и отчёт обновлены.
- В `context` спеки не было новых тестов — **исправлено**: добавлены оба тестовых файла и `copy-link.ts`.
- Формулировка об очистке была шире проверенного — **исправлено**: указано, что очистка доказана для `execCommand`, но не для `appendChild`/`select()`.
- Не отмечены F10 и F9 в границах Q-30 — **исправлено**: runtime-проверка копирования остаётся за F10, owner-схема — за F9.
- Упоминание PostgreSQL и отсутствие явного списка непроверенных сред — **исправлено**: PostgreSQL оставлен только как факт окружения, среды перечислены явно.
