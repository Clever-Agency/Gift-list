---
title: 'Story 1.9: Общий UI-пакет packages/ui на Tamagui'
type: 'refactor'
created: '2026-11-04'
status: 'done'
baseline_commit: 'dc105673eb1eaad56dbf8cd21af2c875c2bc831e'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spike-tamagui-2026-11-03.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md'
  - '{project-root}/.cursor/rules/ux-design.mdc'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** UI приложения Expo написан на `StyleSheet` с токенами в `apps/mobile/src/theme/tokens.ts`. В `apps/web` остались мёртвые shadcn и Tailwind. Поэтому Next-страницы (`/l`, `/i`, `/unsubscribe`, `/admin`) пришлось бы верстать второй раз, а Stories 3.3 и 2.4–2.7 стоят (D-47, AD-2, AD-28).

**Approach:** Собрать `packages/ui` на Tamagui 3.1.10: полная тема из frontmatter DESIGN.md и компоненты Button, TextField, WishCard, StatusPill, BottomSheet, Dialog плюс нужные примитивы. Перевести на пакет все экраны и `src/ui/*` в `apps/mobile`, не меняя поведения. Удалить shadcn и Tailwind из `apps/web`, подключить SSR Tamagui. Выровнять React и `@tamagui/*` по AD-28 и закрепить это проверкой в CI. Критерии приёмки — Story 1.9 в `epics.md` (строки 388–411).

**Решения человека (2026-11-04):**
- SSR и `Dialog` на Next проверяются на служебной странице `apps/web/src/app/(dev)/ui-check/page.tsx`. В production она отдаёт `notFound()`. Её HTML первого ответа содержит CSS Tamagui. `/l` остаётся за Story 3.3.
- На Android-эмуляторе проверяет человек по чек-листу из этой спеки. Браузер проверяет агент. iOS записывается в `deferred-work.md`.

## Boundaries & Constraints

**Always:**
- Импорт Tamagui только по подпутям (`@tamagui/core`, `@tamagui/stacks`, `tamagui/dialog` …), никогда из `"tamagui"`. По API v3 сверяться с `https://tamagui.dev/llms.txt` и `node_modules/tamagui/src/components/*.manifest.ts`.
- Пакет отдаёт исходники TS без сборки (`exports` → `src`), как `packages/contracts`. В пакете нет API, env, Prisma и строк интерфейса: тексты приходят пропсами. Шрифты пакет не грузит, их передают expo-font и `next/font`.
- Тема — единственный источник токенов. В ней все значения frontmatter DESIGN.md и все ключи, которых ждут манифесты используемых компонентов. Токен `true` не используется.
- React и react-dom 19.3.0 в обоих приложениях, `overrides` в корне. Все `tamagui` и `@tamagui/*` одной точной версии 3.1.10, `@tamagui/native` в корневом `package.json`. Metro без `resolveRequest` и `disableHierarchicalLookup`.
- Поведение экранов не меняется: тексты, валидация, навигация, тост, ConfirmDialog, защита несохранённых изменений и браузерная «Назад» (CLE-65). Тесты экранов проходят, переписываются только моки и обёртка Provider.
- Именованные функции и `displayName` (AGENTS.md → «Code style») — и в `packages/ui`.
- BottomSheet и Dialog закрываются кнопкой «Закрыть»/«Отмена», Esc в браузере и системной «Назад» на Android (`BackHandler`). Фокус возвращается на элемент, открывший слой.

**Never:**
- Не мержить код спайка как есть. Он только образец.
- Не добавлять компилятор Tamagui, `@tamagui/next-plugin`, Tailwind, shadcn, `@base-ui/react`, cva.
- Не трогать KEEP_FNAMES в `metro.config.js`, `GiftStatusService`/`VisibilityPolicy` и серверную логику.
- Не менять PRD, эпики, архитектуру и ключи `sprint-status.yaml`.
- Не делать `/l/[token]`: это Story 3.3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Dialog в браузере | открыт, нажат Esc | закрыт, фокус на открывшей кнопке | — |
| Dialog/Sheet на Android | открыт, системная «Назад» | закрывается слой, а не экран и не приложение | слоя нет — «Назад» работает как раньше |
| Button в вебе | `variant` любой | DOM `<button>` с ролью и подписью | `disabled` — не нажимается |
| TextField с ошибкой | `error` задан | текст ошибки связан с полем для диктора | — |
| Дубль пакета | вторая копия `@tamagui/*`/react в lock | `npm run lint` падает с понятным сообщением | — |
| Импорт `"tamagui"` | `import … from "tamagui"` в коде | проверка падает | — |
| `/ui-check` в production | `NODE_ENV=production` | 404 | — |

</frozen-after-approval>

## Code Map

