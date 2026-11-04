# CLE-64 / 04 — apps/mobile/app (экраны) и src/session: именованные обработчики и хелперы

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Аудит (main f0f9910)
Экраны — `export default function XScreen()` (уже именованные). Найдено:
- inner-стрелки: `app/(auth)/login.tsx:75` и `app/(auth)/register.tsx:91` — `const fieldError = (…) => …` → `function fieldError(…)`.
- inline-стрелки в `on*`-пропсах: `gifts/[id]/edit.tsx` 3, `gifts/new.tsx` 2, `(app)/index.tsx` 3, `settings.tsx` 2, `forgot.tsx` 1, `login.tsx` 2, `register.tsx` 1, `reset.tsx` 1 (найти: `git grep -n -E "on[A-Z]\w*=\{\s*(async\s*)?\(" -- apps/mobile/app`).
- `src/session/*.ts(x)` (не тесты): 13 анонимных колбэков (эффекты/промисы/подписки) — назвать там, где это колбэк эффекта, подписки или cleanup.

## Что сделать
1. `const fn = () =>` внутри компонентов → `function fn()`.
2. Inline `on*={() => …}` → именованные обработчики `handleX`.
3. Колбэки `useEffect`, `useFocusEffect`, `navigation.addListener`, `beforeunload`, cleanup — именованные function expressions.
4. НЕ трогать: style-колбэки, `.map/.filter`, маршруты, тексты, логику навигации/защиты несохранённых изменений (CLE-65), `app/_layout.tsx` порядок провайдеров.

## Ожидаемый результат
Нет inline-стрелок в on*-пропсах экранов; поведение (назад, отмена, ConfirmDialog, тосты, видимость) неизменно.

## Тесты
Все существующие тесты `src/session/*.test.tsx` проходят без изменения ожиданий.
