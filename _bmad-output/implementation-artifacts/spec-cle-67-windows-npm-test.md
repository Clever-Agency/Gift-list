---
title: 'Стабильный npm test на Windows'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** На Windows 11 после чистого `npm ci` параллельный `npm test` в `apps/web` падает по таймауту холодного импорта (`auth.test.ts` до 15,7 с при лимите 5 с, `unknown-routes.test.ts` до 9 с и 5,05 с, хук `password-reset.test.ts` на 10 с). Те же файлы по отдельности проходят. Корневой скрипт `test` связан через `&&`, поэтому при падении workspace не запускается `scripts/check-boundaries.test.mjs`.

**Approach:** Сделать полный `npm test` из корня стабильным на Windows, не ослабляя утверждения тестов. Проверка границ выполняется даже если тесты workspace упали, а ненулевой код выхода сохраняется. Пункт в `deferred-work.md` закрыть.

</frozen-after-approval>

## Implementation Notes

- Лимиты только в `apps/web/vitest.config.ts`: `testTimeout` и `hookTimeout` по 30 с. Воркеры не уменьшал: зелёный прогон не должен стать медленнее, а 5,05 с на прогретом втором прогоне показывает, что узкое место — лимит, а не число процессов. Утверждения `auth.test.ts`, `unknown-routes.test.ts` и `password-reset.test.ts` не менялись.
- Корневой `test` — `node scripts/run-suite.mjs`. Оба шага всегда идут; код выхода — первый ненулевой (`null` → 1). На Windows `npm` запускается через `shell: true` (CLE-44: `npm.cmd` без shell даёт ENOENT, прямой запуск `.cmd` — EINVAL). `node` запускается без shell, чтобы пути с пробелами не ломались. Каталог запуска — `realpathSync.native`: Git Bash отдаёт `e:\`, а загрузчик ESM — `E:\`, и Vitest поднимает две копии `@vitest/runner`.
- Шов `RUN_SUITE_STEPS` читает только сам раннер и не передаёт его детям. `scripts/run-suite.test.mjs` проверяет код 3 при упавшем первом шаге (второй всё равно пишет маркер) и код 2, когда падает только второй шаг.
- Пункт в `deferred-work.md` закрыт CLE-67, перечислены все три файла.
- Канонический каталог снял падение «reading 'config'». Дальше полный прогон на Windows падал из‑за двух копий React и незаданного `__DEV__` в `expo-modules-core`. Конфиг mobile — `vitest.config.mts` (нативный загрузчик Vite не читает ESM-конфиг `.ts` в CommonJS-пакете), `define: { __DEV__: "true" }`, `test.server.deps.inline: true`. В web инлайнятся только React, `react-dom`, `scheduler`, `tamagui` и `@tamagui/*` регулярками с обоими разделителями пути: `inline: true` после `npm ci` уводил холодный импорт `auth.test.ts` за 30 с. После сужения инлайна и очистки кэша Vite на той же установке три `npm test` подряд зелёные: mobile 598, web 518, contracts 164, ui 81, границы и run-suite 7. `apps/mobile/tsconfig.json` включает `**/*.mts`, чтобы конфиг снова попадал в typecheck. Воркеры и утверждения тестов не менялись.

## Review Triage Log

- Сравнение `file:///e:/` и `file:///E:/` пропускает `main()` — false. Три полных `npm test` из этого Git Bash запустили все workspace. Сторож сравнивает `import.meta.url` с путём из argv, оба в регистре запуска; `realpathSync.native` используется только как cwd дочерних процессов.
- Тесты не фиксируют команды по умолчанию, снятие `RUN_SUITE_STEPS` и канонический cwd — low, отклонено. Контракт шва — два кода выхода, они есть. Дополнительные проверки шире простой правки.
- Пустой или кривой `RUN_SUITE_STEPS` подменяет или обрывает сюиту — false. Переменная не задана при обычном `npm test`; это шов тестов, а не путь прогона.
- `vitest.config.mts` вне typecheck, плюс `inline: true` и `__DEV__` — дыра typecheck реальная, medium: конфиг выпал из `**/*.ts`. Включён `**/*.mts`. Лимиты 5 с и `__DEV__` — false: mobile 598/598 прошёл трижды, в том числе с холодным кэшем.
- `packages/ui` не инлайнит React — false. Те же три прогона: ui 81/81, падение двух копий React было в mobile и web.
- `deferred-work.md` закрыт по старым временам, спека писала «ещё красный», лишний промпт ревью — ложное закрытие false: времена Epic 1 это исходное свидетельство. Устаревшая фраза в спеке заменена итогом трёх прогонов. Промпт ревью удалён.
