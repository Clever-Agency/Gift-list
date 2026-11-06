---
title: 'R3/F6: гарантированное снятие временного textarea в веб-буфере'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** в `apps/mobile/src/platform/clipboard.ts` функции `legacyCopy` вызовы `document.body.appendChild(field)` и `field.select()` стоят до `try`. Если `select()` бросает исключение, `finally` не выполняется, временный `textarea` остаётся в DOM, а `copyText` завершается отказом промиса. Внешний `copyWishlistShareLink` (`apps/mobile/src/wishlist/copy-link.ts`) переводит отказ в `"failed"`, поэтому пользователь видит ошибку, но узел остаётся в документе.

**Approach:** поместить `appendChild` и `select()` внутрь `try`, а снятие узла вынести в `finally`, который выполняется всегда. `field.remove()` безопасен и когда узел не был присоединён, и когда `appendChild` успел вставить узел, но затем бросил. Результаты и ошибки не меняются: успешный `navigator.clipboard.writeText` по-прежнему не запускает фолбэк, отказ `execCommand` даёт `false`, бросок `select()`/`appendChild` по-прежнему завершает промис отказом (его ловит `copyWishlistShareLink`). `clipboard.native.ts` не меняется.

</frozen-after-approval>

## Implementation Notes

- `apps/mobile/src/platform/clipboard.ts`: `legacyCopy` теперь делает `appendChild` + `select()` внутри `try`, а `field.remove()` — в `finally`. Вложенный `try/catch` вокруг `execCommand("copy")` сохранён: его бросок по-прежнему даёт `false`. Комментарий в `finally` объясняет, что `remove()` покрывает и неприсоединённый узел, и частичное присоединение.
- `apps/mobile/src/platform/clipboard.test.ts`: добавлены регрессии — бросок `select()` (промис отклоняется, `execCommand` не вызывается, `textarea` в DOM нет); отказ `appendChild` до присоединения; `appendChild`, который вставил узел и затем бросил (узел снят). В `afterEach` добавлен `vi.restoreAllMocks()`, чтобы шпионы прототипа и `body` не протекали между тестами. Прежние кейсы `execCommand` true/false/throw и очистки сохранены.
- Границы: сигнатуры `copyText` и `copyWishlistShareLink`, строки интерфейса, ветка `navigator.clipboard`, native-адаптер и контракты AD-12 не менялись. Задача без истории Linear — микрозадача устранения находки аудита F6.
