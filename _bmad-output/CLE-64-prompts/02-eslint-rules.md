# CLE-64 / 02 — ESLint: react/function-component-definition + react/display-name (S2)

Рабочая папка: `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions` (от main f0f9910, уже активна). Только локальные изменения: НЕ коммить, НЕ пушь, НЕ запускай `npm ci`/`npm install`, не трогай `.env*`, Prisma, миграции, Linear. Перед работой прочитай `AGENTS.md` (и `apps/web/AGENTS.md` для apps/web, `.cursor/rules/ux-design.mdc` для UI). Поведение и внешний вид менять нельзя — это чистый рефакторинг именования. Комментарии в коде — в стиле файла.

Linear CLE-64 (spec):
- S1: все React-компоненты — именованные функции (`function X(){}` / `export function X`), без `export default () =>`, анонимных `memo(() =>)` / `forwardRef((…) =>)`; где нельзя (фабрики) — задать `displayName`.
- S2: линтер: `react/display-name` и `react/function-component-definition` (named function declarations).
- S3: правило в инструкциях агентов: «Компоненты — только именованные функции; анонимные компоненты запрещены».
- Готово: в React DevTools нет `Anonymous` для наших компонентов; lint, typecheck, тесты проходят; поведение не изменилось; правило в инструкциях и в конфиге линтера.

Договорённость проекта (пользователь): в коде используем именованные функции, не анонимные. Исключение: однострочные style-колбэки `style={({ pressed }) => [...]}` у Pressable и колбэки-аргументы простых методов массивов (`.map(x => …)`, `.filter`) — их не трогаем.

Обязательные проверки в конце (из корня): `npm run typecheck`, `npm test`, `npm run lint` (включает check-boundaries). Отчёт: список файлов, что сделано, результаты проверок.

## Что сейчас
- `apps/mobile/eslint.config.mjs`: flat-конфиг `eslint-config-expo/flat.js` (плагин `react` уже подключён).
- `apps/web/eslint.config.mjs`: `eslint-config-next/core-web-vitals` + `typescript` (плагин `react` уже подключён).
- `packages/contracts` — без React, правило не нужно.
- Проверено: прогон `npx eslint . --rule` с обоими правилами в apps/mobile и apps/web даёт 0 нарушений — включение ничего не должно сломать.

## Что сделать
1. В оба конфига добавить объект правил (для `**/*.{ts,tsx,js,jsx}`):
   ```js
   rules: {
     "react/display-name": "error",
     "react/function-component-definition": ["error", {
       namedComponents: "function-declaration",
       unnamedComponents: "function-expression",
     }],
   }
   ```
   с коротким комментарием «CLE-64: компоненты — только именованные функции (см. AGENTS.md)».
2. Тестовые файлы НЕ исключать (там моки `forwardRef(function Pressable…)` уже именованные).
3. Убедиться, что правило реально срабатывает: временно (не сохраняя) проверь на файле-примере `const Foo = () => <View/>` через `npx eslint --stdin --stdin-filename src/ui/tmp.tsx` в apps/mobile и apps/web; в отчёт — вывод (ожидаем ошибку function-component-definition). Файл-пример в репозиторий не добавлять.
4. Ничего кроме двух eslint-конфигов не менять.

## Ожидаемый результат
`npm run lint` зелёный; анонимный компонент даёт ошибку линтера в обоих приложениях.
