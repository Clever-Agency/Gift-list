---
title: "Sprint Change Proposal: общий UI-пакет на Tamagui для Expo и Next"
created: 2026-11-04
author: Sergey
workflow: bmad-correct-course
mode: batch
scope: moderate
source: спайк Tamagui 2026-11-03…04 (_bmad-output/implementation-artifacts/spike-tamagui-2026-11-03.md), решения Sergey в сессии
status: approved
approved: 2026-11-04
follows: sprint-change-proposal-2026-10-29-i18n.md
---

# Sprint Change Proposal: общий UI на Tamagui (2026-11-04)

Меняются плановые документы и `AGENTS.md`. Код приложения меняет новая Story 1.9.

## 1. Суть

**Что запустило.** Перед Story 2.1 встал вопрос, на чём писать компоненты. Сейчас два набора:

- в `apps/mobile` — свои компоненты на `StyleSheet` и константах `src/theme/tokens.ts`;
- в `apps/web` — shadcn/ui + Tailwind (Story 1.1).

shadcn в React Native не работает. Значит, каждый компонент, который нужен и приложению, и Next-страницам (карточка желания на `/l`, кнопки, поля, панели), пишется дважды, а токены Forest Paper живут в двух копиях. Владелец хочет один подход для обоих рантаймов.

**Тип:** решение по технологии после спайка. Новой функциональности нет.

**Решения Sergey в сессии:**

1. Один UI-пакет `packages/ui` на **Tamagui**, его используют приложение Expo (Android, iOS, браузер) и Next-страницы.
2. Next-страницы остаются на Next ради серверного рендера, превью в мессенджерах и быстрого первого показа (UX-DR10). **`/admin` тоже на Tamagui**: shadcn и Tailwind уходят из `apps/web` целиком.
3. React в вебе выравнивается с Expo (19.3.0).
4. Работа — новая **Story 1.9** в Epic 1, до Story 2.1.

**Что проверил спайк** (подробно — в отчёте):

| Проверка | Итог |
|---|---|
| Next 16.4.3 + Turbopack, без плагина Tamagui | `npm run build` проходит, standalone запускается |
| `/l/:token` на сервере | Карточки и весь CSS (токены + атомарные классы) уже в HTML, OG-теги есть, ошибок гидратации нет; JS страницы 224 КБ gzip вместе с React и Next |
| Expo в браузере | Токены, шрифты, hover, focus-visible; `Dialog` по Enter, фокус внутри, Esc закрывает; `Switch` — `<button role="switch">` |
| Android (эмулятор, Expo Go SDK 58) | Экран, `Dialog`, `Sheet` работают; кириллица Manrope/Lora на месте |
| Одна версия React | После выравнивания — одна копия 19.3.0; Metro без особых правил |
| Вес веб-сборки Expo | +142 КБ gzip при импорте по подпутям (из них ядро ~94 КБ); +329 КБ при импорте из `"tamagui"` целиком |
| CI | `typecheck`, `lint`, `test` (53 + 145 + 54), `build` проходят |

**Альтернативы, которые отклонены:**

- *shadcn в вебе + RN Reusables в приложении.* API одинаковый, но компоненты в двух копиях. Reusables работает через NativeWind; NativeWind v5 (Tailwind v4, как в вебе) — release candidate, проверен на Expo 57, не на нашем 58.
- *gluestack-ui.* Актуальная v5 официально перестала поддерживать Next.js.
- *Всё в Expo, без Next-страниц.* Ломает первый показ ссылки анониму и превью в мессенджерах.
- *Оставить как есть.* Каждый общий компонент — две реализации навсегда.

## 2. Чек-лист

