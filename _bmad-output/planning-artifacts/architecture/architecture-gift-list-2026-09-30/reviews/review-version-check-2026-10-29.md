---
review_type: version-reality-check
artifact: ARCHITECTURE-SPINE.md
sections:
  - AD-27
  - AD-26 (предложение про /wishlist/:token)
  - AD-17 (каталоги в packages/contracts)
  - Stack (i18n-строки)
date: 2026-10-29
reviewer: version-check
prior: reviews/review-version-check-2026-10-28.md
verdict: PASS WITH FIXES
---

# Проверка версий — Architecture Spine, правки 2026-10-29

**Вердикт: PASS WITH FIXES.** Выбор библиотек выдерживает проверку. `next-intl` и `use-intl` 4.14.9 — текущий `latest`, peer-зависимости допускают Next.js 16 и React 19.x. `createTranslator` действительно экспортируется из `use-intl/core`. `expo-localization` 58.0.5 совпадает с `bundledNativeModules` SDK 58. Но одна строка Stack взята из `npm view <pkg> version` без сверки с деревом зависимостей и неверна: `intl-messageformat` 12.1.4. Ещё в двух местах не хватает конкретики, без которой строитель ошибётся. Первое — набор полифилов Hermes. Второе — как JSON-каталоги из `packages/contracts` проходят typecheck и `exports`.

## Метод

Проверка выполнена 2026-10-29.

- `npm view` по `next-intl`, `use-intl`, `expo-localization`, `intl-messageformat`, `@formatjs/intl-pluralrules`, `@formatjs/intl-locale`, `@formatjs/intl-numberformat`, `@formatjs/intl-datetimeformat`, `@formatjs/intl-getcanonicallocales`, `expo`, `react-native`: версии, dist-tags, `peerDependencies`, `dependencies`, `exports`.
- `npm pack` и разбор опубликованных tarball. В `use-intl@4.14.9` и `next-intl@4.14.9` проверены точки входа, импорты и вызовы `Intl.*`. В `intl-messageformat@11.2.15` проверены вызовы `Intl.*`. В `@formatjs/intl-pluralrules@6.3.16` проверены `polyfill-force.js` и `locale-data/ru.js`. В `expo@58.0.21` прочитан `bundledNativeModules.json`.
- Документация: next-intl (core library, runtime requirements, App Router without i18n routing), Hermes Intl API, FormatJS polyfills (`intl-pluralrules`, `intl-locale`).
- Репозиторий: `packages/contracts/package.json` и `tsconfig.json`, `apps/web/next.config.*`, `apps/web/package.json`.

## Сводка

| # | Серьёзность | Где | Суть |
| --- | --- | --- | --- |
| F1 | Medium | Stack | `intl-messageformat` 12.1.4 не та версия, что ставит `use-intl@4.14.9`: там диапазон `^11.1.0`, фактически 11.2.15 |
| F2 | Medium | AD-27 Hermes | Набор полифилов указан неточно. Для Hermes нужен `polyfill-force`. Обязателен только `Intl.PluralRules`. Остальные полифилы описаны словами «при нужде» без критерия и без пинов |
| F3 | Medium | AD-17 / AD-27 Каталоги | В `packages/contracts` JSON сейчас не проходит typecheck: нет `resolveJsonModule`, а `include` берёт только `*.ts`. В `exports` есть только `"."`, поэтому подпути с JSON закрыты для Metro и Next |
| F4 | Low | AD-27 Библиотеки | Если `apps/web` импортирует `use-intl/core`, он берёт фантомную транзитивную зависимость. `next-intl` сам реэкспортирует `use-intl/core` |
| F5 | Low | AD-27 Язык / AD-26 | Язык из `Accept-Language` делает `/l`, `/i`, `/unsubscribe` зависимыми от заголовка. При кэшировании на хостинге нужен `Vary: Accept-Language` или `no-store` |
| I1 | Info | Stack (вне дельты) | `expo` latest уже 58.0.21, в спайне пин 58.0.20. Это патч, на решения не влияет |

