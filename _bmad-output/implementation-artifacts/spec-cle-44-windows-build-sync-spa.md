---
title: 'CLE-44: npm run build на Windows — переносимый запуск expo export в sync-spa.mjs'
type: 'bugfix'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `apps/web/scripts/sync-spa.mjs` запускает `spawnSync("npm", [...])` без `shell`. На Windows `npm` — это `npm.cmd`, поэтому `npm run build` падает с `Error: spawnSync npm ENOENT` ещё до `expo export`. Без истории (CLE-44, инфраструктура сборки); решения AD-26, D-41. Найдено при ручной проверке CLE-43, ранее отмечено в спеке CLE-41.

**Approach:** Запускать Expo CLI напрямую текущим Node: `process.execPath` + путь к CLI из пакета `expo`, разрешённый от `apps/mobile`, с `cwd` = `apps/mobile`. Без shell — аргументы (в том числе `--output-dir` с пробелами) уходят как есть, поведение одинаково на Windows и Linux CI. Остальные скрипты сборки (`apps/web/scripts/copy-standalone-assets.mjs`, `scripts/check-boundaries.mjs`) проверить на ту же проблему.

</frozen-after-approval>

## Implementation Notes

- `sync-spa.mjs`: вместо `spawnSync("npm", ["exec", "-w", "@gift-list/mobile", "--", "expo", ...])` — `spawnSync(process.execPath, [expoCli, "export", ...], { cwd: apps/mobile })`. Путь CLI даёт `resolveBin()`: `createRequire` от `apps/mobile/package.json` → `expo/package.json` → поле `bin.expo` (`bin/cli`). Свой `exports` у `expo` открывает `./bin/*`, но чтение `bin` из манифеста не зависит от `exports`.
- Почему не `npm.cmd` и не `shell: true`: прямой запуск `.cmd` без shell после CVE-2024-27980 даёт `EINVAL`, а shell требует экранирования путей с пробелами. Причина — в комментарии у вызова.
- `cwd` теперь `apps/mobile`, как и у `npm exec -w @gift-list/mobile`; `.bin` в `PATH` больше не добавляется — Expo CLI его не требует, экспорт собирается.
- Остальные скрипты сборки (`apps/web/scripts/copy-standalone-assets.mjs`, `scripts/check-boundaries.mjs`) дочерних процессов не запускают — правки не нужны.
- Изменены: `apps/web/scripts/sync-spa.mjs`, `deferred-work.md` (закрыт пункт про `spawnSync npm ENOENT`).
- Проверено на Windows 11, Node 24.22.1: `npm run build` (expo export → `apps/web/public/`, `prisma generate`, `next build`, копирование standalone) — exit 0; `npm run typecheck`, `npm test`, `npm run lint` — exit 0. Linux — в CI PR.

## Review Triage Log

- low (patch): комментарий не объяснял, почему не `npm.cmd`/`shell: true`; дополнен.
- low (patch): пункт про `spawnSync npm ENOENT` в `deferred-work.md` не закрыт; закрыт.
- false: пустые Implementation Notes и статус `in-progress` — ревью шло до финализации спеки; заполнено.
- false: нет свидетельств проверки — записаны выше.
- false: «CLE-41 не упоминал проблему» — `spec-1-4-клиент-expo-api-клиент-и-сессия-приложения.md` (спека CLE-41), строки 82 и 132.
- low (reject): лишний `readFileSync` рядом с `fs/promises` — стиль, синхронное чтение одного манифеста уместно.
- maybe-false low (reject): `npm exec` добавлял `.bin` и `npm_*` в окружение — экспорт и сборка прошли; проявится, только если Expo начнёт звать бинарники по имени.
- low (reject): общее сообщение `require.resolve`, если `expo` не установлен — штатная ошибка Node понятна, ветка редкая.
- false: `bin` Expo может стать shell-шимом — бинарники npm-пакетов запускаются Node; `npm exec` упал бы так же.
- low (reject): нет `.gitattributes` для LF — не вызвано этой правкой, предупреждение git о `core.autocrlf` в рабочей копии.