| # | Пункт | Статус | Заметка |
|---|-------|--------|---------|
| 1.1 | Триггер | [x] | Подготовка к Story 2.1; shadcn не работает в RN |
| 1.2 | Тип | [x] | Решение по технологии после спайка |
| 1.3 | Доказательства | [x] | Отчёт спайка: сборки, замеры, эмулятор, CI |
| 2.1 | Текущий эпик | [!] | Epic 1 (done) получает Story 1.9 и возвращается в `in-progress` |
| 2.2 | Изменения эпиков | [!] | Новая Story 1.9; Story 2.1 зависит от 1.9 |
| 2.3 | Будущие эпики | [!] | Story 3.3, 4.7, 6.4, 6.5, 7.2 (отписка), Epic 10 — компоненты из `packages/ui` вместо shadcn |
| 2.4 | Новые и снятые | [N/A] | Эпики не добавляются и не снимаются |
| 2.5 | Порядок | [!] | 1.9 → 2.1. Остальной порядок не меняется |
| 3.1 | PRD | [!] | D-41 правится, новое D-47 |
| 3.2 | Архитектура | [!] | AD-2 переписан, новое AD-28 (гигиена зависимостей UI), AD-17 и AD-26 — фразы про общий UI-пакет и версии React, Stack, Design Paradigm, Structural Seed |
| 3.3 | UX | [!] | DESIGN: описание, комментарий к токенам, вводные разделов App и «Next-страницы», строка `/admin`, системная «Назад» в BottomSheet/Dialog. EXPERIENCE: `ui_system`, UI-система, UX-A1 |
| 3.4 | Прочее | [!] | `AGENTS.md` (правило про общий UI-пакет, раздел про Tamagui), `sprint-status.yaml`, проверка дублей в CI |
| 4.1 | Прямая корректировка | Да | Одна новая история в Epic 1, правки формулировок в остальных |
| 4.2 | Откат | Частично | Story 1.1 и 1.3 не откатываются; их результат (shadcn в `apps/web`, `StyleSheet`-компоненты) заменяет Story 1.9 |
| 4.3 | Пересмотр MVP | Нет | Объём MVP не меняется |
| 4.4 | Выбор | [x] | Прямая корректировка + Story 1.9 |
| 6.3 | Одобрение | [x] | Sergey одобрил 2026-11-04 |
| 6.4 | sprint-status | [x] | `epic-1: in-progress`, ключ Story 1.9 добавлен |

## 3. Подход

**Прямая корректировка.** Граница клиентов (AD-17) остаётся: приложение — полный клиент на трёх платформах, Next отдаёт только серверные страницы. Меняется только то, чем рисуется UI: общий пакет компонентов `packages/ui` на Tamagui вместо двух наборов. Доменная логика по-прежнему только на сервере; в `packages/ui` нет запросов к API, Prisma и env.

**Трудоёмкость:** средняя, одна история (оценка 2–4 дня):

- тема по DESIGN.md;
- перевод трёх компонентов приложения и трёх компонентов shadcn;
- удаление shadcn и Tailwind;
- проверки в CI.

**Риски и как они закрываются:**

| Риск | Закрытие |
|---|---|
| npm раскладывает пакеты `@tamagui/*` вложенными копиями → два React-контекста → падение на Android (поймано в спайке) | AD-28: `@tamagui/native` в корневом `package.json`, `overrides` для React, проверка в CI, что вложенных копий нет |
| Веб-сборка Expo тяжелеет | Импорт только по подпутям (lint-правило), бюджет +150 КБ gzip |
| Tamagui v3 новая, знания агентов устарели | В `AGENTS.md` — сверяться с `tamagui.dev/llms.txt` и манифестами компонентов в `node_modules` |
| `Dialog` и `Sheet` в Next не проверены (на `/l` их нет) | Критерий приёмки Story 1.9 |
| Системная «Назад» на Android не закрывает `Dialog` | Обёртка слоя в `packages/ui` обрабатывает «Назад»; критерий приёмки Story 1.9 |
| React в вебе теперь привязан к версии Expo SDK | AD-28: поднимать парой, по версии SDK |

## 4. Изменения в документах

Формат: было → стало. Нормативный текст после одобрения вносится в сами файлы.

### 4.1 PRD (`prd.md`, §12)