## Подтверждено

| Утверждение спайна | Проверка | Итог |
| --- | --- | --- |
| next-intl / use-intl 4.14.9 | `npm view`: `latest` = 4.14.9 у обоих (опубликованы 2026-10-02); `next-intl@4.14.9` зависит от `use-intl ^4.14.9` | OK |
| next-intl 4.x поддерживает Next.js 16 App Router | `peerDependencies.next`: `^12 … ^16.0.0`; `react`: `^19.0.0` (веб на 19.2.8) | OK |
| Без сегмента языка в URL | Официальный сценарий «App Router without i18n routing»: `i18n/request.ts` + `createNextIntlPlugin`. `proxy.ts`/middleware не нужен | OK |
| use-intl в Expo SDK 58 (React 19.3) | `peerDependencies.react`: `^19.0.0`. Пакет ESM с `exports` (`.`, `./core`, `./react`, `./format-message`), Metro поддерживает `exports`. Доки next-intl называют React Native поддерживаемой средой для `use-intl` | OK |
| `createTranslator` из `use-intl/core` | `dist/esm/production/core.js` экспортирует `createTranslator`, `createFormatter`, `hasLocale`, `initializeConfig`; доки «Core library» показывают ровно этот импорт | OK, с оговоркой: `use-intl/core` не рендерит React, но импортирует модуль `react` (`isValidElement` в `format-message`). В `apps/web` это безопасно. Поэтому сам `use-intl` нельзя класть в `packages/contracts`, и спайн этого не делает |
| expo-localization 58.0.5 под SDK 58 | `bundledNativeModules.json` в `expo@58.0.21`: `"expo-localization": "~58.0.5"`; `latest` = 58.0.5 | OK |
| @formatjs/intl-pluralrules 6.3.16 | `latest` = 6.3.16; есть `polyfill-force.js` и `locale-data/ru.js` (и `be.js` на будущее) | OK (версия), см. F2 (способ подключения) |
| RN 0.88 / React 19.3.0 | `bundledNativeModules`: `react-native` 0.88.1, `react` 19.3.0 | OK |

## Находки

### F1 — Medium: неверная версия `intl-messageformat` в Stack

**Факт.** `npm view use-intl@4.14.9 dependencies` возвращает `"intl-messageformat": "^11.1.0"`. Последняя версия ветки 11 — 11.2.15. Версия 12.1.4 (опубликована 2026-10-19) — это `latest` пакета, но под `^11.1.0` она не подходит. Строка «intl-messageformat (через use-intl) 12.1.4» противоречит сама себе: через `use-intl` приедет 11.x. Если строитель поставит 12.1.4 явно, в бандле окажутся две копии парсера ICU. Возможны и расхождения форматирования между копиями.

**Как исправить.** Строку заменить на «intl-messageformat — транзитивно через use-intl (`^11.1.0`, сейчас 11.2.15); отдельно не ставить». Можно и убрать строку. Тогда в правило AD-27 добавить: «`intl-messageformat` напрямую не импортируется». В дисклеймер под Stack добавить, что транзитивные версии сверены по `npm view <pkg>@<ver> dependencies`.

### F2 — Medium: полифилы Hermes описаны неточно