- Образец спайка (только чтение, незакоммичен): `E:/Projects/CleverAgency/Gift-list/.claude/worktrees/shadcn-native-apps-alternative-6be47d`. Файлы: `packages/ui/src/{config,tokens,button,wish-card,animations(.native)}.ts(x)`, `apps/web/src/app/l/` (Provider и `useServerInsertedHTML`), `apps/mobile/app/spike.tsx`, diff `package.json`/`metro.config.js`/`next.config.ts`.
- Корневой `package.json`: `overrides` сейчас только `deepmerge-ts` и `mysql2`. Скрипт `lint` перечисляет workspaces явно (добавить `@gift-list/ui`).
- `package-lock.json`: по спайку lock надо пересобрать с нуля (удалить `node_modules` и lock, `npm install`). Побочный эффект: `@better-auth/core` расходится на 1.7.14 и 1.7.16. Нужен явный `@better-auth/core: 1.7.14` в `apps/web/package.json`. Prisma остаётся 7.10.0.
- `apps/web/package.json`: react 19.2.8 → 19.3.0. Удалить `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`, `tailwindcss`, `@tailwindcss/postcss`, `shadcn`.
- `apps/mobile/metro.config.js:14-15`: убрать `disableHierarchicalLookup` и комментарий про React 19.2.8.
- `apps/web/next.config.ts:14`: `transpilePackages` += `@gift-list/ui`.
- `apps/mobile/src/theme/tokens.ts`: удалить. Взять из него значения и `textStyle()` (вес кодируется именем face `Manrope-500`, нельзя ставить `fontWeight` вместе с face на Android, строки 129–152). Импортёров 27: экраны `app/**`, `src/ui/*`, `card-grid.ts`, тесты.
- `apps/mobile/src/ui/*.tsx` (14 файлов), `focus.ts` (`restoreFocus`), `nav-link.ts`, `card-grid.ts`, `gift-price.ts`. Экраны: `app/_layout.tsx` (шрифты expo-font, providers), `(app)/{index,settings,gifts/new,gifts/[id]/edit}.tsx`, `(auth)/{login,register,forgot,reset}.tsx`, `invite/[token].tsx`, `wishlist/[token].tsx`.
- `apps/mobile/src/session/use-browser-back-guard.ts`, `use-discard-guard.ts`: логика CLE-65, не ломать.
- Тесты mobile: `vitest.config.ts` (env node, `src/**/*.test.{ts,tsx}`). 24 файла мокают `react-native` вручную (`StyleSheet.create` identity, `Pressable`→button, `Modal`). Для Tamagui нужен общий тестовый setup (например, alias `react-native` → `react-native-web` и render с Provider) вместо ручных моков.
- `apps/mobile/src/ui/component-names.test.tsx`: глобит `src/ui` и `app/`. Для `packages/ui` нужна такая же проверка.
- `apps/web`: удалить `src/components/ui/{button,input,label}.tsx` (никто не импортирует), `src/lib/utils.ts`, `components.json`, `postcss.config.mjs`. Переписать `src/app/globals.css` (сейчас Tailwind). `src/app/layout.tsx`: `next/font` Lora/Manrope уже есть (`--font-heading`, `--font-sans`). Страниц `page.tsx` нет. SPA отдаётся rewrites, Next-префиксы — в `src/lib/spa-paths.ts`.
- `scripts/check-boundaries.mjs`: проверки границ mobile и contracts. Сюда добавить дубли (по `package-lock.json`: путь `node_modules/.../node_modules/<pkg>`) и запрет `"tamagui"`.
- Документы: `AGENTS.md` (уже упоминает `packages/ui`, проверить AD-28 и llms.txt), `.cursor/rules/ux-design.mdc` (строки 11 и 28 — shadcn).

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, `apps/*/package.json`, `packages/ui/package.json`, `package-lock.json`, `apps/mobile/metro.config.js`, `apps/web/next.config.ts` -- версии, overrides, `@tamagui/native` в корне, пересборка lock, чистка web-зависимостей -- AD-28, одна копия React/Tamagui
- [x] `packages/ui/**` -- тема из DESIGN.md, config, Provider (шрифты параметром), Button, TextField (и пароль), WishCard, StatusPill, BottomSheet, Dialog, примитивы текста и раскладки, Skeleton; tsconfig, eslint, vitest, тесты поведения и `displayName` -- AD-2
- [x] `scripts/check-boundaries.mjs`, `.github/workflows/ci.yml` (если нужно) -- проверка дублей и импорта `"tamagui"`; `packages/ui` без API, env, prisma -- AD-28
- [x] `apps/mobile/src/ui/**`, тестовый setup mobile, моки в `src/session/*.test.tsx` -- перевод компонентов на `@gift-list/ui` -- поведение то же
- [x] `apps/mobile/app/**`, удалить `src/theme/tokens.ts` -- экраны на `@gift-list/ui`, Provider и шрифты в `_layout.tsx` -- AC «токенов в коде больше нигде нет»
- [x] `apps/web/src/**`, `apps/web/components.json`, `apps/web/postcss.config.mjs` -- удалить shadcn и Tailwind; Provider и SSR-CSS в `layout.tsx`; `(dev)/ui-check/page.tsx` с Dialog; SSR-тест -- AC Next
- [x] `AGENTS.md`, `.cursor/rules/ux-design.mdc`, `deferred-work.md`, `sprint-status.yaml` -- документация, iOS в deferred, статус истории

**Acceptance Criteria:** все AC Story 1.9 в `epics.md:388-411`, плюс:
- Given собранный web-экспорт, when сравнить gzip всех JS с базой (скрипт замера в scratchpad сессии), then прирост ≤ 150 КБ, число — в описании PR.
- Given `npm ls react react-dom tamagui @tamagui/core @tamagui/native`, then по одной копии.
- Given `/ui-check` в dev, when открыть, then карточки и кнопки видны в HTML первого ответа со стилями, а Dialog открывается и закрывается (кнопка, Esc).

## Implementation Notes

**Задача 1 (зависимости и lock) — сделана.** Корень: `overrides` react/react-dom 19.3.0, зависимость `@tamagui/native` 3.1.10, `lint` включает `@gift-list/ui`. `apps/web`: react/react-dom 19.3.0, `@types/react` ~19.3.0, явный `@better-auth/core` 1.7.14, `@gift-list/ui`; удалены `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`, `tailwindcss`, `@tailwindcss/postcss`, `shadcn`. `apps/mobile`: `@gift-list/ui`. Metro: убран `disableHierarchicalLookup`. `next.config.ts`: `transpilePackages` += `@gift-list/ui`. Каркас `packages/ui`: `package.json` (tamagui 3.1.10, animations-css/-react-native, core, native, stacks), `tsconfig.json`, `eslint.config.mjs`, `src/index.ts` (`export {}`); скрипта `test` пока нет. Lock пересобран с нуля (`npm install --ignore-scripts`, node_modules и lock удалены): по одной копии react, react-dom, tamagui, `@tamagui/*` (все 3.1.10), вложенных `@tamagui/*` нет, `@better-auth/core` 1.7.14, prisma 7.10.0. Проверено: typecheck ui/mobile/web, lint ui, тесты mobile (439), web (368), contracts (130). Оставлено следующим задачам: `postcss.config.mjs`, `components.json` и Tailwind в `globals.css` ещё на месте, так что `next build` до задачи про web не пройдёт; `src/components/ui/*` и `lib/utils.ts` не тронуты.