**D-41, было:**
> **Монорепозиторий** (Sergey, 2026-10-28): `apps/web`, `apps/mobile`, `packages/contracts`. Общий UI-пакет не делаем (разные версии React, AD-17).

**Стало:**
> **Монорепозиторий** (Sergey, 2026-10-28): `apps/web`, `apps/mobile`, `packages/contracts`. Общий UI-пакет — `packages/ui` (D-47, ред. 2026-11-04).

**Новое D-47:**
> | **D-47** | §7 | **Общий UI на Tamagui** (Sergey, 2026-11-04, по итогам спайка). Компоненты приложения Expo и Next-страниц (`/l`, `/i`, `/unsubscribe`, `/admin`) — один пакет `packages/ui` на Tamagui. shadcn/ui и Tailwind из `apps/web` убираются. React в вебе той же версии, что в Expo. Next-страницы остаются на Next ради серверного рендера и превью ссылок (UX-DR10). |

### 4.2 Архитектура (`ARCHITECTURE-SPINE.md`)

**AD-2, было:**
> ### AD-2 — Starter и UI-стек `[ADOPTED UX-A1]`
> - **Prevents:** расхождение UI-библиотеки веба; общий React-пакет с нативным клиентом
> - **Rule:** Веб уже поднят: Next.js App Router + shadcn + brand delta Forest Paper. UI приложения — отдельное приложение Expo на трёх платформах (AD-17) и **не** импортирует shadcn и `apps/web`; shadcn остаётся для серверных страниц и админки. Токены Forest Paper в мобильном клиенте — константы, не общий React-пакет: версии React расходятся.

**Стало:**
> ### AD-2 — UI-стек: общий пакет на Tamagui `[ADOPTED D-47]`
> - **Binds:** весь UI `apps/mobile` и `apps/web`, design tokens
> - **Prevents:** два набора компонентов и две копии токенов; разный вид одной карточки в приложении и на `/l`
> - **Rule:** UI приложения Expo (Android, iOS, браузер) и Next-страниц — пакет `packages/ui` на Tamagui. Пакет отдаёт исходники TS без сборки, как `packages/contracts`, и транспилируется Next через `transpilePackages`. В пакете — тема Tamagui со значениями из frontmatter DESIGN.md (единственный источник токенов в коде) и компоненты; запросов к API, Prisma, env и переводов в нём нет — тексты приходят пропсами. Шрифты пакет не грузит: приложение передаёт имена начертаний expo-font, Next — CSS-переменные `next/font`. Next-страницы рендерятся на сервере, CSS Tamagui попадает в HTML (`useServerInsertedHTML`). Компоненты Tamagui импортируются только по подпутям (`@tamagui/core`, `@tamagui/stacks`, `tamagui/dialog` …), не из `"tamagui"` целиком. shadcn/ui, Tailwind и `@base-ui/react` в репозитории не используются. По API Tamagui v3 сверяться с `tamagui.dev/llms.txt` и `*.manifest.ts` компонентов.

**Новое AD-28:**
> ### AD-28 — Версии и копии зависимостей UI `[ADOPTED D-47]`
> - **Binds:** корневой `package.json`, `package-lock.json`, AD-2, AD-17
> - **Prevents:** две копии React или `@tamagui/*` и разорванные React-контексты (портал, меню); падение на Android, которое не видно в браузере
> - **Rule:** React и `react-dom` в `apps/web` и `apps/mobile` — одна точная версия, та, на которую рассчитан Expo SDK; поднимать парой вместе с SDK. Корневой `package.json` держит `overrides` для `react` и `react-dom` на этой версии. Все `@tamagui/*` и `tamagui` — одна точная версия; `@tamagui/native` объявлен зависимостью корневого `package.json`, иначе npm раскладывает его вложенными копиями. Проверка в CI падает, если в дереве больше одной копии `react`, `react-dom`, `tamagui` или любого `@tamagui/*`. Metro — без правил подмены путей (`resolveRequest`) для React и Tamagui. Пакеты, у которых версия закреплена в одном месте и не закреплена в другом (как `@better-auth/core` при `better-auth`), закрепляются явно.

