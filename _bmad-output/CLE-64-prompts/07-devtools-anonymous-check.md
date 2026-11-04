# CLE-64 / 07 — проверка «нет Anonymous в дереве React» + фиксы displayName

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Зачем
Критерий готовности CLE-64: в React DevTools нет `Anonymous` для наших компонентов (в задаче — тост «Изменения сохранены.»). Код уже объявляет компоненты именованно, нужно доказать это в рантайме.

## Что сделать
1. Создать dev-скрипт `apps/mobile/scripts/list-anonymous-components.mjs` (Node, ESM, именованные функции), который принимает путь к HTML/URL не нужен — вместо этого экспортирует функцию `collectAnonymous(rootFiber)`; и web-тест `apps/mobile/src/ui/component-names.test.tsx`: рендерит (как другие тесты в репо) ключевые компоненты `ToastHost` (info с текстом «Изменения сохранены.»), `ConfirmDialog`, `WishCard`, `VisibilityChip`, `VisibilityPicker`, `GhostButton`, `PrimaryButton`, `GiftForm`, `TextField` и проверяет, что у каждого экспортированного компонента из `src/ui/*.tsx` есть непустое `name` или `displayName` (для forwardRef/memo — `render.name`/`type.name`). Перебирать экспорты модулей `src/ui/*.tsx` программно (import.meta.glob или явный список — посмотри, что поддерживает vitest-конфиг).
2. Если найдётся компонент без имени — исправить объявление (или задать displayName для фабрик).
3. Скрипт `list-anonymous-components.mjs` не нужен, если тест покрывает задачу — тогда не создавать (реши сам, отчитайся).

## Ожидаемый результат
Тест падает, если кто-то добавит анонимный компонент в `src/ui`; сейчас зелёный. Живую проверку DevTools делаю я (ревьюер) отдельно.

## Тесты
Новый тест + все существующие.
