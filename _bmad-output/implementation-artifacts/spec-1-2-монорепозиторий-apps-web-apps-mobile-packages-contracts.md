---
title: '1.2 Монорепозиторий: apps/web, apps/mobile, packages/contracts'
type: 'refactor'
created: '2026-10-28'
baseline_commit: '258096f45b2d5f3cc49f06ebf1089af4065ebcb2'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Next.js-проект лежит в корне репозитория, поэтому приложению Expo (Story 1.3) и общему контракту (Story 1.4) некуда встать; типы конверта AD-12 живут внутри веба и не могут быть общими (D-41, AD-26).

**Approach:** Перенести Next.js через `git mv` в `apps/web` без изменения поведения, сделать корень npm workspaces (`apps/*`, `packages/*`) со скриптами-прокси, вынести контракт AD-12 (конверт и gift card) в `packages/contracts` на zod, завести пустой workspace `apps/mobile` и один корневой `package-lock.json`.

## Boundaries & Constraints

**Always:**
- Перенос через `git mv`, чтобы история файлов сохранилась. Пути Prisma (`src/db/schema.prisma`, `src/db/migrations`) остаются относительными внутри `apps/web`.
- Версии зависимостей не меняются; Next/Prisma/Better Auth — только в `apps/web/package.json`. `zod` в `packages/contracts` — тот же диапазон `^4.6.5`.
- `packages/contracts` — без React, Prisma, `process.env`; `apps/web` импортирует `@gift-list/contracts`; в `next.config.ts` — `transpilePackages`.
- `output: 'standalone'` собирается из монорепозитория (корень трассировки — корень репозитория).
- Секреты и `.env*` только в `apps/web`; `.env` копируется вручную и в git не попадает.