**AD-17, было (две фразы):**
> - **Prevents:** Expo вызывает Server Actions; две копии доменных правил; общий UI-пакет на разных React
> - … Общий код между клиентами — только `packages/contracts` (zod-схемы и каталоги переводов AD-27, без React); импорт `apps/web` из Expo запрещён. Проверено 2026-10-28: SDK 58 рассчитан на React Native 0.88 и React 19.3.0; веб в репозитории на React 19.2.8 — версии не выравнивать через общий UI.

**Стало:**
> - **Prevents:** Expo вызывает Server Actions; две копии доменных правил
> - … Общий код между клиентами — `packages/contracts` (zod-схемы и каталоги переводов AD-27, без React) и `packages/ui` (компоненты и тема, AD-2, без логики и данных); импорт `apps/web` из Expo запрещён. SDK 58 рассчитан на React Native 0.88 и React 19.3.0; веб — на той же версии React (AD-28).

**AD-26, было:** «… `packages/contracts` (…; без React, Prisma и env). Prisma и секреты живут только в `apps/web`. Общего UI-пакета нет (AD-2, AD-17).»
**Стало:** «… `packages/contracts` (…; без React, Prisma и env), `packages/ui` (Tamagui-компоненты и тема, AD-2). Prisma и секреты живут только в `apps/web`.»

**Design Paradigm, новая строка таблицы слоёв:**
> | UI kit | `packages/ui/` | только Tamagui и React; без API, Prisma, env, переводов |

и строки `Server pages + admin` и `App UI`: «… `packages/contracts`, `packages/ui`».

**Stack:**

| Было | Стало |
|---|---|
| React (веб, как в репозитории) — 19.2.8 | React (веб и Expo, одна версия, AD-28) — 19.3.0 |
| Tailwind CSS — 4.3.3 | — (убран) |
| shadcn/ui — CLI latest at scaffold | — (убран) |
| — | Tamagui (`tamagui`, `@tamagui/*`) — 3.1.10, одна версия всех пакетов |

**Structural Seed:** добавить `packages/ui/  # Tamagui: тема из DESIGN.md + компоненты, AD-2`; у `apps/web/src/components/` — «компоненты только из `packages/ui`».

**ARCH-R1 в `epics.md`** — см. 4.3.

### 4.3 Эпики (`epics.md`)

| Где | Было | Стало |
|---|---|---|
| ARCH-R1 | «Starter AD-2 — веб Next.js 16 + shadcn (Story 1.1 выполнена); приложение — Expo SDK 58 (AD-17)» | «AD-2 — общий UI `packages/ui` на Tamagui для приложения и Next-страниц (Story 1.9); веб — Next.js 16 (Story 1.1), приложение — Expo SDK 58 (AD-17); версии и копии зависимостей — AD-28» |
| UX-DR1 | «Токены Forest Paper … общие для веба и приложения» | «… общие для веба и приложения: одна тема в `packages/ui` (AD-2)» |
| Story 1.1 | — | Пометка: «shadcn и Tailwind заменены Story 1.9 (D-47)». AC не переписываются: история закрыта |
| Story 1.3 | — | Пометка: «константы темы `src/theme/tokens.ts` заменены темой `packages/ui` в Story 1.9 (D-47)» |
| **Story 1.9 (новая)** | — | Текст ниже |
| Story 2.1 | «Клиент: приложение.» | «Клиент: приложение. Зависит от Story 1.9: карточка и pill — компоненты `packages/ui`.» |
| Story 3.3 | — | AC: «серверная страница собрана из тех же компонентов `packages/ui`, что экран вишлиста в приложении; CSS в HTML первого ответа» |
| Story 6.5 | «Next-страницы `/l`, `/i`, `/unsubscribe` и `/admin` используют те же токены бренда» | «… используют те же компоненты и тему `packages/ui` (AD-2)» |
| Epic 10 вводная | «Клиент — Next.js, только `/admin`, только ADMIN (AD-22).» | «… Компоненты — `packages/ui` (AD-2), таблицы — TanStack Table поверх них.» |