**Задача 2 (`packages/ui`) — сделана.** Проверено: `tsc --noEmit`, `eslint .`, `vitest run` (8 файлов, 39 тестов: Button, TextField/PasswordField, Dialog, BottomSheet, WishCard/чип/пилюля, SSR без DOM, токены против DESIGN.md, имена компонентов). `.native.ts` проверены только типами; запуск на Android и визуальная сверка в браузере не делались. Новые зависимости ui: `@tamagui/button`, `@tamagui/input` (3.1.10), dev: `vitest`, `happy-dom`, `@types/node`, `@types/react`; вложенных копий `@tamagui/*`, react, react-dom в lock нет.

*Публичный API `@gift-list/ui`* (всё из корня, строки интерфейса только пропсами, ни `contracts`, ни `react-native` в web-код не тянутся):
- Токены (единственный источник, из них собрана тема): `colors`, `typography`, `rounded`, `spacing`, `breakpoints`, `SCRIM_OPACITY`; типы `ColorToken`, `SpacingToken`, `TypographyRole`. `textStyle()` и `apps/mobile/src/theme/tokens.ts` заменяются тегом `<Text kind="…">` и этими объектами (числа для `card-grid.ts`: `spacing["card-min"]` и т. д.).
- Конфиг и провайдер: `createGiftListConfig({ body, heading, bodyFaces? })`, `GiftListProvider({ config, children })`, тип `GiftListConfig`. Тема одна, `light`; токены `size`/`space` — имена DESIGN (`$touch-target`, `$card-padding`) плюс шкала `$1…$6` (4, 8, 12, 16, 24, 32); `radius` — `$sm|md|lg|xl|full`; медиа `$medium|$expanded|$wide`; роли шрифта как токены размера (`$caption`, `$button` …).
- Раскладка и текст: `View`, `XStack`, `YStack`, `ZStack`, `Screen` (фон, `flex: 1`), `Column` (`size` form|content|wide, по центру), `Text` (`kind` — роль типографики, `tone` — default|muted|primary|destructive|reserved|inverse; остальные стилевые пропсы Tamagui работают, `color="$…"` тоже), `Heading` (`level` → `role="heading"` + `aria-level`), `LinkText` (текст ссылки навигации, 44 px; вместо `navLinkStyle`), `Pressable` (div с любой `role`, Enter/Space, `disabled` оставляет в Tab-порядке, нажатие `opacity 0.9`), `focusRing`, `pressOnKeyDown`.
- Контролы: `Button` (`label`, `onPress`, `variant` primary|reserve|secondary|ghost|destructive, `disabled`, `focusableWhenDisabled`, `busy`, `fullWidth`, `testID`, `type`, ref; на вебе `<button>`; заменяет `PrimaryButton` и `GhostButton`, у ghost-«Отмены» ставьте `focusableWhenDisabled`), `TextField` (`label`, `value`, `onChangeText`, `error`, `hint`, `multiline`, `rows`, `input` — остальные пропсы поля, ref на поле; подпись `htmlFor`, ошибка через `aria-describedby`/`aria-invalid`/`role="alert"`), `PasswordField` (+ `showLabel`), `Choice` и `ChoiceList` (radio-строки `variant="row"` и чипы `variant="chip"`; `ChoiceGroup` в `gift-form.tsx` собирается из них и сохраняет `autoFocusValue` через ref `Choice`).
- Представления: `StatusPill` (`status` open|reserved|closed, `label`), `VisibilityChip` (`tone` public|friends|secret, `label`, `icon` — узел приложения, `onPress`, `accessibilityLabel`, ref; без `onPress` не кнопка; цвет иконки — `visibilityChipColors`), `WishCard` (`title`, `closed`, `price`, `status` — узел, `reservation`, `chip` — узел, `chipInteractive`, `onPress`, `pressLabel`, `width`, `testID`; `role="listitem"`, чип соседний слой, не внутри кнопки карточки), `Skeleton`, `WishCardSkeleton`, `EmptyState`, `Toast` (только вид: `message`, `tone`, `closeLabel`, `onClose`, `action`, `offsetBottom`, `onHoverChange`, `onFocusChange`; таймер, диктор и пауза остаются в `ToastHost` приложения).
- Слои: `Dialog` (`open`, `title`, `description`, `onClose`, `onClosed`, `initialFocus` — ref, `role` dialog|alertdialog, `closeAction` {label, icon}, `children`, `actions`, `testID`) и `BottomSheet` (то же без `description` и `role`). Закрытие: кнопка, Esc и подложка в браузере, `BackHandler` на Android (слушатель живёт, пока слой открыт, возвращает `true`). Фокус на открытии — на `initialFocus` или заголовок; `onClosed` — слой ушёл из дерева, экран сам вызывает `restoreFocus(node)` (в вебе вызов отложен на следующий такт, чтобы не попасть внутрь снимаемого слоя; без `onClosed` браузер сам возвращает фокус на прежний элемент). `focusInLayer`, `restoreFocus`, тип `FocusTarget` заменяют `apps/mobile/src/ui/focus.ts`; `useLayerClosed` больше не нужен.
- Заметки для следующих задач: у `Button` радиус `md` и высота 48 по DESIGN.md (в старом `PrimaryButton` был `sm`); `Heading`/`Text` на телефоне получают `role` через RN; моки `react-native` в тестах mobile не нужны для Tamagui, а вот `expo-symbols` для иконок (крестик, чип) остаётся в приложении. `Select`, `Switch`, `Tabs` и т. п. в пакет не добавлялись: их нет в экранах истории.

