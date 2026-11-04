# CLE-64 / 06 — тестовые файлы: именованные хелперы

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Аудит
- Моки `React.forwardRef(function Pressable…)` в тестах уже именованные.
- Стрелочные константы-хелперы: `src/session/form-issue.test.ts:4,5,51,52` (t, common, fake, err), `login-screen.test.tsx:72`, `my-wishlist-screen.test.tsx:165,1007,1224`, `confirm-dialog.test.tsx:270,306`, `gift-card.test.tsx:116`, `visibility-chip.test.tsx:108`, `apps/web/src/lib/api-v1.test.ts:34`.
- Колбэки `describe/it/vi.fn/beforeEach` (сотни) — НЕ трогать: это идиоматичный стиль тестов.

## Что сделать
Перечисленные `const x = (…) => …` → `function x(…) {…}` (с тем же поведением). Ничего больше в тестах не менять, ожидания не менять.

## Тесты
Все тесты проходят, их количество не меняется (424/368/130).
