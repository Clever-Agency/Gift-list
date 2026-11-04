# CLE-64 / 05 — apps/web и packages/contracts: хелперы-стрелки → именованные функции

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Аудит (main f0f9910)
- React-компоненты apps/web (`src/app/layout.tsx`, `src/components/*`) уже именованные; анонимных `export default` нет.
- `apps/web/src/lib/env.ts:12` `const blankToUndefined = (…) =>`, `:22` `const positiveIntEnv = (…) =>` → `function`.
- Прочие анонимные колбэки в `src/lib` (15), `src/actions` (2), `src/domain` (1), `src/db` (1), `packages/contracts/src` (~9, в т.ч. zod `.refine/.transform`) — переименовать только колбэки, которые являются самостоятельной логикой (refine/transform/superRefine, обработчики ошибок, `(async (tx) => …)` — по возможности `async function inTransaction(tx)`). Однострочные `.map/.filter` не трогать.

## Что сделать
Переписать перечисленное в именованные функции без изменения типов, сигнатур экспортов и поведения. Ничего в `src/db/generated`, Prisma-схеме, миграциях, `.env*`.

## Тесты
`apps/web` и `packages/contracts` тесты проходят без правок ожиданий.