*Подключение Provider.* Expo (`apps/mobile/app/_layout.tsx`): модульная константа `const config = createGiftListConfig({ body: "Manrope", heading: "Lora", bodyFaces: { 400: "Manrope", 500: "Manrope-500", 600: "Manrope-600" } })`, шрифты грузит `useFonts` как сейчас, корневой элемент — `<GiftListProvider config={config}>…</GiftListProvider>` вокруг `SafeAreaProvider` и навигатора (портал для `Dialog`/`BottomSheet` создаёт провайдер, отдельный `PortalProvider` не нужен). Next (`apps/web/src/app/layout.tsx`): клиентский компонент `tamagui-registry.tsx` с `"use client"`, `const config = createGiftListConfig({ body: "var(--font-sans)", heading: "var(--font-heading)" })`, `useServerInsertedHTML(() => <style id="tamagui-ssr" dangerouslySetInnerHTML={{ __html: config.getNewCSS() }} />)` из `next/navigation` и `<GiftListProvider config={config}>`; `layout.tsx` оборачивает им `children`. Тест `ssr.test.tsx` проверяет, что `renderToString` отдаёт `<style>` с CSS-переменными токенов и шрифтов; `config.getNewCSS()` отдаёт атомарные классы, накопленные при рендере.

**Задача 3 (проверка границ) — сделана.** Правился только `scripts/check-boundaries.mjs`; `ci.yml` не менялся: `npm run lint` уже вызывает скрипт, а CI гоняет `lint`. Новые проверки: (1) запрет импорта, `require`, `export from` и `vi.mock` голого `"tamagui"` в `apps/mobile`, `apps/web/src`, `packages/ui/src` (подпути `tamagui/dialog` и `@tamagui/*` разрешены; строчные и блочные комментарии отбрасываются, иначе проза в `packages/ui/src/index.ts` даёт ложное срабатывание); (2) дубли в `package-lock.json`: любой ключ `…/node_modules/<pkg>` для `react`, `react-dom`, `tamagui`, `@tamagui/*` сверх одного (в том числе `apps/*/node_modules/…`) и разные версии у `tamagui`/`@tamagui/*`; (3) `packages/ui/src` не читает `process.env` и не импортирует Prisma, `@gift-list/web`, `@gift-list/contracts`. Путь к lock можно подменить переменной `GIFT_LIST_LOCKFILE` (для проверки на испорченной копии). Проверено: на текущем дереве код выхода 0; временный `apps/web/src/tmp-bad-tamagui.ts` с `import … from "tamagui"` даёт `…: imports from "tamagui"; use subpaths …`, код 1; копия lock в scratchpad с вложенным `@tamagui/stacks/node_modules/@tamagui/core@3.1.9` и `apps/web/node_modules/react@19.2.8` даёт сообщения `duplicate copies of … (AD-28)` и `must share one version`, код 1; временный файл в `packages/ui/src` с `process.env` и `@prisma/client` ловится. Временные файлы удалены, настоящий `package-lock.json` не тронут.

**Задача 4 (`apps/mobile/src/ui`, тестовый setup) — сделана.** Проверено: `npm run test -w @gift-list/mobile` (32 файла, 427 тестов), `typecheck` и `lint` mobile, `npm run test -w @gift-list/ui` (39), `node scripts/check-boundaries.mjs`. В `packages/ui` ничего не добавлялось. На Android и в браузере вручную не запускалось.

*Что стало в `src/ui`.* Публичные имена компонентов и их пропсы сохранены, поэтому экраны `app/**` не менялись и собираются как раньше; внутри везде `@gift-list/ui`:
- `PrimaryButton` — тонкая обёртка над `Button` (`disabled` экрана → `busy`, как было: отключённая кнопка объявлена занятой). `GhostButton` удалён (файл и тест): в `GiftForm` «Отмена» — `Button variant="ghost" focusableWhenDisabled`, ссылка для `focusCancel` — `ref` кнопки.
- `TextField`/`PasswordField` — обёртки над пакетными; `inputRef` оставлен как имя пропса, RN-пропс `editable={false}` переводится в `readOnly`. `inputStyle` убран: многострочное описание — `multiline rows={4}`.
- `StatusPill` (статус API → `open|reserved|closed` + подпись из каталога), `WishCardSkeleton` (с `testID="wish-card-skeleton"`), `EmptyState`, `AuthorLink` (`Pressable role="link"`), `AnonymousScreen` (`Screen`/`Column`/`Heading`; `ScrollView` и `SafeAreaView` остались от RN), `ToastHost` (таймер, диктор и пауза остались в приложении, вид — `Toast`), `VisibilityChip` (иконка `expo-symbols` узлом, цвет из `visibilityChipColors`), `WishCard` (собирает пилюлю, чип и тексты и отдаёт в пакетный `WishCard`).
- `ConfirmDialog` — режимы `confirm` и `discard` и все пропсы прежние; внутри `Dialog`: `confirm` — `role="alertdialog"`, `initialFocus` на «Отмена»; `discard` — `role="dialog"`, фокус на заголовке, крестик через `closeAction`. Защита от двойного нажатия (`answered`) осталась.
- `VisibilityPicker` — `Dialog` с `ChoiceGroup`; фокус при открытии на выбранной радио-строке через `initialFocus`. `ChoiceGroup` в `gift-form.tsx` собран из `ChoiceList`/`Choice`; вместо `autoFocusValue` с эффектом теперь пара `autoFocusValue` + `autoFocusRef` (ref получает узел нужной строки, фокус ставит `Dialog`).
- `focus.ts` — только реэкспорт `restoreFocus`, `focusInLayer` и типа `FocusTarget` (он же `ChipNode`) из пакета; `useLayerClosed` удалён. `card-grid.ts` берёт `spacing` из `@gift-list/ui`.
- Для следующего захода: `nav-link.ts` (`navLinkStyle`) пока читает `@/theme/tokens`, потому что экраны ещё используют его в `Text style`; он и сам `tokens.ts` уходят вместе с экранами (на `LinkText`). Комментарий про `useLayerClosed` в `app/(app)/index.tsx:282` устарел, поправить при переводе экрана.

