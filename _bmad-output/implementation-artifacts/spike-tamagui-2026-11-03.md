# Спайк: Tamagui как общий UI для Expo и Next

Дата: 2026-11-03. Ветка: `claude/shadcn-native-apps-alternative-6be47d`, код спайка не для мержа.

## Вопрос

Можно ли держать один набор компонентов в `packages/ui` на Tamagui и использовать его в приложении Expo (Android, iOS, браузер) и на серверных страницах Next (`/l`, `/i`, `/unsubscribe`, `/admin`), не нарушая стек: Expo SDK 58 / RN 0.88 / React 19.3.0, Next 16.4.3 (Turbopack) / React 19.2.8.

## Что сделано

- `packages/ui`: тема Tamagui из токенов Forest Paper, `Button` (варианты `primary`, `outline`, `ghost`), `WishCard`, `StatusPill`. Исходники TS без сборки, как `packages/contracts`. Шрифты передаются при создании темы: имена expo-font в приложении, CSS-переменные `next/font` в Next.
- Expo: экран `app/spike.tsx` с карточками, кнопками, `Dialog`, `Sheet`, `Switch` из Tamagui.
- Next: страница `/l/[token]` с теми же `WishCard` и `Button`, SSR через `useServerInsertedHTML`, мета-теги OG через `generateMetadata`.
- Tamagui 3.1.10 (latest на дату спайка), без компилятора и без `@tamagui/next-plugin`.

## Результаты

| Критерий | Итог | Подробности |
|---|---|---|
| Установка в монорепозиторий | С обходом | `npm install tamagui -w @gift-list/ui` падает с ERESOLVE: optional peer `react-native-safe-area-context` тянет `react-native@0.88`, ему нужен React ^19.3, а в корне 19.2.8. Ставится в `apps/mobile` и `apps/web`, npm сводит в одну копию в корне. Lock: +~4700 строк, ~230 пакетов |
| Metro и одна копия React | Да, после правки | Текущий `disableHierarchicalLookup: true` ломает сборку: Tamagui держит часть зависимостей во вложенных `node_modules`. Замена — `resolveRequest`, который резолвит `react`, `react-dom`, `react-native`, `scheduler` от `apps/mobile`, остальное — обычным поиском. В Android-бандле только строки `19.3.0`, следов 19.2.8 нет |
| Android-бандл | Собирается | `expo export --platform android` — 5,6 МБ Hermes bytecode. **Запуск на устройстве не проверен**: нет эмулятора и устройства |
| iOS | Не проверено | Нет macOS |
| Expo в браузере | Работает | Токены, шрифты, hover и focus-visible работают. `Dialog`: открывается по Enter, фокус внутри, закрывается по Esc. `Switch` — `<button role="switch" aria-checked>`. `Sheet` открывается |
| Next 16 + Turbopack, сборка | Да | `npm run build` проходит без плагина Tamagui, standalone-сервер отдаёт страницу |
| SSR `/l/:token` | Да | В HTML уже карточки и весь CSS: переменные токенов и атомарные классы в `<head>`. OG-теги на месте, ошибок гидратации в консоли нет |
| Проверки CI | Да | `npm run typecheck` и `npm run lint` (включая `check-boundaries`) проходят. `npm test`: 1 падение по таймауту 5 с в `apps/web/src/lib/auth.test.ts` при холодном импорте better-auth; отдельный прогон файла — 9/9. Со спайком не связано, на чистом `main` не перепроверялось |
| JS на `/l` | 224 КБ gzip | Всего, вместе с React и рантаймом Next (8 файлов, 704 КБ без сжатия). Первый показ от JS не зависит: стили в HTML |
| JS в веб-сборке Expo | +330 КБ gzip | Маршрут спайка — 1,3 МБ (330 КБ gzip): Metro тянет весь barrel `tamagui`. Не проверены импорты по подпутям (`tamagui/dialog`), tree shaking Expo и компилятор |

## Что выяснилось по ходу

- **Tamagui v3 сильно отличается от v1/v2.** Состояния пишутся строками (`"$border hover:$borderStrong"`), токен `true` запрещён, `Sheet` требует драйвер анимаций (на вебе — `@tamagui/animations-css/extras`). Большинство статей, примеров и знаний агентов — про старые версии, на это уходит время.
- **Компоненты Tamagui ждут ключи своей темы** (`background-hover`, `color` и т. д.). С минимальной темой `Switch` вышел 8×8 px, у `Sheet` нет фона. Нужна полная тема по DESIGN.md — отдельная работа.
- **Своя кнопка на `View` рендерится как `div role="button"`.** У Tamagui `Button` в вебе — настоящий `<button>`. Для общих компонентов лучше брать поведение Tamagui (`useButton`, `ButtonFrame`) и менять только оформление.
- **У Tamagui v3 есть shadcn-реестр**: исходник `Button` генерирует компонент реестра, компоненты можно копировать к себе, как в shadcn.

## Вывод