**Story 1.9: Общий UI-пакет `packages/ui` на Tamagui**

> Клиент: приложение (Android, iOS, браузер) + Next.js. Нужна до Story 2.1.
>
> As a разработчик,
> I want один набор компонентов и одну тему для приложения и Next-страниц,
> So that каждый экран и общий компонент пишется один раз (D-47, AD-2, AD-28).
>
> **Acceptance Criteria:**
>
> **Given** монорепозиторий после Epic 1 и спайк Tamagui
> **When** создаётся пакет `packages/ui`
> **Then** в нём тема Tamagui со всеми значениями из frontmatter DESIGN.md (цвета, радиусы, отступы, размеры, типографика) и всеми ключами темы, которые требуют манифесты используемых компонентов; токенов в коде больше нигде нет (`apps/mobile/src/theme/tokens.ts` удалён)
> **And** пакет отдаёт исходники TS без сборки; в нём нет запросов к API, Prisma, env и строк интерфейса; шрифты передаются из приложения (expo-font) и из Next (`next/font`)
> **And** компоненты: Button (`primary`, `secondary`, `ghost`, `destructive`; настоящий `<button>` в браузере), TextField (label, подсказка, ошибка, связи для диктора по DESIGN.md → «Форма»), WishCard, StatusPill, BottomSheet и Dialog
> **And** BottomSheet и Dialog закрываются кнопкой «Закрыть»/«Отмена», Esc в браузере и системной «Назад» на Android; фокус возвращается на элемент, который открыл слой
> **And** экраны Epic 1 в `apps/mobile` используют только компоненты `packages/ui`; вид на телефоне и в браузере не хуже, чем до перевода (сверка с DESIGN.md)
> **And** в `apps/web` нет shadcn, Tailwind, `@base-ui/react`, `class-variance-authority`; существующие компоненты заменены на `packages/ui`; Next-страница рендерит компоненты на сервере с CSS в HTML первого ответа; `Dialog` открывается и закрывается на Next-странице
> **And** React и `react-dom` — 19.3.0 в обоих приложениях, `overrides` в корне, `@tamagui/native` в корневом `package.json`; Metro без `resolveRequest` и без `disableHierarchicalLookup`
> **And** проверка в CI (`scripts/check-boundaries.mjs` или отдельный шаг) падает, если в дереве больше одной копии `react`, `react-dom`, `tamagui` или любого `@tamagui/*`, или если код импортирует из `"tamagui"` целиком
> **And** веб-сборка приложения тяжелее состояния до истории не больше чем на 150 КБ gzip (замер в описании PR)
> **And** проверено на Android-эмуляторе и в браузере; iOS — когда будет macOS или EAS (в `deferred-work.md`, если не проверено)
> **And** `typecheck`, `lint`, `test`, `build` и запуск standalone проходят; `AGENTS.md` описывает `packages/ui`, AD-28 и ссылку на `tamagui.dev/llms.txt`
> **And** код спайка (`apps/mobile/app/spike.tsx`, тестовая страница `apps/web/src/app/l/[token]`) удалён или заменён рабочим кодом историй

### 4.4 UX

**DESIGN.md:**