*Тестовый setup mobile.* `apps/mobile/vitest.config.ts`: алиас `react-native` → `react-native-web` и `setupFiles: ["./src/test/setup.tsx"]`. `setup.tsx` подменяет `react-dom/client`: `createRoot(...).render(node)` оборачивает узел в настоящий `GiftListProvider` (конфиг создаётся один раз на файл тестов), так что 24 теста, которые рендерят через `createRoot`, не правились ради провайдера. Помощники в `src/test/dom.ts`: `controls`/`controlByText`/`controlByLabel` (кнопка — это `button`, `[role="button"]` или `[role="radio"]`), `dialogElement` (`[role="dialog"], [role="alertdialog"]`; слой выносится порталом в `document.body`, а не в контейнер теста), `click`, `typeInto` (input и textarea), `escape` (Esc приходит `keydown` на `document`), `pressScrim(testID)` (закрытие по подложке слушает `pointerdown`, затем идёт `click`), `settle`. Слой появляется и уходит после эффекта и таймера, поэтому после открытия и закрытия слоя тесты ждут `settle`.
- `src/session/*.test.tsx`: ручные моки `Modal`, `TextInput` и (где не нужны) `Pressable` убраны, поиск кнопок и диалога идёт через `dom.ts`, `text()` читает `document.body`. `password-rule`: подсказка и ошибка поля ищутся по `[id$="-description"]` (ошибка — `role="alert"`), ввод — через настоящий `input`. В `my-wishlist-screen` проверка `pointerEvents` вместо RN-мока смотрит `getComputedStyle(...).pointerEvents` (`box-none` Tamagui даёт `none` на самом слое).
- `src/ui/*.test.tsx`: `ghost-button.test` удалён вместе с компонентом; `status-pill`, `gift-card`, `visibility-chip`, `visibility-picker`, `confirm-dialog` переписаны на настоящий DOM Tamagui и проверяют поведение (имена, роли, нажатия, фокус, порядок Tab, возврат фокуса), а не стили из токенов — токены и вид покрывают тесты `packages/ui`. `gift-form.test`, `toast.test`, `component-names.test` — правки моков и поиска элементов.
- Риски: в `GiftForm` у описания больше нет `textAlignVertical: "top"` (у `TextArea` Tamagui на Android проверить глазами); `ConfirmDialog` в режиме `confirm` теперь `alertdialog`, а не `dialog` (тесты и роль обновлены, для экранов роль не важна).

**Задача 5 (экраны `apps/mobile/app/**`, удаление `tokens.ts`) — сделана.** Проверено: `vitest` mobile (32 файла, 427 тестов), `vitest` ui (9 файлов, 40), `tsc` и `eslint` mobile и ui, `node scripts/check-boundaries.mjs` (0), `node apps/web/scripts/sync-spa.mjs` (экспорт собирается), `grep -r "theme/tokens\|StyleSheet" apps/mobile` пуст. Замер веба: gzip всех JS 625 627 байт против базы 487 792, прирост +137 835 байт (около 134,6 КиБ при бюджете 150 КБ). На Android и в браузере вручную не запускалось.
- `_layout.tsx`: модульный `createGiftListConfig({ body: "Manrope", heading: "Lora", bodyFaces })`, `GiftListProvider` вокруг `SafeAreaProvider`; фон навигатора — `colors.background` из `@gift-list/ui`. `src/theme/tokens.ts` удалён (каталога `src/theme` больше нет).
- Экраны `(app)/index`, `settings`, `gifts/new`, `gifts/[id]/edit`: `Screen` + `SafeAreaView style={{ flex: 1 }}` + `Column` (`size` form/wide, `paddingHorizontal={pageGutter(width)}`, `gap="$2"`), заголовок экрана — `Heading level={1}`, логотип — `Text kind="display-sm" tone="primary"`, область прокрутки — `ScrollView` пакета, сетка карточек — `XStack role="list" flexWrap="wrap"`, футер списка — `XStack testID="wishlist-footer"`, кнопки «Выйти», «Настройки», «Назад», «Удалить желание» — `Pressable` пакета + `Text kind="button"`. В `index.tsx` появился небольшой внутренний `RetryView` (текст и «Повторить»). RN остался только для API без разметки: `useWindowDimensions`, `AccessibilityInfo`, `Platform` и типы.
- `(auth)/*`, `invite`, `wishlist`: `Text` из пакета (`role="alert" aria-live="polite"` вместо `accessibilityRole`/`accessibilityLiveRegion`); ссылки — новый `NavLink` (`src/ui/nav-link.tsx`, прежний `nav-link.ts` с `navLinkStyle` удалён): `Link asChild` + `LinkText render="a" role="link"`, то есть в вебе настоящий `<a href>` (проверено рендером: `<a role="link" href="/x">`), на телефоне текст берёт нажатие роутера. Для `Text` в Tamagui 3.1.10 пропса `tag` нет, элемент выбирается `render="a"`.
- `src/ui/anonymous-screen.tsx`: `ScrollView` RN заменён пакетным.
- `packages/ui`: добавлен `ScrollView` (`src/scroll.tsx`, реэкспорт `@tamagui/scroll-view` 3.1.10; на вебе это `div` с `overflow`, без `react-native`), тест `scroll.test.tsx`, зависимость в `packages/ui/package.json` и в `packages/ui` секции `package-lock.json` (пакет уже был в lock, новых копий нет). Экспорт `ScrollView`, `ScrollViewProps` из корня.
- Тесты: `card-grid.test.ts` берёт `spacing` из `@gift-list/ui`. В семи файлах `src/session/*.test.tsx` (edit-gift-screen, gift-flows, login-screen, my-wishlist-screen, new-gift-screen, password-rule, settings-screen) удалены ручные моки `react-native` (с `StyleSheet.create`): экраны рендерятся на настоящем Tamagui через алиас `react-native-web` и общий Provider. Правки сверх этого: в `my-wishlist-screen` и `edit-gift-screen` убрана проверка `data-accessible` (`accessible` — только нативный флаг, в DOM его нет; `aria-busy` и `aria-label` остались); в `my-wishlist-screen` геометрия toast над футером считается через `getComputedStyle` вместо записанных стилей (удалены `layout` и `flattenStyle`); в `settings-screen` кнопка ищется через `controls` из `@/test/dom`, потому что `Pressable` пакета — `div role="button"`, а не `<button>`.
- Риски: скелетон загрузки получает `accessible` (нужен на телефоне, чтобы область читалась одним элементом); на вебе флаг не попадает в DOM и предупреждений React в тестах нет, но на Android это не проверялось. Проход `contentContainerStyle={{ gap }}` у `ScrollView` в списке (между кнопкой «Добавить» и сеткой) глазами не сверен. Хвост задачи 4 выполнен: `nav-link` переведён на `LinkText`, устаревший комментарий про `useLayerClosed` в `index.tsx` убран.

