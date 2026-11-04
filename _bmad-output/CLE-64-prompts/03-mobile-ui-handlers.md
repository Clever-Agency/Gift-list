# CLE-64 / 03 — apps/mobile/src/ui: именованные обработчики вместо inline-стрелок

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Аудит (main f0f9910)
Компоненты в `src/ui` уже именованные (forwardRef в `ghost-button.tsx:30`, `gift-form.tsx:138` — с именованной функцией). Inline-стрелки в JSX-обработчиках (`on*={() => …}`), не считая style-колбэков:
- `toast.tsx` — 6 (onPointerEnter/onPointerLeave ~152-153, onFocus/onBlur ×2 ~167-178);
- `gift-form.tsx` — 4; `author-link.tsx` — 1; `ghost-button.tsx` — 1; `text-field.tsx` — 1; `visibility-picker.tsx` — 1.
Найди точное место через `git grep -n -E "on[A-Z]\w*=\{\s*(async\s*)?\(" -- apps/mobile/src/ui ':!*.test.*'`.
Плюс анонимные колбэки в `useEffect(() => …)`/`setTimeout(() => …)` и `.then(…)` в этих файлах — переименовать, где это улучшает читаемость (`useEffect(function syncScreenReader() {…})` и т. п.); cleanup-функции эффектов — тоже именованные (`return function stopListening() {…}`).

## Что сделать
1. Каждое inline-стрелочное значение `on*` вынести в именованную функцию внутри компонента (`function handlePointerEnter() { setHovered(true); }`), передавать по ссылке. Если нужен аргумент — именованная функция-обёртка.
2. Колбэки эффектов/таймеров — именованные function expressions.
3. НЕ трогать: style-колбэки `style={({ pressed }) => …}`, `.map/.filter`-колбэки, публичные API/пропсы компонентов, тексты, стили, порядок хуков. Не вводить useCallback, если его не было (кроме случаев, где функция в deps эффекта — тогда оставить как есть).

## Ожидаемый результат
В `src/ui` (не тесты) нет inline-стрелок в `on*`-пропсах; поведение то же, все тесты проходят без изменения ожиданий.

## Тесты
Существующие тесты `src/ui/*.test.tsx` должны пройти без правок. Новые тесты не нужны.
