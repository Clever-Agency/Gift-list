# Brand assets

`source/` — мастера, правятся руками:

- `wishmoon-mark.svg` — детальный знак, белый `#FEFEFE` квадрат 1024×1024. Источник для всех размеров, кроме 16 px.
- `wishmoon-mark-16.svg` — упрощённый знак для 16 px: толстый контур и три крупных кратера.

`generated/` — всё остальное. Пересобирать только скриптом из корня:

```
node scripts/generate-brand-icons.mjs
```

Скрипт рендерит через hoisted `sharp` (новых зависимостей не добавляет), пишет растры в `generated/` и копирует их по местам подключения: `apps/mobile/assets` (иконки Expo), `apps/mobile/public` (корень SPA: favicon, apple-touch-icon, PNG 192/512/maskable, `site.webmanifest`) и `apps/web/src/app` (`favicon.ico`, `icon.png`, `apple-icon.png` для страниц Next). Правки в `generated/` и копиях вручную не сохраняются.

Фон иконок — белый `#FEFEFE`, как в исходном SVG; бумажный `#F4F1EA` — только `theme_color`/`background_color` манифеста. Диск луны в adaptive-иконке занимает 66 % холста, в maskable — 80 %.