**Задача 6 (`apps/web`) — сделана.** Проверено: `typecheck`, `lint`, `vitest` web (37 файлов, 371 тест), `node scripts/check-boundaries.mjs` (0), `npm run build` (с канареечным `apps/web/.env`, после сборки удалён) и standalone-сервер: `/` 200, `/register` 200, `/login` (SPA) 200, `/ui-check` 404, `/l/x` 404; `next dev`: `GET /ui-check` 200, в HTML первого ответа `<style id="tamagui-ssr">` с `--c-primary:#2F5D3A`, карточки «Плед»/«Книга» и кнопка «Открыть Dialog». Открытие и закрытие Dialog в живом браузере не проверялись (их покрывают тесты `packages/ui/dialog.test.tsx` и порядок SSR выше).
- Удалены `components.json`, `postcss.config.mjs`, `src/components/ui/{button,input,label}.tsx`, `src/lib/utils.ts`. `globals.css` переписан в обычный CSS (сброс, фон `#F4F1EA`, `font-family: var(--font-sans)`), классы Tailwind из `layout.tsx` убраны.
- `src/app/tamagui-registry.tsx` (`"use client"`: конфиг на модуль, `useServerInsertedHTML` → `<style id="tamagui-ssr">`, `GiftListProvider`), `layout.tsx` оборачивает `children` в `TamaguiRegistry`.
- `/ui-check`: `src/app/(dev)/ui-check/page.tsx` (серверный; при `NODE_ENV=production` — `notFound()`) и клиентский `ui-check.tsx` (две `WishCard`, кнопки, `Dialog` с возвратом фокуса через `restoreFocus`). `spa-paths.ts` не менялся: fallback-rewrite в Next срабатывает только для путей без собственной страницы, а у `/ui-check` страница есть, поэтому SPA её не перехватывает ни в dev, ни в production (там отдаётся 404 самой страницы; `spa-paths.test.ts` не затронут). Добавлять `/ui-check` в `NEXT_OWNED_PREFIXES` не нужно и вредно: путь попал бы в публичный контракт.
- Тест `ui-check.test.tsx`: SSR-разметка со стилями, 404 в production, рендер вне production. `vitest.config.ts` web теперь собирает `src/**/*.test.{ts,tsx}`.
- Замечания: `next dev` перезаписывает `apps/web/AGENTS.md` (заголовок `#` → `##`), я откатил это; при полном параллельном прогоне тестов web два теста `api/unknown-routes` один раз упали по таймауту 5 с (память/нагрузка), повторный прогон зелёный.

**Аудит матрицы I/O — добавлены тесты.**
- `packages/ui/src/layer.native.test.tsx`: `useBackClose` из `layer.native.ts` с замоканным `BackHandler` (`vi.mock("react-native")`; файл импортирует `./layer.native` напрямую, отдельный include не нужен). Открытый слой: `hardwareBackPress` зовёт `onClose` и возвращает `true`; закрытый не подписывается; после закрытия и размонтирования подписки нет; свежий `onClose` берётся без переподписки.
- `packages/ui/src/dialog.test.tsx`: кнопка открывает `Dialog`, Esc, после закрытия `document.activeElement` — эта кнопка (паттерн приложений: `onClosed` → `restoreFocus(ref)`). Код менять не пришлось, фокус возвращается.
- `scripts/check-boundaries.test.mjs` (`node --test`, подключён к корневому `npm test` после workspace-тестов): чисто → 0; дубль в копии lock (`GIFT_LIST_LOCKFILE`) → 1 с `duplicate copies of …` и `must share one version`; `import … from "tamagui"` во временном файле `apps/web/src` → 1; `tamagui/dialog` и `@tamagui/core` → 0. Временные файлы и каталоги lock удаляются в `after`. Проверено: ui 46 тестов, mobile 427, `node --test` 4/4, `check-boundaries.mjs` 0.