**Факт.**
- Hermes (официальный список Intl API) нативно поддерживает `Intl.Collator`, `Intl.NumberFormat`, `Intl.DateTimeFormat` и `Intl.getCanonicalLocales`. **Не поддерживает** `Intl.PluralRules`, `Intl.Locale`, `Intl.RelativeTimeFormat`, `Intl.ListFormat`, `Intl.DisplayNames`. `NumberFormat.formatToParts` есть только на Android. На iOS не работают `notation: 'compact'|'engineering'` и `signDisplay`. На Android поведение зависит от версии ICU в ОС.
- `intl-messageformat@11.2.15` использует `Intl.Locale` только под guard'ом `typeof Intl.Locale === "undefined"`. Значит, `Intl.Locale` для работы ICU-сообщений не обязателен. `Intl.PluralRules` для `{count, plural, …}` обязателен.
- FormatJS для Hermes прямо требует `@formatjs/intl-pluralrules/polyfill-force.js`, а не `polyfill.js`. Детект в `polyfill.js` на Android медленный и добавляет секунды к старту. Сначала подключается полифил, потом `locale-data/ru.js`.
- `@formatjs/intl-locale@5.3.12` тянет `@formatjs/intl-getcanonicallocales` и `@formatjs/intl-supportedvaluesof`. `getCanonicalLocales` в Hermes уже есть.
- Список next-intl «Runtime requirements» включает `RelativeTimeFormat`, `ListFormat` и `DisplayNames`. Они нужны только при использовании `format.relativeTime`, `format.list` и `format.displayName`. `format.dateTimeRange` требует `DateTimeFormat.formatRange`.

Сейчас спайн пинит только `intl-pluralrules`. Порядок и вариант `polyfill-force` не указаны. `intl-locale` подаётся как обязательный. «При нужде» для `numberformat` и `datetimeformat` ничем не определено, поэтому два строителя решат по-разному.

**Как исправить.** Заменить абзац **Hermes** на:
«На Android и iOS (не на вебе) первым импортом точки входа, до `IntlProvider`: `@formatjs/intl-pluralrules/polyfill-force.js`, затем `@formatjs/intl-pluralrules/locale-data/<locale>.js` для каждого из `SUPPORTED_LOCALES`. `Intl.Locale`, `NumberFormat` и `DateTimeFormat` не полифилятся, пока их не потребует smoke-тест. Тогда подключаются `@formatjs/intl-locale`, `@formatjs/intl-numberformat` и `@formatjs/intl-datetimeformat` в варианте `polyfill-force`, и их версии вносятся в Stack. `format.relativeTime`, `format.list`, `format.displayName` и `format.dateTimeRange` в приложении не используются, пока не подключён соответствующий полифил. Не используются и `notation: 'compact'`, и `signDisplay`. Smoke-тест: плюралы «1 желание · 3 желания · 5 желаний · 21 желание», цена в BYN и RUB (AD-25), дата в формате `ru` на Android, iOS и в браузере».
Варианты для web-сборки: полифилы грузятся через `Platform.OS !== 'web'` или через платформенный файл `*.native.ts`.

### F3 — Medium: JSON-каталоги в `packages/contracts` сейчас не соберутся

**Факт.**
- `packages/contracts/tsconfig.json`: `"include": ["src/**/*.ts"]`, `resolveJsonModule` нет. `import ru from './ru/common.json'` упадёт на `npm run typecheck` (TS2732).
- В `packages/contracts/package.json` поле `exports` содержит только `{".": "./src/index.ts"}`. Импорт `@gift-list/contracts/i18n/ru/app.json` закрыт и в Next (Turbopack и webpack уважают `exports`), и в Metro (`unstable_enablePackageExports` включён по умолчанию в новых версиях Metro и Expo).
- Пакет `"type": "module"`. Нативный Node ESM требует `with { type: 'json' }` для JSON. Бандлеры (Turbopack, Metro, Vite/Vitest) импортируют JSON без атрибутов. Синтаксис атрибутов в Babel-пресете Expo — лишний риск.
- Сами бандлеры JSON поддерживают. В Next пакет уже в `transpilePackages`, `turbopack.root` указывает на корень монорепо. В Metro `json` входит в `sourceExts` по умолчанию. Так что затея осуществима, если явно задать способ подключения.

