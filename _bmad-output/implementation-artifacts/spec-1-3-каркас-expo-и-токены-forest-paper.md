---
title: '1.3 Каркас Expo и токены Forest Paper'
type: 'feature'
created: '2026-10-31'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c9ebf6b5b1b5ad126b23e6860b07940552322216'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md'
  - '{project-root}/.cursor/rules/ux-design.mdc'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** В `apps/mobile` пустой workspace, веб не отдаёт SPA на том же домене, каталогов i18n нет, границы AD-17 не проверяются, а `globals.css` и шрифты веба отстают от Forest Paper.

**Approach:** Полная Story 1.3 (не срез): Expo SDK 58 на Android, iOS-бандле и в браузере, заглушки expo-router, токены и Lora+Manrope, раздача SPA через `apps/web` (AD-26), каркас i18n AD-27, lint границ, синхрон токенов и шрифтов веба. Черновик 2026-10-30, который откладывал SPA/i18n/lint/CSS, человек 2026-10-31 отменил — CLE-35 закрывается целиком.

## Boundaries & Constraints

**Always:**
- Expo **58.0.20** (не ниже; патч 58.0.x допустим только если 58.0.20 не ставится). React Native **0.88.0**. React и react-dom мобильного приложения **19.3.0**. Веб остаётся на React **19.2.8**. Без root `overrides` на `react` / `react-dom` / `react-native`.
- `expo-router`. Маршруты: `(auth)/login` → `/login`, `(auth)/register` → `/register`, `(app)/index` → `/`. Без auth-gate, вкладок, сессии и запросов к API.
- Анонимные экраны: логотип сверху (`{brand}`), блок шириной не больше `max-form` (560), внизу «Написать автору». Главная — заглушка вошедшего плюс smoke i18n и contracts.
- Токены mobile = полный `colors` / `typography` / `spacing` / `rounded` из frontmatter DESIGN.md §App, включая `surface`, `border-strong`, `ring-inverse`, `status-reserved` `#7A5E07`, `status-reserved-bg`, `scrim`. `globals.css` не источник истины для mobile.
- Шрифты mobile: `@expo-google-fonts/lora` 600 и `@expo-google-fonts/manrope` 400/500/600; экран не показывается, пока шрифты не загрузились или загрузка не упала. На заглушке видна кириллица этими шрифтами.
- `EXPO_PUBLIC_BRAND_NAME` (пустое → `Gift List` только в `src/config/env.ts`) и `EXPO_PUBLIC_API_BASE_URL` читаются статическим `process.env.EXPO_PUBLIC_*` только в этом модуле. В UI нет литерала бренда и URL API. Пустой API base показывает каталожную фразу «не задан», без исключения.
- Адрес «Написать автору» в спеке UX не задан: если `EXPO_PUBLIC_AUTHOR_URL` пуст, виден текст ссылки без перехода и без выдуманного email. `// NOTE FOR UX: адрес «Написать автору» не задан.`
- Строки UI — каталоги `packages/contracts/src/i18n`, не `placeholder-copy`. `{brand}` подставляет обёртка из env.
- `use-intl` **4.14.9** в mobile, `next-intl` **4.14.9** в web (одна версия). `intl-messageformat` прямым dependency не ставить и не импортировать.
- Каталоги, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE = 'ru'`, `negotiateLocale()`, `preferredFromAcceptLanguage()`, `normalizeForSearch()`, `formatPrice()`, `formatDate()`, `compareForSort()` — в `packages/contracts/src/i18n`, реэкспорт из `src/index.ts`. JSON без import attributes. Пространства `common`, `app`, `web`, `email`.
- Язык UI mobile — `expo-localization` **~58.0.5** через `negotiateLocale`, иначе `ru`.
- На Android и iOS первым импортом входного файла — полифил `@formatjs/intl-pluralrules` **6.3.16** (`polyfill-force`, затем `locale-data/ru`). В веб-сборке этого импорта нет. Вход — свой `index.ts`, который сначала тянет полифил, потом `expo-router/entry`.
- `expo-contacts` **~58.0.9** и `expo-secure-store` **~58.0.2** — зависимости и платформенные файлы `*.native.ts` / `*.web.ts`. Web-файлы не импортируют эти пакеты. Разрешение контактов не запрашивать.
- Runtime-smoke `@gift-list/contracts` (`ERROR_CODES` / `safeParse`) на главной, в бандле.
- SPA: `expo export --platform web` (`web.output: "single"`) перед `next build`, файлы в `apps/web/public/` (gitignored). Fallback rewrite отдаёт `spa-index.html` на всё, кроме префиксов Next: `/api`, `/l`, `/i`, `/unsubscribe`, `/admin`, `/.well-known`. Эти префиксы без своей страницы — 404 Next, не HTML приложения.
- Судьба конфликтующих страниц: удалить пользовательский UI Next — `app/page.tsx`, `(auth)/register/*`, `(app)/lists/page.tsx`. `/` — SPA. `/register` — SPA. `/lists` — тонкая страница Next: нет сессии → `redirect("/login")`, есть → `redirect("/")`. Server Action `src/actions/register.ts` и домен списков не трогать (Story 1.5).
- `apps/web` `globals.css`: `--status-reserved` `#7A5E07`; добавить `--surface` `#FFFFFF`, `--border-strong` `#8F8673`, `--ring-inverse` `#F4F1EA`, `--status-reserved-bg` `#F5E6B8`, `--scrim` `#1E241F` и соответствующие `--color-*` в `@theme`. Каждый `#9a7609` в этом файле заменить на `#7A5E07`. Шрифты layout — Lora 600 (`--font-heading`) и Manrope 400/500/600 (`--font-sans`), subsets `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`.
- `BRAND_NAME` в `envSchema` со значением по умолчанию `Gift List`. `getBrandName()` не требует `DATABASE_URL`. Заголовок layout — из `getBrandName()`, не литерал в JSX. `npm run build` веб-приложения без файла секретов не должен падать из-за этой переменной.
- Lint: `npm run lint` из корня проверяет web, mobile и contracts и падает, если `apps/mobile` содержит `apps/web` или `@gift-list/web`, или `packages/contracts/src` импортирует React/Prisma либо читает `process.env`.
- В `package.json` уже есть `allowScripts` для Prisma 7.10.0 — не удалять.
- После зелёной проверки sprint-status ключа `1-3-каркас-expo-и-токены-forest-paper` = `review` (не `done`: в статусах репозитория `done` ставится после ревью человеком). Комментарий ключа сохранить.

**Never:**
- Story 1.4 (маршрут `api/v1`, bearer, `Accept-Language` на запросах, `@better-auth/expo`), Story 1.5 (рабочая регистрация и один вишлист), Story 1.6–1.8, Story 2.6, оплата, вкладки, тёмная тема, shadcn в mobile, общий UI-пакет, root override React.
- Секреты, `.env` с реальными значениями, коммит `dist`, `.expo`, `public` со сборкой SPA, `android/`, `ios/`.
- Правки PRD, эпиков, `ARCHITECTURE-SPINE.md`.
- Импорт `apps/web` из mobile. React, Prisma и `process.env` в `packages/contracts`.
- Прямой импорт `intl-messageformat`. Полифил pluralrules в веб-бандле. Запрос разрешения контактов.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| negotiate-empty | `negotiateLocale([])` | `ru` | N/A |
| negotiate-unsupported | `negotiateLocale(["en-US"])` | `ru` | N/A |
| negotiate-region | `negotiateLocale(["ru-BY"])` | `ru` | N/A |
| negotiate-header | `preferredFromAcceptLanguage("en-US,ru;q=0.8")` затем `negotiateLocale` | `ru` | N/A |
| negotiate-header-en | `preferredFromAcceptLanguage("en;q=0.9")` | после negotiate — `ru` | N/A |
| negotiate-header-null | `preferredFromAcceptLanguage(null)` | `[]`, negotiate → `ru` | N/A |
| normalize-yo | `normalizeForSearch("Алёна")` и NFD-форма той же строки | `алена` | N/A |
| normalize-short-i | `normalizeForSearch("Йога")` | `йога` (`й` не заменяется) | N/A |
| format-date-only | `formatDate("2026-10-31", "ru")` | `31.10.2026` (календарный день не съезжает) | N/A |
| format-datetime-tz | `formatDate("2026-10-31T23:30:00.000Z", "ru", { timeZone: "Europe/Minsk" })` | дата `01.11.2026` | N/A |
| format-price-byn | `formatPrice(1050, "BYN", "ru")` | `10,50\u00a0BYN` | N/A |
| format-price-rub | `formatPrice(250000, "RUB", "ru")` | `2\u00a0500,00\u00a0₽` | N/A |
| format-price-bad | валюта вне `USD\|EUR\|CNY\|BYN\|RUB` | исключение, без UI-строки | throw |
| sort-names | `compareForSort("ru", ...)` для «Яна», «Алёна», «Алена» | порядок `Алена / Алёна / Яна` | N/A |
| catalog-brand | JSON каталогов | нет подстроки `Gift List` | N/A |
| plural-icu | `next-intl` `createTranslator` и ключ `app.smoke.wishes` для 1, 3, 5, 21 | `1 желание · 3 желания · 5 желаний · 21 желание` | N/A |
| next-owned | `/api`, `/api/auth`, `/l/abc`, `/i/abc`, `/unsubscribe/t`, `/admin`, `/.well-known/assetlinks.json` | `isNextOwnedPath` true | N/A |
| spa-owned | `/`, `/login`, `/register`, `/wishlist/x`, `/lists`, `/long`, `/invite` | `isNextOwnedPath` false (`/l` и `/i` не совпадают с префиксом как подстрока) | N/A |
| lists-anon | страница `/lists`, сессии нет | `redirect("/login")` | N/A |
| lists-session | страница `/lists`, сессия есть | `redirect("/")` | N/A |

</frozen-after-approval>

## Code Map

- `apps/mobile/package.json` — сейчас только имя `@gift-list/mobile`. Сюда Expo 58.0.20, `main`: `index.ts`.
- `bundledNativeModules` SDK 58.0.20: `react-native` 0.88.0, `expo-router` ~58.0.27, `expo-splash-screen` ~58.0.11, `expo-linking` ~58.0.14, `expo-constants` ~58.0.13, `expo-status-bar` ~58.0.4, `expo-font` ~58.0.10, `expo-localization` ~58.0.5, `expo-contacts` ~58.0.9, `expo-secure-store` ~58.0.2, `react-native-web` ~0.21.4, `react-native-screens` ~4.30.0, `react-native-safe-area-context` ~5.10.1. Ставить через версии SDK, не `latest`.
- `packages/contracts/src/index.ts` — уже экспортирует `ERROR_CODES`, `errorCodeSchema`, `CURRENCIES`. Реэкспорт i18n добавить, существующие схемы не ломать. Тесты: `src/index.test.ts` (vitest).
- `packages/contracts/tsconfig.json` — нет `resolveJsonModule`; `include` только `*.ts`.
- `apps/web/next.config.ts` — `output: "standalone"`, `outputFileTracingRoot`, `transpilePackages: ["@gift-list/contracts"]`. Rewrites пока нет. Это не ломать.
- `apps/web/src/app/page.tsx`, `(auth)/register/page.tsx`, `(auth)/register/register-form.tsx`, `(app)/lists/page.tsx` — пользовательский UI, удалить.
- `apps/web/src/actions/register.ts` — `redirect("/lists")` на строке 126. Не менять.
- `apps/web/src/lib/session.ts` — `getSession()`. `apps/web/src/lib/auth.ts` вызывает `getEnv()` при импорте: страница `/lists` может импортировать сессию, но тест страницы мокает `@/lib/session`, чтобы не требовать БД.
- `apps/web/src/lib/env.ts` — zod: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. `getEnv()` ленивый. Новое поле только через схему. `apps/web/.env.example` — образец без секретов.
- `apps/web/src/app/globals.css` — `--status-reserved: #9a7609` (строка 78), `--chart-4: #9a7609` (строка 83). Нет surface / border-strong / ring-inverse / status-reserved-bg / scrim.
- `apps/web/src/app/layout.tsx` — DM Sans + Fraunces, `title: "Gift List"`. Заменить шрифты и источник заголовка.
- `apps/web/eslint.config.mjs` — только Next. Корневой `lint` вызывает только web.
- `apps/web/package.json` `build` — `prisma generate && next build`. Вставить sync SPA перед этим.
- `.gitignore` — нет `.expo`, `dist`, `public` сборки.
- Корневой `package.json` — workspaces, `overrides` только `deepmerge-ts` и `mysql2`, плюс `allowScripts` Prisma. Скрипты `mobile:*` добавить, React override не добавлять.
- DESIGN.md frontmatter строки 16–128 — единственный источник чисел токенов. `lineHeight` в RN = `fontSize × множитель`, округление до целого: display 41, display-sm 29, heading 23, body-strong 22, body 24, button 18, label 20, caption 16. `letterSpacing` display = −0.36.
- Node в этой среде: `source "$HOME/.nvm/nvm.sh" && nvm use 24` (нужен ≥ 24.22.1; системный `node` может быть 22).

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/i18n/**` и реэкспорт в `src/index.ts` — каталоги `ru/{common,app,web,email}.json`, функции матрицы, `getMessages` — AD-27
- [x] `packages/contracts` тесты матрицы i18n + plural через `next-intl` не здесь, а в web; contracts-тесты без React — матрица кроме plural и страницы `/lists`
- [x] `apps/web/src/lib/spa-paths.ts` + тест `isNextOwnedPath` — префиксы AD-26
- [x] `apps/web/src/app/lists/page.tsx` + тест редиректа с моком сессии — `/lists`→`/login` или `/`
- [x] `apps/web/scripts/sync-spa.mjs` и `build` — `expo export --platform web` в `public/`, `index.html` → `spa-index.html`; абсолютные пути ассетов
- [x] `apps/web/next.config.ts` — fallback rewrite на `spa-index.html` для `/` и для путей, которые `isNextOwnedPath` отвергает; standalone и transpilePackages сохранить
- [x] Удалить `app/page.tsx`, `(auth)/register/*`, `(app)/lists/page.tsx` — пользовательский UI уходит в SPA
- [x] `globals.css`, `layout.tsx`, `env.ts`, `.env.example` — токены `#7A5E07` и недостающие переменные, Lora+Manrope, `BRAND_NAME`
- [x] `apps/web` тест plural ICU (`createTranslator` + каталог `app`) — строка четырёх форм
- [x] `apps/mobile/**` — Expo 58, expo-router заглушки, тема, шрифты и gate, env, платформенные stubs, use-intl, полифил первым импортом — каркас
- [x] ESLint mobile (`eslint-config-expo` 58.0.4) и contracts + `scripts/check-boundaries.mjs` в корневом `lint` — AD-17
- [x] `.gitignore`, корневые `mobile:start` / `mobile:web`, абзац README, зачёркивание закрытых пунктов CLE-35 в `deferred-work.md` — DX
- [x] Одна строка в `epic-1-context.md` про шрифты: Lora + Manrope, не Fraunces/DM Sans — чтобы кэш эпика не врал
- [x] `sprint-status.yaml` — ключ 1-3 → `review` после зелёных команд; комментарий не стирать

**Acceptance Criteria:**
- Given install, when `npm run typecheck`, `npm test`, `npm run lint` и `npm run build -w @gift-list/web`, then все зелёные; `npm ls react` в mobile и web — разные версии, в корневом `package.json` нет override React.
- Given mobile, when `expo export` web, android и ios, then бандл собирается; в web-бандле нет `expo-secure-store`, `expo-contacts` и `polyfill-force`; в android и ios бандле `polyfill-force` есть.
- Given `next build` и сервер standalone (или `next start`), when запрос `/` и `/login`, then HTML SPA, не старый лендинг; `/api/auth` не подменяется SPA; путь `/l/test` и `/api/v1/me` не отдают `spa-index.html`.
- Given тема mobile, when сверка `colors["status-reserved"]`, then `#7A5E07`, и в объекте есть `surface`, `border-strong`, `ring-inverse`, `status-reserved-bg`, `scrim`.
- Given главная, when она в бандле, then есть smoke contracts и ICU-строка желаний.
- Given исходники mobile кроме `src/config/env.ts` и store-имени в `app.config.ts`, when поиск `Gift List`, then пусто. Поиск `apps/web` и `@gift-list/web` в `apps/mobile` (без `node_modules`) пусто.
- iOS Simulator — Unverified; достаточно `expo export --platform ios`.

## Implementation Notes

- 2026-10-31: каркас Expo 58.0.20, каталоги AD-27, SPA fallback, lint границ и токены веба. `next build` без `.env` проходит, потому что Prisma и Better Auth создаются при первом использовании.
- Полифил в Hermes-бандле виден как `Intl.PluralRules` / `__addLocaleData`, не как текст `polyfill-force` (байткод). В web-бандле этих модулей нет.
- iOS Simulator не запускался. На главной smoke: четыре формы «желание», цены BYN/RUB, дата `31.10.2026`, сортировка имён.
- Адрес «Написать автору» не задан в UX: без `EXPO_PUBLIC_AUTHOR_URL` ссылка не ведёт никуда.



## Spec Change Log

## Review Triage Log

- `false` — `spa-paths` двойное экранирование `\\.well-known`. Скомпилированный regexp Next не совпадает с `/.well-known/assetlinks.json` и совпадает с `/login`.
- `high` → patch — прокси `auth` без ловушки `has`: `toNextJsHandler` проверяет `"handler" in auth` и иначе вызывает `auth()` как функцию. Добавлены `has` и `apply`, тест `auth.test.ts`.
- `high` → patch — `output: "standalone"` не копирует `public`. Сборка копирует `public` и `.next/static` в `standalone/apps/web`. Файл `spa-index.html` на месте.
- `medium` → patch — `sync-spa` стирал `public` до успешного export. Теперь сборка пишется в staging и подменяет каталог только после успеха.
- `medium` → patch — пустой `BRAND_NAME` ронял `getEnv()` и не ронял `getBrandName()`. Общая схема обрезает пробелы и подставляет значение по умолчанию.
- `medium` → patch — `fontWeight` вместе с отдельным именем файла шрифта на Android уводит кириллицу в системный шрифт. `textStyle` отдаёт только `fontFamily` загруженного начертания.
- `low` → patch — «Написать автору» без адреса было ссылкой. Теперь это текст; у настоящей ссылки нет двойной подписи, ошибка `openURL` глотается.
- `medium` → patch — проверка границ не видела `import "react"`, `export … from` и `process["env"]`. Регулярное выражение расширено.
- `false` — цена RUB с `₽` против «кода валюты» в UX. Матрица спеки фиксирует `2\u00a0500,00\u00a0₽`.
- `false` — порядок «Алёна / Алена / Яна» как ожидаемый результат сортировки. Матрица фиксирует порядок коллятора `Алена / Алёна / Яна`; цитата AD-27 — набор имён.
- `false` — `npm run dev` без SPA. README уже говорит, что оболочка появляется после `npm run build`.
- `low` → patch — в `deferred-work.md` под закрытым пунктом lint осталась старая evidence. Строка обновлена.
- `low` reject — `lineHeight: 44` у ссылок, нет skip-link и `main`. Для заглушки зона нажатия важнее; полный каркас доступности — экраны следующих историй.
- `defer` — в `common` нет деревьев `errors` и `notifications`. Истории 1.4+ наполняют их; пространства имён уже есть.
- `defer` — автопроверки `next.config` rewrites, HTML ассетов, `generateMetadata` и содержимого Hermes-бандла не вшиты в `npm test`. Поведение проверено сборкой, `path-to-regexp`, `curl` и `strings`. CI в репозитории нет.
- `false` — Metro `disableHierarchicalLookup` ломает вложенные пакеты. Export web, android и ios собрался.
- `low` reject — невалидная дата, пустой timeZone, нецелая сумма, `q > 1`, зависание export, `.mts`. Входные данные истории этого не делают; отдельная ветка обработки шире правки.



## Design Notes

Человек 2026-10-31 вернул в эту историю пункты, которые черновик 2026-10-30 вынес в `deferred-work.md` (SPA AD-26, i18n AD-27, lint AD-17, синхрон `globals.css` и Lora+Manrope). Один PR на весь CLE-35. Объём выше 1600 токенов осознанно: резать снова запрещено.

`/lists` остаётся маршрутом Next только как редирект, чтобы старый `redirect("/lists")` в action регистрации не падал в несуществующий экран SPA. Двойной переход «action → /lists → /» для уже созданной сессии — временный, Story 1.5 перепишет action.

Полифил не встаёт первым, если `main` равен `expo-router/entry`. Поэтому `main` — `index.ts`.

`formatPrice` / `formatDate` завязаны на `Intl` Node 24. Числа в матрице сняты с Node 24.22 (`\u00a0` — NBSP). Hermes может сгруппировать пробел иначе; на устройстве smoke показывает результат функции, точное равенство фиксирует vitest.

## Verification

**Commands:**
- `source "$HOME/.nvm/nvm.sh" && nvm use 24` — `node -v` ≥ 24.22.1
- `npm install` из корня; новые пакеты только `-w @gift-list/mobile` или `-w @gift-list/web` или `-w @gift-list/contracts`. Если npm 11 блокирует install-скрипты Expo, `npm install-scripts approve` для нужных пакетов и не коммитить лишнее, кроме уже существующего `allowScripts` Prisma.
- `npm ls react react-dom -w @gift-list/mobile` и `-w @gift-list/web` — 19.3.0 и 19.2.8, без root override
- `npm run typecheck && npm test && npm run lint && npm run build -w @gift-list/web`
- `npm exec -w @gift-list/mobile -- expo export --platform web --output-dir dist-web`
- `npm exec -w @gift-list/mobile -- expo export --platform android --output-dir dist-android`
- `npm exec -w @gift-list/mobile -- expo export --platform ios --output-dir dist-ios`
- `rg "expo-secure-store|expo-contacts|polyfill-force" apps/mobile/dist-web` — пусто
- `rg "polyfill-force" apps/mobile/dist-android apps/mobile/dist-ios` — есть совпадения
- `rg "Gift List" apps/mobile/app apps/mobile/src -g '!**/env.ts'` — пусто
- `rg "apps/web|@gift-list/web" apps/mobile -g '!node_modules' -g '!package-lock.json'` — пусто
- После сборки поднять сервер и `curl -sI` или `curl -s` на `/`, `/login`, `/l/test`, `/api/v1/me`: первые два — HTML приложения, последние два — не тело SPA

**Manual checks (if no CLI):**
- iOS Simulator не требуется