**Правки по ревью, проход 1.**
- Типы и тесты: в `settings-screen.test.tsx` приведение к `HTMLButtonElement`, в pending-кейсе «Ник» `readOnly` true во время запроса и false после. `Heading`/`Text`: `kind` типизирован как `TypographyRole`, `/ui-check` на `display-sm`.
- Шрифты на вебе: `config.ts` регистрирует ещё три шрифта (`body-500`, `body-600`, `display`); при `bodyFaces` (Expo) их вес «normal», а семейство — загруженный файл (`Manrope-600`, `Lora`), без `bodyFaces` (Next) веса настоящие. Выбор — `font-style.ts` (`fontFor(role)`), на телефоне `font-style.native.ts` оставляет прежний `face` у `$body`/`$heading`. `Text`, `Button`, `TextField`, `Dialog` берут шрифт через `fontFor`. Тест `fonts.test.tsx`. В браузере и на Android не сверялось.
- `tamagui-registry.tsx`: один `<style id="tamagui-ssr">` на запрос (флаг в ref), пустой не выдаётся; тест `tamagui-registry.test.tsx`.
- `Button`: `busy` остаётся фокусируемой (`aria-disabled`, `aria-busy`, `tabIndex 0`, не `disabled`); заблокированная кнопка не отправляет форму (в DOM `type="button"`). Тесты экранов и `ConfirmDialog` обновлены: у занятой кнопки `disabled === false`, `aria-disabled="true"`; у «Отмены» формы дополнительно `tabIndex 0`.
- `TextArea` в `text-field.tsx`: `textAlignVertical: "top"`. `FieldShell.displayName`. Подсказка при `error === ""` (`||`) и тест.
- Токены вместо литералов: `globals.css` `var(--c-background)` (Tamagui отдаёт `:root{--c-background}`), `zIndex="$base"`, `$3` в `edit.tsx`, `choice`, `skeleton`, `toast`, `visibility-chip`, `status-pill` через `spacing`/`typography` (отступ чипа 2 пересчитан из `body.lineHeight` и `icon-inline`: 2 вместо 1, зазор строки `$1` вместо 2; оба на глаз не сверены).
- `packages/ui/eslint.config.mjs`: `react/display-name`, `react/function-component-definition`, `react-hooks`; хук `useMount` в тестах переименован в `createMount`. `eslint-plugin-react`, `eslint-plugin-react-hooks`, `react-dom` добавлены в `devDependencies` пакета, `react-dom` ещё в `peerDependencies` (правка `package.json` и секции `packages/ui` в lock; дублей нет, `check-boundaries` зелёный).
- `pressOnKeyDown`: игнорирует `event.repeat`, у `role="link"` только Enter; `Pressable` вызывает `onKeyDown` из пропсов перед своим. Тест `pressable.test.tsx`.
- `Dialog`: отложенный `onClosed` отменяется при размонтировании и не срабатывает, если слой уже открыт снова; тест «закрыть и сразу открыть».
- `nav-link.test.tsx` с честным `asChild` в моке `Link`: один `<a href role="link">`. Устаревший JSDoc `PrimaryButton` обновлён.
- `check-boundaries.mjs`: `packages/ui/src` запрещены ещё `next/*`, `expo*`, `better-auth`/`@better-auth/*`; в `check-boundaries.test.mjs` кейс с временными `*.test-fixture.ts` в `packages/ui/src` (env, contracts, next, expo, better-auth).
- `WishCard`: подсветка рамки при наведении только у карточки с `onPress` (вариант `interactive`).
- Шрифты на вебе, повторно: причина — `fontFamily: "$body-600"` не ставит на элемент класс `font_body-600` (Tamagui делает это, только если значение — имя шрифта без `$`), поэтому `--f-family` оставался от корневого `.font_body`. `fontFor` (веб) теперь отдаёт `body`, `body-500`, `body-600`, `display` без `$`; тест `fonts.test.tsx` рендерит `Heading`, `Text`, `Button`, `TextField` с конфигом как в `_layout.tsx` и проверяет класс `font_*` на самом элементе. В живом Expo web не пересобирал.

## Spec Change Log

## Review Triage Log

Проход 1 (2026-11-05). Слои: Blind Hunter (BH), Edge Case Hunter (ECH), Verification Gap (VG), reviewer проекта (R).