| Место | Было | Стало |
|---|---|---|
| `description` | «… четыре серверные страницы Next.js (…) на shadcn/ui + Tailwind — раздел Next-страницы. Токены общие …» | «… четыре серверные страницы Next.js (…) — раздел Next-страницы. Компоненты и токены — один пакет `packages/ui` на Tamagui (AD-2) …» |
| Комментарий у `colors` | «Одни и те же значения: константы темы в apps/mobile и CSS-переменные shadcn в apps/web (AD-2).» | «Значения переносятся в тему Tamagui в `packages/ui` и больше нигде в коде не повторяются (AD-2).» |
| Вводный абзац (строка про shadcn) | «Next-страницы наследуют shadcn/ui и получают тот же brand-layer через CSS-переменные.» | «Next-страницы собраны из тех же компонентов `packages/ui`, что приложение.» |
| «Как это собрано» | «… на React Native — раздел App; на shadcn — раздел Next-страницы» | «… компоненты `packages/ui` (Tamagui) — раздел App; что отличается на Next-страницах — раздел Next-страницы» |
| Раздел App, вводная | «Токены выше — константы темы в `apps/mobile`, не общий пакет с `apps/web` (AD-2).» | «Токены выше — тема Tamagui в `packages/ui`, общая с Next-страницами (AD-2).» |
| App → «Компоненты на React Native» | «Каждый интерактивный элемент — `Pressable` с `accessibilityRole` …» | «Каждый интерактивный элемент — компонент `packages/ui` (Tamagui; в браузере — настоящий `<button>`/`<a>`) с ролью и подписью …» Остальные правила (зона касания без `hitSlop`, состояния, кольцо фокуса) не меняются |
| BottomSheet / Dialog | — | Добавить: «Закрываются и системной «Назад» на Android» |
| Next-страницы, вводная | «Next.js + shadcn/ui + Tailwind. Тот же brand-layer: CSS-переменные shadcn (…) принимают значения из frontmatter …» | «Next.js + компоненты `packages/ui` с серверным рендером: CSS приходит в HTML первого ответа. Шрифты — Lora и Manrope через `next/font` …» |
| Строка `/admin` | «shadcn без изменений поведения: Sidebar (shadcn) … `Table` … `Sheet` … `Switch` … toasts Sonner …» | «Компоненты `packages/ui`: боковое меню — «Подборки», «Теги»; таблицы — TanStack Table с `<caption>` и `<th scope="col">`; формы в Sheet справа с обязательным заголовком; публикация — Switch с подписью; toast в `role="status"`.» Поведение и раскладка не меняются |

**EXPERIENCE.md:**

| Место | Было | Стало |
|---|---|---|
| frontmatter `ui_system` | «React Native + react-native-web (приложение Expo); shadcn/ui на Next.js (4 серверные страницы)» | «`packages/ui` на Tamagui: приложение Expo (React Native + react-native-web) и 4 серверные страницы Next.js» |
| «UI-система» | «… Next-страницы — shadcn/ui на Next.js + Tailwind (UX-A1 принято в AD-2) …» | «… Next-страницы — те же компоненты `packages/ui` с серверным рендером (D-47, AD-2) …» |
| UX-A1 | «Принято в AD-2: приложение — React Native (Expo, react-native-web); Next-страницы — shadcn + Tailwind» | «Пересмотрено D-47: один пакет `packages/ui` на Tamagui для приложения и Next-страниц» |

### 4.5 `AGENTS.md`

**Было:**
> - `apps/mobile` импортирует только `@gift-list/contracts`, импорт `apps/web` запрещён; общий UI-пакет не создавайте — React у веба и Expo разных версий (AD-17).

**Стало:**
> - `apps/mobile` импортирует только `@gift-list/contracts` и `@gift-list/ui`, импорт `apps/web` запрещён (AD-17). UI обоих приложений — только из `packages/ui` на Tamagui (AD-2): импорт по подпутям, не из `"tamagui"`; по API v3 сверяйтесь с `https://tamagui.dev/llms.txt` и `*.manifest.ts` компонентов.
> - React в `apps/web` и `apps/mobile` — одна версия, по Expo SDK; все `@tamagui/*` — одна версия, `@tamagui/native` в корневом `package.json`. После обновления зависимостей проверка в CI ловит вложенные копии (AD-28).

Правило из «Conventions»/«Where things are» про `.cursor/rules/ux-design.mdc` остаётся. Сам `.cursor/rules/ux-design.mdc` правится в Story 1.9, если ссылается на shadcn.