**Как исправить.** В AD-27 «Каталоги» дописать:
«Каталоги отдаются только через `src/i18n/index.ts`, который реэкспортируется из `src/index.ts`. Внутри пакета каталог подключается относительным импортом JSON без import attributes. Подпути `@gift-list/contracts/...` не используются, `exports` не расширяется. В `packages/contracts/tsconfig.json` включены `resolveJsonModule: true` и `include` с `src/**/*.json`».
Альтернатива: хранить каталоги как `ru/app.ts` с `export default {...} as const`. Тогда `tsconfig` не меняется, а типизация ключей через `AppConfig.Messages` у `use-intl` получается бесплатно. Один из вариантов нужно зафиксировать, иначе веб и Expo выберут разные. Отдельно AD-26 перечисляет содержимое `packages/contracts` как «zod-схемы AD-12, gift card, коды ошибок» без каталогов. С AD-17 и таблицей Contract это расходится, поэтому в AD-26 нужно добавить «каталоги переводов AD-27».

### F4 — Low: `use-intl/core` в `apps/web` — фантомная зависимость

**Факт.** В `next-intl@4.14.9` файлы `dist/types/react-client/index.d.ts` и `react-server/index.d.ts` содержат `export * from 'use-intl/core'`. Значит, `createTranslator` доступен как `import { createTranslator } from 'next-intl'`. Если `apps/web` импортирует `use-intl/core` напрямую, а в `apps/web/package.json` нет `use-intl`, импорт опирается на hoisting npm workspaces. Правило «поднимать парой» тогда ничем не контролируется.

**Как исправить.** Писать «письма и cron в `apps/web` — `createTranslator` из `next-intl` (реэкспорт `use-intl/core`); `use-intl` как прямая зависимость только в `apps/mobile`, точная версия, равная `next-intl`». Второй вариант — добавить `use-intl` точной версией в `apps/web` и проверять равенство версий в тесте или скрипте.

### F5 — Low: кэш серверных страниц при выборе языка по `Accept-Language`

**Факт.** Язык в `getRequestConfig` вычисляется из `headers()`, поэтому страница рендерится динамически. Страницы с токенами (`/l/:token`, `/i/:token`, `/unsubscribe/:token`) и так динамические, поэтому решение работает. Но если ответы кэширует хостинг или CDN, а второй язык появится в `SUPPORTED_LOCALES`, без `Vary: Accept-Language` один язык достанется всем. Краулеры превью ссылок обычно шлют `en` или ничего и получат `ru`. С пилотом это согласуется.

**Как исправить.** В AD-27 «Язык пользователя» дописать: «Ответы Next-страниц с выбором языка — `Cache-Control: private, no-store` или `Vary: Accept-Language`».

### Примечание к AD-26 (`/wishlist/:token`)

Предложение реалистично. SPA из `expo export --platform web` отдаётся через `rewrites().fallback` после собственных маршрутов Next. Next путь `/wishlist` не обслуживает. Пути без языкового сегмента совместимы с App Links и Universal Links. Для этого `/wishlist/*` нужно перечислить в `android.intentFilters` (pathPrefix) и в `applinks.details[].components` файла AASA, а AASA отдавать с `Content-Type: application/json`. Это уровень эпика. Что `?next=` принимается только как относительный путь того же origin, к версиям не относится, но стоит проверить в эпике входа. `expo-localization` на вебе берёт язык из `navigator.languages`, так что правило «язык устройства через `expo-localization`» работает на всех трёх платформах.

## Источники

- npm: `npm view` / `npm pack` по `next-intl@4.14.9`, `use-intl@4.14.9`, `intl-messageformat@11.2.15|12.1.4`, `@formatjs/intl-pluralrules@6.3.16`, `@formatjs/intl-locale@5.3.12`, `expo-localization@58.0.5`, `expo@58.0.21` (`bundledNativeModules.json`), `react-native@0.88.1` — 2026-10-29
- https://next-intl.dev/docs/environments/core-library
- https://next-intl.dev/docs/environments/runtime-requirements
- https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing
- https://raw.githubusercontent.com/facebook/hermes/main/doc/IntlAPIs.md
- https://formatjs.github.io/docs/polyfills/intl-pluralrules
- https://formatjs.github.io/docs/polyfills/intl-locale
- https://nextjs.org/docs/app/getting-started/proxy