| # | Источник | Находка | Вердикт | Доказательство | Маршрут |
|---|---|---|---|---|---|
| 1 | R | `npm run typecheck` падает: `settings-screen.test.tsx:269` `.disabled` у `HTMLElement` | high | `tsc --noEmit` в `apps/mobile` → TS2339 | patch |
| 2 | R | В Expo web Manrope 500/600 и Lora рисуются синтетическим жирным | high | В браузере `/login`: `document.fonts` — `Manrope|normal`, у заголовка и кнопки `font-weight:600` при `font-synthesis: weight`; раньше были начертания `Manrope-600` | patch |
| 3 | BH, ECH, VG, R | SSR-регистр: `getNewCSS` с модульного конфига; лишние и дублирующиеся `<style id="tamagui-ssr">`; регистр без теста | medium | `curl /ui-check`: CSS темы и атомарные классы приходят в `<style data-precedence>` от Tamagui, регистр добавляет 4 тега с одним id, почти пустых. FOUC не подтверждён (CSS есть в каждом ответе) | patch |
| 4 | ECH, R | `Heading kind="headline-lg"` на `/ui-check` — несуществующая роль; `kind` принимает любую строку | medium | Ролей `headline-lg` нет в `tokens.ts`; `tsc` web проходит | patch |
| 5 | BH, R | `busy` у `Button` даёт атрибут `disabled` → фокус уходит на `body` при отправке форм | medium | `button.tsx`: `busy` без `focusableWhenDisabled` → `disabled`, `tabIndex=-1`; `PrimaryButton` передаёт `busy={disabled}` | patch |
| 6 | ECH | Удалён `textAlignVertical: "top"` у многострочного описания (Android) | medium | Удаление в `gift-form.tsx`; `Input.native` Tamagui значения по умолчанию не ставит | patch |
| 7 | BH, ECH, R | Литералы вместо токенов: `globals.css` `#F4F1EA`, `wish-card` `zIndex={1}`, `edit.tsx` `paddingHorizontal={12}`, `choice`, `skeleton`, `toast` `16+`, `visibility-chip` `-8`; StatusPill отступ 8 вместо 10 из DESIGN.md | medium | Найдено по файлам в отчёте R; ux-design.mdc «токены, не литералы» | patch |
| 8 | BH | В `packages/ui/eslint.config.mjs` нет правил `react/function-component-definition`, `react/display-name`, `react-hooks` | medium | Конфиг только `tseslint.recommended`; спека требует правил «и в packages/ui» | patch |
| 9 | R | Нет `FieldShell.displayName` | low | `text-field.tsx:76` | patch |
| 10 | ECH, BH, R | `pressOnKeyDown` повторяет нажатие при зажатой клавише и активирует ссылку пробелом; `Pressable` перетирает `onKeyDown` вызывающего | low | `press.ts` без `event.repeat`; `pressable.tsx` ставит `onKeyDown` после `{...rest}` | patch |
| 11 | ECH | `error ?? hint`: пустая строка ошибки прячет подсказку и `aria-describedby` | low | `text-field.tsx` использует `??` | patch |
| 12 | ECH | `Dialog`: отложенный `onClosed` по `setTimeout` срабатывает после повторного открытия и уводит фокус | low | `dialog.tsx:113-119` без проверки, что слой ещё закрыт | patch |
| 13 | VG | Нет теста: «Отмена» GiftForm фокусируема во время сохранения | medium | Удалён `ghost-button.test`; `gift-form.test` проверяет только отсутствие `onCancel` | patch |
| 14 | VG | Нет теста: ник `readOnly` во время сохранения | medium | `settings-screen.test` не проверяет поле | patch |
| 15 | VG | Нет теста `NavLink` (один `<a href role=link>`), моки `Link` его скрывают | medium | grep `nav-link` в тестах пуст | patch |
| 16 | VG, BH | Нет теста правил чистоты `packages/ui` в `check-boundaries`; нет запрета `next/*`, `expo*`, `@better-auth/*` в `packages/ui/src` | medium | `check-boundaries.test.mjs` — 4 случая без `packages/ui/src` | patch |
| 17 | BH | В `packages/ui/package.json` не объявлены `react-dom` (тесты, веб) | low | Импорты `react-dom/client`, `react-dom/server` в тестах пакета | patch |
| 18 | BH | Устаревший JSDoc в `primary-button.tsx` | low | Задача 5 сделана, обёртка осталась | patch |
| 19 | BH | `WishCard` подсвечивает рамку при наведении и без `onPress` | low | `hover:$primary` на `Card` | patch |
| 20 | BH, R | `epic-1-context.md` потерял требования других историй | low | `git diff`: удалены строки про дружбу по ссылке, два списка, один домен | patch (исправлено в основной сессии) |
| 21 | BH, R | `deferred-work.md` пишет, что платформенные части проверены «на эмуляторе» | low | Implementation Notes: на Android не запускалось | patch (исправлено в основной сессии) |
| 22 | BH, R | Замер веса сделан до задачи 6 и аудита; скрипт не в репозитории | medium | Замер после задачи 5 | defer: повторный замер — в финальной проверке verifier; скрипт в репозиторий — `deferred-work.md` |
| 23 | ECH | `BottomSheet` не вызывает `onClosed`, если закрытие прервано | maybe-false | Шторка в приложении не используется; нужно проверить `onTransition` с `finished=false` в браузере | defer |
| 24 | ECH | `layer.native`: фокус до монтирования портала, `onClosed` при размонтировании | maybe-false | Нужен прогон на Android с TalkBack | defer |
| 25 | BH | `Choice` без клавиатурной модели `radiogroup` (стрелки, roving tabIndex) | medium | Так было и в `ChoiceGroup` до перевода (`Pressable` на каждую строку) | defer (до истории) |
| 26 | BH, R | `role="alert"` вместе с `aria-live="polite"`; `accessibilityHint` не доходит до диктора в вебе | low | Так было до перевода | defer |
| 27 | BH | Тема не переносит блок `components` frontmatter; тест токенов не сверяет `fontFamily`/`letterSpacing` | maybe-false | AC перечисляет цвета, радиусы, отступы, размеры, типографику; значения компонентов используются в компонентах. Нужна построчная сверка блока `components` | defer |
| 28 | BH | `/ui-check` читает `process.env.NODE_ENV` мимо `getEnv()` | false | `NODE_ENV` — флаг сборки Next, не конфигурация сервера из `envSchema`; правило AGENTS.md про конфигурацию сервера | reject |
| 29 | BH | Касты `as never` у ref | low | Исправление добавляет публичные типы; ошибок в рантайме нет | reject |
| 30 | R | Текстовые кнопки экранов — `div role="button"`, не `<button>` | low | До перевода тоже `div`; клавиатура работает, зона 44 | reject |
| 31 | ECH | Неинтерактивный `VisibilityChip` без `chipRef` | false | Фокус возвращается только на чип открытого желания, он интерактивный и получает ref | reject |
| 32 | R | Предупреждения Tamagui `borderRadius="4"`, `zIndex="1"` в dev | low | Значения по умолчанию `tamagui/dialog`, наши стили их перекрывают; только dev-лог | reject |
| 33 | BH | Статусы спеки и `sprint-status.yaml` расходятся | false | Спека `in-review` — по шагу 4; `sprint-status` переводится в `done` на шаге 5 | reject |

## Design Notes

- Порядок работ: зависимости и lock (один владелец) → `packages/ui` ∥ CI-проверка → mobile `src/ui` → экраны mobile ∥ web. Параллельные ветки — в отдельных worktree, без пересечения файлов.
- Тесты mobile: лучше один setup с `react-native-web` и Provider, чем мокать Tamagui. Тесты должны проверять поведение, а не DOM конкретной библиотеки.
- Android-«Назад»: в обёртке Dialog/BottomSheet `BackHandler.addEventListener("hardwareBackPress")`, только пока слой открыт. Возвращает `true`, когда закрыл слой.

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` -- зелёные
- `node apps/web/.next/standalone/apps/web/server.js` + `GET /`, `/register` -- 200
- `node <scratchpad>/measure-web-size.mjs apps/mobile/.spa-export` -- прирост ≤ 150 КБ gzip

**Manual checks:**
- Браузер (агент): вход, регистрация, сброс, «Мой вишлист», создание и правка желания, видимость (picker), удаление с ConfirmDialog, тост, настройки, `/ui-check`. Сверка с DESIGN.md, Esc и фокус у слоёв.
- Android-эмулятор (человек, AVD `giftlist_spike`, Expo Go SDK 58): те же экраны; системная «Назад» закрывает Dialog и BottomSheet; шрифты Lora и Manrope на кириллице.