### 4.6 Реализация

- `sprint-status.yaml`: `epic-1: in-progress`; новый ключ `1-9-общий-ui-пакет-packages-ui-на-tamagui: backlog`. Существующие ключи и номера не меняются.
- Linear: задача `Story 1.9: Общий UI-пакет packages/ui на Tamagui`. Порядок: волна до Story 2.1; блокирует 2.1. Заводится после одобрения.

## 5. Передача

**Масштаб: Moderate.** Решение по технологии внутри согласованного MVP, одна новая история.

| Кто | Что |
|-----|-----|
| Архитектор (`bmad-architecture` / этот прогон) | Внести AD-2, AD-28, AD-17, AD-26, Stack, Seed, Design Paradigm |
| PM (этот прогон) | D-41, D-47 в PRD; правки `epics.md` и Story 1.9 |
| UX (этот прогон) | Правки DESIGN.md и EXPERIENCE.md из 4.4 |
| Разработчик (`bmad-build`) | Story 1.9 до Story 2.1; спайк — справочный материал, его код не мержится как есть |
| Sergey | Одобрить предложение; завести задачу в Linear |

**Критерии, что запись состоялась:**

- В PRD есть D-47, D-41 не запрещает общий UI-пакет.
- В spine AD-2 описывает `packages/ui` на Tamagui, есть AD-28, в Stack нет shadcn и Tailwind, React 19.3.0.
- В `epics.md` есть Story 1.9, Story 2.1 ссылается на неё, ARCH-R1 и UX-DR1 обновлены.
- В DESIGN.md и EXPERIENCE.md shadcn не упоминается как действующий стек.
- `AGENTS.md` не запрещает общий UI-пакет и описывает AD-28.
- `sprint-status.yaml` совпадает с `epics.md`.
- Кода приложения в этом изменении нет.

## 6. Дополнение (2026-11-04): порядок после синхронизации с `main`

После одобрения ветка синхронизирована с `main`. Пока шёл спайк, в `main` вошли Story 2.1 (CLE-45), 2.2 (CLE-47), 2.3 (CLE-51), 3.1 (CLE-46), 3.2 (CLE-48), а также CLE-64 и CLE-65 (единый ConfirmDialog, тост, защита несохранённых изменений). Их экраны написаны на `StyleSheet` и `src/theme/tokens.ts`. Порядок «1.9 → 2.1» из разделов 2, 4.3 и 4.6 больше невозможен. Sergey одобрил поправку.

| Было | Стало |
|---|---|
| Story 1.9 нужна до Story 2.1 | Story 1.9 — следующая: до Story 3.3 (CLE-53) и Stories 2.4–2.7 (CLE-49, CLE-52, 2.6, 2.7) |
| Story 2.1: «Зависит от Story 1.9» | Story 2.1: «Сделана на `StyleSheet` до D-47; карточку и pill переводит Story 1.9» |
| AC 1.9: «экраны Epic 1 в `apps/mobile`» | AC 1.9: все экраны и общие компоненты `apps/mobile` — Epic 1, Stories 2.1–2.3, 3.1, `src/ui/*` (ConfirmDialog, Toast, GiftForm, VisibilityPicker, VisibilityChip); поведение не меняется, тесты экранов проходят |
| Трудоёмкость 2–4 дня | 4–6 дней: экранов и компонентов больше (13 компонентов в `src/ui`, 10 экранов) |

**Linear:** задача Story 1.9 — CLE-66; блокирует CLE-53, CLE-49, CLE-52; связана с CLE-45, CLE-47, CLE-51, CLE-46, CLE-65. Пока 1.9 не сделана, новые экраны на `StyleSheet` не начинать.

**Замечено при синхронизации, вне этого изменения:** в `sprint-status.yaml` в `main` Stories 2.1 и 2.2 стоят `backlog`, хотя в Linear они Done и смержены (#37, #39).
