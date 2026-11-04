# CLE-64 / 01 — правило «только именованные функции» в инструкциях агентов (S3)

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Что сейчас
- `AGENTS.md` (корень, 49 строк): блок `<!-- bmad:context -->…<!-- /bmad:context -->` управляется bmad-project-context и перезаписывается — ВНУТРЬ блока НЕ писать. После блока есть раздел `## Epic acceptance testing`.
- `CLAUDE.md` = `@AGENTS.md` (opencode и Claude читают AGENTS.md). `apps/web/AGENTS.md` — блок nextjs-agent-rules, его не трогать.
- `.cursor/rules/` — только `ux-design.mdc`. Правила про именование нигде нет.

## Что сделать
1. В корневом `AGENTS.md` ПОСЛЕ `<!-- /bmad:context -->` добавить раздел `## Code style: named functions` (по-русски, как остальной текст вне блока можно по-русски): 
   - Компоненты React — только именованные объявления функций (`export function GiftCard() {}` / `export default function Screen() {}`); анонимные компоненты запрещены: никаких `const X = () => <…/>`, `export default () =>`, `memo(() =>)`, `forwardRef((props, ref) =>)` — передавать именованную функцию: `forwardRef(function GhostButton(props, ref) {…})`.
   - Если компонент создаётся фабрикой/HOC — задать `displayName`.
   - Прочие функции (хелперы, обработчики событий, колбэки эффектов где разумно) — тоже именованные (`function handlePress() {}`); допустимы стрелки только для однострочных style-колбэков Pressable и простых колбэков методов массивов.
   - Правило проверяет ESLint (`react/function-component-definition`, `react/display-name`) в apps/mobile и apps/web.
2. Создать `.cursor/rules/named-functions.mdc` (frontmatter как у ux-design.mdc: description, `globs: apps/**/*.ts, apps/**/*.tsx, packages/**/*.ts`, `alwaysApply: false`) с тем же правилом коротко и примерами «плохо/хорошо».
3. Не трогать содержимое bmad-блока, `apps/web/AGENTS.md`, `_bmad/`.

## Ожидаемый результат
Правило есть в AGENTS.md (вне управляемого блока) и в `.cursor/rules/named-functions.mdc`; CLAUDE.md подхватывает его через @AGENTS.md. Код не меняется.

## Проверки
Только `git diff --stat` (код не трогается) и `npm run lint`.