Технически подход работает: один код компонентов рендерится в Expo (в браузере проверено, Android собирается) и в Next на сервере со стилями в HTML. Блокеров не найдено.

Риски, которые надо принять или снять:

1. Запуск на Android и iOS не проверен — нужен прогон на устройстве (dev build или Expo Go с SDK 58).
2. Веб-сборка Expo тяжелеет на ~330 КБ gzip, пока не настроены импорты по подпутям или компилятор.
3. Меняется правило Metro (`disableHierarchicalLookup` → `resolveRequest`) и запрет общего UI-пакета (AD-17).
4. Порог входа: API v3 новый, тему под DESIGN.md надо собрать целиком.

## Второй заход (тот же день)

### Одна версия React

- В `apps/web` поднял `react`, `react-dom` до 19.3.0 и `@types/react` до ~19.3.0, как в Expo. Next 16.4.3 принимает `react ^19`.
- В монорепозитории осталась одна копия React (19.3.0, в корне). Tamagui ставится только в `packages/ui` (`tamagui`, `@tamagui/animations-css`, `@tamagui/animations-react-native`), ERESOLVE больше нет.
- Metro работает с обычным конфигом: `watchFolders` + `nodeModulesPaths`, без `disableHierarchicalLookup` и без `resolveRequest`. Android-бандл собирается, в нём только React 19.3.0.
- Прогон CI: `typecheck`, `lint`, `test` (mobile 53, web 145, contracts 54), `build` и standalone-сервер проходят. `/l/abc123` — 200 с SSR-стилями и OG, `/` — 200 (SPA).
- Это меняет правило AD-17 «версии не выравнивать через общий UI»: React в вебе и Expo придётся обновлять вместе, по версии Expo SDK.

### Вес веб-сборки Expo

Все JS веб-экспорта, gzip -9. База — без экрана спайка и без Tamagui.

| Вариант | Весь JS, gzip | Прирост к базе |
|---|---|---|
| База без Tamagui | 428 КБ | — |
| Импорт из `tamagui` целиком | 757 КБ | +329 КБ |
| То же + Expo tree shaking (`EXPO_UNSTABLE_TREE_SHAKING`) | 664 КБ | +236 КБ |
| Импорт по подпутям (`@tamagui/core`, `@tamagui/stacks`, `tamagui/dialog`, …) | 570 КБ | +142 КБ |
| Подпути + tree shaking | 563 КБ | +135 КБ |
| Подпути + компилятор Tamagui (`@tamagui/cli/metro`) | 571 КБ | +143 КБ |
| Только ядро: тема, `styled`, стеки, провайдер, без Dialog/Sheet/Switch | 522 КБ | +94 КБ |

Выводы:

- Главный рычаг — импорты по подпутям, правило для `packages/ui` и экранов: никогда не импортировать из `"tamagui"` целиком. Его можно закрепить линтером.
- Обычный режим компилятора на размер не влияет: он ускоряет рендер, а не уменьшает JS. Режим zero-runtime экспериментальный и запрещает `TamaguiProvider` в корне — для приложения с диалогами и шторками не подходит.
- Цена Tamagui в приложении — около 95 КБ gzip за ядро и десятки КБ за каждый сложный компонент. Для сравнения: вся текущая веб-сборка — 428 КБ.

### Документация v3

- `https://tamagui.dev/llms.txt` — полная документация v3 одним текстом для агентов (~1,3 МБ), с разделами про токены, темы, SSR, драйверы анимаций.
- В `node_modules/tamagui/src/components/*.manifest.ts` у каждого компонента перечислены нужные ключи темы и требования на native. Например, `Sheet` ждёт `background`, `color-5`, `shadow-color` — поэтому в первом заходе у шторки не было фона.
- Исходники и типы с JSDoc лежат в `node_modules`. Устаревшие знания агентов — неудобство, а не блокер: правило в AGENTS.md «по Tamagui сверяться с llms.txt и манифестами» его закрывает.

### Эмулятор Android

- Ускорение WHPX включено и работает (`emulator -accel-check`), Android Studio установлен, JDK 17 есть.
- Поставлены `cmdline-tools/latest` (16111833, SHA-1 сверен) и образ `system-images/android-36.1/google_apis/x86_64` (1,8 ГБ архив, 4,3 ГБ на диске). AVD `giftlist_spike` (Pixel 7) в `E:\DevData\Android\Sdk`.
- Запуск: `E:\DevData\Android\Sdk\emulator\emulator.exe -avd giftlist_spike`, затем `npx expo start` в `apps/mobile` и `exp://10.0.2.2:<порт>/--/spike` в Expo Go.

## Третий заход: запуск на Android (Expo Go, SDK 58)

