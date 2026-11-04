# CLE-64 / 01a — правки примеров в `.cursor/rules/named-functions.mdc`

Рабочая папка `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions`. Не коммить, не пушь, не запускай npm ci. Меняй ТОЛЬКО `.cursor/rules/named-functions.mdc`.

1. В разделе «Компоненты» пример «хорошо»: имя переменной и имя функции должны совпадать, как в коде проекта (`apps/mobile/src/ui/ghost-button.tsx`): `export const GhostButton = forwardRef(function GhostButton(props, ref) {…});`. В «плохо» соответственно `const GhostButton = forwardRef((props, ref) => …)`.
2. В разделе «Остальные функции» пример `useEffect(loadItems, [])` вводит в заблуждение (функция, переданная напрямую, может случайно вернуть значение как cleanup). Заменить на именованную function expression, как в проекте принято:
   ```tsx
   useEffect(function loadOnMount() {
     load();
   }, []);
   ```
   и добавить пример именованного cleanup: `return function stopListening() { subscription.remove(); };`.
3. Пример `items.map(toRow)` оставить, но добавить рядом однострочный `items.map((item) => item.id)` как допустимую стрелку.
Проверка: `npm run lint`.