**Never:**
- Не трогать логику регистрации двух списков (её переписывает Story 1.5), не ставить Expo, не менять Vercel-настройки, не трогать `_bmad-output/planning-artifacts/ux-designs/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Успех | `{ ok: true, data }` с валидным data | `actionResultSchema(data)` принимает | N/A |
| Ошибка | `{ ok: false, code: "VALIDATION", message, fieldErrors }` | принимается | N/A |
| Неизвестный код | `code: "TEAPOT"` | отклоняется | zod error |
| Gift card | объект AD-12 с `reservedBy: null`, `priceCurrency: null` | принимается | N/A |
| Лишнее поле в gift card | напр. `bought: true` | отклоняется (закрытый набор, AD-15 п.5) | zod error (`strict`) |

</frozen-after-approval>

## Code Map

- `src/**` → `apps/web/src/**` — весь код 1.1 и устаревший код двух списков; содержимое не меняется, кроме импорта контракта.
- `src/lib/contracts.ts` — `ERROR_CODES`, `ErrorCode`, `ActionResult<T>` (TS-типы без zod); единственный потребитель — `src/actions/register.ts:11` (`import type { ActionResult }`).
- `src/db/schema.prisma` — генератор `prisma-client`, `output = "./generated"` → `.gitignore` `/src/db/generated` нужно перепривязать к `apps/web`.
- `package.json` — скрипты (`postinstall: prisma generate`, `typecheck: next typegen && tsc --noEmit`), `overrides` (`deepmerge-ts`, `mysql2`) — overrides работают только в корне workspaces.
- `prisma.config.ts`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `components.json`, `postcss.config.mjs`, `next.config.ts`, `.env.example` — переезжают как есть; пути в них относительно каталога проекта.
- `AGENTS.md` — блок `nextjs-agent-rules` пишет `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`): проверить, в какой каталог он пишет после переноса.
- `.env` основной копии репозитория — `E:/Projects/CleverAgency/Gift-list/.env` (в worktree нет).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/*` -- `git mv` перечисленных файлов и `src/` -- перенос без изменения поведения
- [x] `apps/web/package.json` -- зависимости и скрипты прежнего корня + `@gift-list/contracts` -- Next/Prisma только в web
- [x] `apps/web/next.config.ts` -- `transpilePackages`, `output: 'standalone'`, `outputFileTracingRoot`/`turbopack.root` = корень -- AD-16 в монорепозитории
- [x] `packages/contracts/{package.json,src/index.ts,src/*.test.ts,tsconfig.json}` -- zod-схемы кодов ошибок, конверта, ответа списка, gift card; типы через `z.infer`; тесты матрицы -- AD-12
- [x] `apps/web/src/actions/register.ts` -- импорт из `@gift-list/contracts`; удалить `src/lib/contracts.ts`
- [x] `apps/mobile/package.json` -- минимальный private workspace -- для Story 1.3
- [x] `package.json` (корень), `package-lock.json`, `.gitignore` -- workspaces, прокси-скрипты, overrides; lock пересоздать `npm install`
- [x] `README.md`, `AGENTS.md`, `CLAUDE.md` -- структура монорепозитория; одна копия блока Next.js
- [x] `sprint-status.yaml` -- 1-2 → review

**Acceptance Criteria:**
- Given корень репозитория, when `npm run build|test|lint|typecheck`, then все проходят; `apps/web/.next/standalone` создан и содержит `server.js`.
- Given `packages/contracts`, when ищем `react|prisma|process.env`, then совпадений нет.
- Given `apps/web`, when ищем `lib/contracts`, then импортов нет.

## Implementation Notes

- Реализовано в этой сессии напрямую, без отдельного субагента реализации; поручение стартовой сессии принято как утверждение спеки (Checkpoint 1).
- `git mv` сохранил историю: `src/` и конфиги → `apps/web/`, корневой `package.json` → `apps/web/package.json` (имя `@gift-list/web`), `src/lib/contracts.ts` → `packages/contracts/src/index.ts`, `AGENTS.md` (блок Next.js) → `apps/web/AGENTS.md`. `overrides` остались в корне — npm читает их только там.
- Lock: чистый `npm install` без lock поднимал транзитивные версии (better-auth 1.7.6 → 1.7.14 и ещё ~90 пакетов), поэтому lock пересобран поверх старого: сверка скриптом — 0 изменённых и 0 пропавших версий, добавлены только 6 записей workspaces.
- `next dev` пишет блок агентских правил в каталог проекта (`app-info-log.js` → `writeAgentFiles(dir)`), то есть в `apps/web`. `hasCurrentAgentRules("apps/web")` = true, второй копии не будет. Корневой `AGENTS.md` описывает структуру и ссылается на `apps/web/AGENTS.md`.
- `outputFileTracingRoot` и `turbopack.root` заданы явно: worktree лежит внутри основной копии со своим lock, автоопределение корня могло выбрать её. Сервер standalone — `apps/web/.next/standalone/apps/web/server.js`; smoke: `node server.js` отдаёт 200 на `/` и `/register`.
- `next start` при `standalone` работает (200), но печатает предупреждение; README описывает запуск через `node … server.js` для Docker.
- `.env` скопирован из основной копии в `apps/web/.env`, git его игнорирует. `migrate`: после восстановления проекта Supabase из паузы `prisma migrate status` из `apps/web` нашёл 2 миграции, «Database schema is up to date».
- Проверено из корня: `typecheck`, `lint`, `test` (web 12, contracts 14), `build`.

## Spec Change Log

## Review Triage Log

- blind/edge/vgap: `ActionResult<T>` написан руками, а не через `z.infer` — `medium` → **patch**: ошибка выведена из `actionErrorSchema`, тест `expectTypeOf` сверяет тип со схемой.
- vgap/blind: вложенные `reservedBy`/`tags` строгие, но не покрыты тестами — `medium` → **patch**: добавлен тест на лишние ключи.
- blind/edge/vgap: `listDataSchema` пропускает `not_found` с желаниями — `medium` → **patch**: discriminated union, у `not_found` `gifts` — пустой кортеж; тесты на отказ и на `gifts`.
- blind/edge: конверт не строгий, gift card строгий — `low` → **patch**: обе ветви конверта `strictObject`, тест.
- edge: текст ошибки `prisma.config.ts` указывает на `.env` без каталога — `low` → **patch**: путь `apps/web/.env`.
- edge: `next start` при `standalone` — `low` → **patch** (README): запуск через `node …/server.js`; `next start` проверен, отвечает 200 с предупреждением.
- edge/vgap: AC «standalone содержит `server.js`», файл лежит во вложенном `apps/web/` — `false`: файл внутри `standalone` есть; путь записан в Implementation Notes и README.
- blind/edge: цена < 0, `linkUrl`/даты как произвольные строки, пустой `title` — `low` rejected: AD-12 задаёт `number|null` и `string|null`; проверка ввода — Story 2.2, контракт не сужаем сверх архитектуры.
- edge: `RESERVED` без `reservedBy` — `false`: при `holderVisibleToOwner=false` владелец получает `RESERVED` с `reservedBy: null` (AD-15 п.5), такой guard сломал бы правило.
- edge: цена без валюты — `low` rejected: AD-12 описывает поля независимо; правило USD по умолчанию — Story 2.2.
- blind: zod объявлен дважды — `false`: `npm ls zod` — одна копия 4.6.5, `deduped`.
- blind: lock нет в диффе — `false`: исключён из ревью намеренно, версии сверены скриптом (0 изменений).
- blind: README про Vercel противоречит «не менять Vercel-настройки» — `false`: запрет касается действий агента; поручение требует описать изменение настройки, README и отчёт его описывают.
- blind: поведение `next dev` для AGENTS.md не подтверждено — `false`: проверено по коду генератора и `hasCurrentAgentRules`, см. Implementation Notes.
- blind: статус спеки/sprint-status расходится — `false`: метаданные процесса на момент снимка диффа; обновляются шагом 5.
- blind: нет `engines`/`packageManager` — `low` rejected: как в 1.1, README фиксирует Node; npm 7+ обязателен для любого Node 20.
- blind: нет `test:watch`/`migrate:deploy` в корне — `low` rejected: README даёт команду; прокси-набор задан поручением.
- blind: `packages/contracts` не линтуется, границы AD-17 не проверяются автоматически — `medium` → **defer**: правило импорта нужно вместе с `apps/mobile` (Story 1.3).
- vgap: нет автоматической проверки standalone-сборки — `medium` → **defer**: CI нет, место — GitHub Actions по AD-5.
- edge: `.gitignore` не покрывает артефакты Expo — `low` rejected: Story 1.3 добавит игноры вместе с Expo.

## Design Notes

`test` и `typecheck` в корне идут по workspaces (`--workspaces --if-present`), чтобы тесты и типы `packages/contracts` тоже проверялись; `dev`, `build`, `start`, `lint`, `migrate` — прокси на `apps/web`. Пакет отдаёт исходники TS (`exports` → `src/index.ts`): сборки у пакета нет, Next транспилирует его через `transpilePackages`, Metro (Story 1.3) — сам.

## Verification

**Commands:**
- `npm install` (корень) -- один lock, `prisma generate` из postinstall `apps/web`
- `npm run typecheck && npm run lint && npm test && npm run build` -- зелёные
- `npm run migrate` -- только при доступной БД из `apps/web/.env`