| Проверка | Итог |
|---|---|
| Экран `/spike` | Отрисовался: карточки, pill, кнопки в токенах Forest Paper, Manrope и Lora на кириллице |
| `Dialog` | Открывается, закрывается кнопкой «Отмена» |
| Системная кнопка «Назад» при открытом `Dialog` | **Диалог не закрывается, приложение уходит в фон.** DESIGN.md требует, чтобы «назад» закрывал слой — нужна своя обработка `BackHandler` в обёртке `packages/ui` |
| `Sheet` | Открывается и закрывается, но без фона и затемнения — та же нехватка ключей темы, что в вебе |
| `Switch` | Не виден: размеры и цвета Tamagui не сходятся с минимальной темой |

### Дубли пакетов Tamagui — главная находка

- Первый запуск упал: `'PortalDispatchContext' cannot be null, please add 'PortalProvider'`. Причина — npm держит **шесть одинаковых копий `@tamagui/portal@3.1.10`** и около десяти копий `@tamagui/native` во вложенных `node_modules`, ни одной в корне. `TamaguiProvider` и `Dialog` получили разные копии, значит, разные React-контексты.
- Почему npm не поднимает их в корень: у этих пакетов peer `react-native`, а `react-native` лежит в `apps/mobile/node_modules`. `npm dedupe` падает с ERESOLVE.
- Обход в спайке — `resolveRequest` в Metro: для каждого `@tamagui/*` берётся самая неглубокая копия, все импорты идут в неё. С ним экран работает, веб-сборка тоже (и даже легче: 560 КБ против 570 КБ gzip).
- В Next проблема не проверялась: на `/l` нет диалогов и порталов. Для `/admin` с `Sheet` и `Dialog` придётся проверять отдельно; у Turbopack такого резолвера нет.
- Правильное решение — чистое дерево зависимостей: `react-native` и `@tamagui/*` в корне `node_modules`. Это либо пересборка lock-файла с нуля после выравнивания React, либо `overrides` в корневом `package.json`. В спайке не делалось: lock пришлось бы перегенерировать целиком.

## Четвёртый заход: lock-файл с нуля

- Удалены все `node_modules` и `package-lock.json`, затем `npm install`.
- Первая попытка упала с ERESOLVE: npm выбрал `react-dom@19.3.1` для peer `@tamagui/animations-css`, а ему нужен React 19.3.1. Решение — `overrides` в корневом `package.json`: `react` и `react-dom` = `19.3.0`.
- После установки: одна копия React 19.3.0, `react-native` и `@tamagui/portal` в корне. `@tamagui/native` всё равно лёг шестью вложенными копиями: у него 12 optional peer (`one`, `zeego`, `burnt` и др.), и npm не поднимает его даже как прямую зависимость `packages/ui`.
- Помогло только объявить `@tamagui/native` зависимостью корневого `package.json`. После этого вложенных `@tamagui/*` нет ни одного.
- Metro — обычный конфиг, от `main` отличается только удалённым `disableHierarchicalLookup`. Резолвер-дедупликатор не нужен.
- Эмулятор: `/spike`, `Dialog` и `Sheet` работают без ошибок. Системная «Назад» по-прежнему не закрывает `Dialog`.
- Цена пересборки: 80 пакетов сменили версию, из них 13 прямых зависимостей — патчи и минорные в пределах диапазонов (`expo-router` 58.0.29 → 58.0.30, `@base-ui/react` 1.8.0 → 1.9.0, `lucide-react` 1.49 → 1.67, `typescript-eslint` 8.71 → 8.72.1 и др.). Prisma осталась 7.10.0.

- Побочный эффект пересборки: `@better-auth/core` разъехался на две версии. `better-auth@1.7.14` держит свой `1.7.14`, а `@better-auth/expo` и адаптеры (peer `^1.7.14`) получили `1.7.16`. Из-за этого `typecheck` и `next build` падали на `apps/web/src/lib/auth.test.ts` (TS2345, несовместимые `AuthContext`). Исправлено явной зависимостью `@better-auth/core: 1.7.14` в `apps/web/package.json` — по одной копии, как и было на `main`. Это нужно и без Tamagui при любой пересборке lock-файла.
- Итог проверок после пересборки: `typecheck`, `lint`, `test` (mobile 53, web 145, contracts 54) и `build` проходят. Standalone-сервер: `/l/abc123` 200 с OG и CSS Tamagui, `/` 200, `/api/v1/session` — штатный конверт 404.

Правила, которые придётся закрепить, если берём Tamagui:

1. React в вебе и Expo одной версии, плюс `overrides` в корне.
2. Все пакеты `@tamagui/*` одной версии, `@tamagui/native` — в корневом `package.json`.
3. После каждого обновления зависимостей — проверка, что вложенных `@tamagui/*` нет (скрипт в `scripts/check-boundaries.mjs` или отдельный в CI).
4. Импорты только по подпутям, не из `"tamagui"` целиком.

## Не проверено

iOS, реальное Android-устройство (проверен только эмулятор), чистое дерево зависимостей без резолвера в Metro, `Dialog` и `Sheet` в Next, таблицы для `/admin`, доступность с TalkBack и VoiceOver, полная тема Forest Paper.
