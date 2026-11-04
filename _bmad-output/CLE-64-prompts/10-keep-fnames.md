# CLE-64 / 10 — имена компонентов в минифицированной web-сборке (keep_fnames)

Рабочая папка `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions`. Только локальные правки: НЕ коммить, НЕ пушь, не запускай npm install/ci, не трогай .env*.

Проблема: `:3000` раздаёт `expo export --platform web` (минифицировано metro-minify-terser). Terser переименовывает объявления функций (`function WishCard` → `function a`), поэтому в React DevTools карточка `WishCard` и др. видны как `Anonymous`, хотя в коде они именованные.

Сделай в `apps/mobile/metro.config.js` (стиль файла, комментарий по-английски как у соседних строк, коротко):

```js
// CLE-64: keep function and class names in minified web exports so React DevTools
// shows component names (WishCard, ToastHost, …) instead of Anonymous.
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  keep_fnames: true,
  keep_classnames: true,
  mangle: { ...(config.transformer.minifierConfig?.mangle ?? {}), keep_fnames: true, keep_classnames: true },
  compress: { ...(config.transformer.minifierConfig?.compress ?? {}), keep_fnames: true, keep_classnames: true },
};
```

Если `config.transformer.minifierConfig.compress` или `mangle` в дефолте равны `false`/не объекты — не превращай их в объект (сохрани `false`), обработай аккуратно через именованную функцию-хелпер `withKeptNames(options)`.

Больше ничего не менять. Проверки из корня: `npm run typecheck`, `npm test`, `npm run lint`. Отчёт: дифф.
