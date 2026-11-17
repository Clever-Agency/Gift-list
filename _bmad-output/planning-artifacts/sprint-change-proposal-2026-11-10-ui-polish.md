---
title: "Sprint Change Proposal — UI polish: hover-токены, движение, фокус, состояния и visual-каталог Storybook"
date: 2026-11-10
language: ru
workflow: bmad-correct-course
mode: batch
scope: moderate
status: approved
approved: "approved by Sergey, relayed by Evgeniy 2026-11-10 (t305u)"
approver: "Sergey (передал Evgeniy, 2026-11-10, t305u); пункт 9 — proposed"
initiator: "Evgeniy, 2026-11-10 (t305u), по итогам W7/W8/W9"
trigger: "Аудит Tamagui 3.1.10 (W7), финальный прогон (W8) и микрозадача toggle пароля (W9) показали разрывы спеки и кода в состояниях интерактивных компонентов, движении и фокусе; Sergey сказал «да» на правки через процесс BMAD и назвал Storybook официальным visual-каталогом вместо расширенного /ui-check"
source: "W7-report.md (§3–§7), W8-report.md (§4 D1–D7), W9-report.md; HEAD 4642945, ветка evivanchikov/wishmoon-ui-config"
follows: sprint-change-proposal-2026-11-04-tamagui-ui.md
---

# Sprint Change Proposal — 2026-11-10, UI polish и Storybook

> **Статус.** Пункты 1–8 утверждены и **применены** в этом прогоне: `approved by Sergey, relayed by Evgeniy 2026-11-10 (t305u)`. Пункт 9 (апгрейд Tamagui 3.1.10 → 3.3.1) — `proposed`: не утверждён и не применялся. Продуктовый код, тесты, конфиги, `package.json` и lock этим прогоном **не менялись**; `npm install` не запускался. Ветка `evivanchikov/wishmoon-ui-config`, HEAD `4642945`.
>
> Правки внесены в `DESIGN.md`, `EXPERIENCE.md`, `ARCHITECTURE-SPINE.md`, `epics.md` и `sprint-status.yaml` — ровно в объёме раздела 4. Код по этим решениям идёт отдельными шагами W11 и W12.x (раздел 6).

## 1. Суть

**Что запустило.** Три read-only прохода подряд показали одно и то же: в `packages/ui` есть тема и доступность уровня «роли и `aria-*`», но визуальный слой состояний почти не реализован, а движение и фокус на телефоне не работают так, как обещает спека.

- **Hover.** Псевдо-состояние `hover:` есть в 4 объявлениях в 3 файлах: `packages/ui/src/button.tsx:31` (secondary — граница), `button.tsx:37` (ghost — фон), `packages/ui/src/info-button.tsx:52`, `packages/ui/src/wish-card.tsx:18` (рамка карточки). У primary/reserve/destructive hover нет вовсе, хотя `DESIGN.md:479` требует «кнопка — затемнение 8%», а `DESIGN.md:350` — «pressed — затемнение 8%». Токенов `*-hover` в теме нет (`packages/ui/src/tokens.ts:10-31`, `packages/ui/src/config.ts:83-94`).
- **Reduced motion.** `prefers-reduced-motion`, `isReduceMotionEnabled`, `useReducedMotion` — **0 совпадений** в `apps/*` и `packages/*` (grep по репозиторию без `node_modules`, 2026-11-10). Инфраструктура при этом уже есть на обеих платформах.
- **Движение.** Единственный `transition` в репозитории — `packages/ui/src/bottom-sheet.tsx:85` (`"medium"` = 240 мс только на вебе; на телефоне `undefined`, и `Sheet` берёт пружину ~0.5–0.8 с). `Dialog` (`packages/ui/src/dialog.tsx:101-175`) и `Toast` (`packages/ui/src/toast.tsx:64-114`) не анимируются вообще. Употреблений `animation=`, `enterStyle`, `AnimatePresence` — 0.
- **Фокус.** У `LinkText` (`packages/ui/src/text.tsx:59-67`) и `NavLink` (`apps/mobile/src/ui/nav-link.tsx:24-28`) нет ни кольца, ни hover: пункт меню — текст с курсором. На телефоне кольца нет ни у одного элемента: `focus-visible` там не наступает никогда — трекер «последнее взаимодействие было клавиатурой» включается только при `isWeb && typeof document !== 'undefined'` (`node_modules/@tamagui/web/src/createComponent.tsx:230-241`), а выбор состояния — в `:1881-1889`.
- **Состояния.** `Choice` при `disabled` даёт `opacity: 0.6` (`packages/ui/src/choice.tsx:72`) вместо 0.4 у `Pressable` (`packages/ui/src/pressable.tsx:20-24`). `TagChip` с ошибкой не краснеет: рамка считается только из `custom`/`selected` (`packages/ui/src/tag-chip.tsx:233`), ошибка живёт в `aria-invalid`/`accessibilityHint` (`tag-chip.tsx:168-170,222-224`). `Button` в `busy` просто бледнеет — индикатора ожидания нет (`packages/ui/src/button.tsx:51-53,128-150`).
- **Safe area и брейкпоинты.** `SafeAreaView style={{ flex: 1 }}` продублирован в 10 файлах (`apps/mobile/app/(app)/index.tsx:425`, `app/(app)/settings.tsx:200`, `app/(app)/gifts/new.tsx:219`, `app/(app)/gifts/[id]/edit.tsx:440`, `app/u/[nick].tsx:412`, `app/wishlist/[token].tsx:178`, `src/ui/not-found-screen.tsx:32`, `src/ui/session-loading-screen.tsx:43`, `src/ui/anonymous-screen.tsx:17`, `src/ui/session-error-screen.tsx:48`), а брейкпоинты темы (`packages/ui/src/config.ts:129-133`) не использует ни один компонент: ширину читает `useWindowDimensions`, колонки считает `cardGrid` (`apps/mobile/src/ui/card-grid.ts:28-47`).
- **Storybook.** Visual-проверка живёт в `/ui-check` (`apps/web/src/app/(dev)/ui-check/ui-check.tsx`): только Next/`react-dom`, только dev, без изоляции, аргументов, аддонов и состояний — hover/focus/disabled/busy/error в витрине не показаны. Расширение `/ui-check` до каталога со всеми состояниями — оценка W7 §6.4 «S–M на полдня–день» и **не** даёт args/controls/a11y-панели.
- **Расхождения документов с уже принятым кодом.** Тост: спека `max(4 с, 1 с + 60 мс × символ)` (`DESIGN.md:415`), код `max(3000, 60 × длина)` (`apps/mobile/src/ui/toast.tsx:12-17`), решение владельца W4. 413 `PAYLOAD_TOO_LARGE`: реализован (`apps/web/src/lib/api-v1.ts:13-30,59,77-84`, `packages/contracts/src/i18n/ru/common.json` → `errors.reason.PAYLOAD_TOO_LARGE`), в UX и архитектуре не описан. Порядок кнопок формы правки и раскладка заголовка вишлиста (`apps/mobile/src/ui/gift-form.tsx:936-947`, `apps/mobile/app/(app)/index.tsx:451-498`) — решения W2, в документах их нет. Лимиты полей W5b (`packages/contracts/src/gift.ts:20-34`: 120 / 2000 / 2048 / 30) в DESIGN не названы. Состояние toggle пароля — W9 (`packages/ui/src/text-field.tsx:193-212`, `password-toggle-a11y.ts` / `.native.ts`), в DESIGN всё ещё «состояние pressed».
- **Версия Tamagui.** В репозитории 3.1.10 (`packages/ui/package.json:20-31`), в spine закреплено 3.1.10 (`ARCHITECTURE-SPINE.md:408`). Актуальная на 2026-11-10 — 3.3.1 (`npm view`). Апгрейд не нужен ни для чего из этого предложения — отдельный опциональный пункт 9.

**Тип:** техническое ограничение и долг, найденный при реализации (W7/W8/W9), плюс решение владельца по инструменту визуальной проверки (Storybook). Новых продуктовых требований нет, объём MVP не меняется.

**Решение владельца процесса (дословно, t305u):** «меняй через предложение BMAD. Сергей сказал "да"»; «storybook намного функциональнее, чем твой /ui-check». Других деталей разговора нет и не выдумывается.

**Границы.** W1b (бренд WishMoon, `sprint-change-proposal-2026-11-10-wishmoon-brand.md`) не затрагивается — ждёт отдельного ответа. PRD не меняется: ни одно решение D-* этим предложением не пересматривается.

## 2. Чек-лист

| # | Пункт | Статус | Заметка |
|---|-------|--------|---------|
| 1.1 | Триггер — история | [x] | Story 1.9 (общий UI на Tamagui) доведена до `done`, но её AC не покрывали hover/motion/фокус; находки W7 §P0–P2, W8 §4 D1–D8 (P0-1…P2-9) |
| 1.2 | Тип проблемы | [x] | Технический долг и расхождение спеки с кодом + новое решение по dev-инструменту; не новый функционал |
| 1.3 | Доказательства | [x] | Таблица §1: каждая находка — `file:line`, проверено чтением кода и grep 2026-11-10; `npm test`/`typecheck`/`lint` — см. §5 |
| 2.1 | Текущий эпик | [!] | Epic 1 получает Story 1.10 (каталог Storybook). Epic 2/3/6 не меняются: их истории используют те же компоненты |
| 2.2 | Изменения эпиков | [!] | Одна новая история 1.10 (dev-only), без FR. Микрозадачи W12.x — без историй (конвенция W9) |
| 2.3 | Будущие эпики | [N/A] | Механизмы AD-2/AD-28 не меняются, эпики 4–10 не затронуты |
| 2.4 | Новые и снятые | [N/A] | Эпики не добавляются и не снимаются |
| 2.5 | Порядок | [!] | Story 1.10 — сразу после 1.9, до микрозадач W12.x; остальной порядок не меняется |
| 3.1 | PRD | [N/A] | Ни одно D-* не пересматривается; новых решений продукта нет |
| 3.2 | Архитектура | [!] | AD-2 (safe area, Storybook, статус `/ui-check`), AD-12 (413 `PAYLOAD_TOO_LARGE`), AD-28 (dev-зависимости), Stack (+Storybook 10.6.7), Structural Seed, `updated` |
| 3.3 | UX | [!] | DESIGN: hover-токены, состояния, движение, фокус, лимиты, порядок кнопок, заголовок вишлиста, toggle пароля, safe area, реализация раскладки. EXPERIENCE: UI-система, 413, busy, фокус и toggle в Accessibility Floor, safe area, Motion |
| 3.4 | Прочее | [!] | `epics.md` (Story 1.10, ARCH-R1), `sprint-status.yaml` (+1 ключ). `AGENTS.md` — в W11 (вне коммита docs, см. §4.6) |
| 4.1 | Прямая корректировка | Да | Правки формулировок + одна история + микрозадачи; откат не нужен |
| 4.2 | Откат | [N/A] | Ничего не откатывается: код W1–W9 остаётся, меняются документы и добавляется код |
| 4.3 | Пересмотр MVP | [N/A] | Объём MVP не меняется |
| 4.4 | Выбор | [x] | Прямая корректировка (Option 1): документы сейчас, код — W11/W12.x |
| 5.1–5.5 | Секции предложения | [x] | §1, §4, §3, §6, §8 |
| 6.1–6.2 | Полнота и точность | [x] | Все пункты 1–8 имеют old→new, влияние на код и риск; пункт 9 помечен `proposed` |
| 6.3 | Одобрение | [x] | `approved by Sergey, relayed by Evgeniy 2026-11-10 (t305u)` — пункты 1–8; пункт 9 — proposed |
| 6.4 | sprint-status | [x] | Добавлен ключ Story 1.10 (`backlog`), существующие ключи и номера не тронуты |
| 6.5 | Передача | [x] | §8: разработчик (`bmad-build`), карточки Linear, критерии готовности |

## 3. Подход

**Прямая корректировка.** Продукт не переписывается: правки документов фиксируют уже принятые решения (W2, W4, W6, W9) и нормируют то, что спека обещала, но код не делал (hover, движение, фокус, состояния). Код идёт после документов, чтобы каждая микрозадача ссылалась на утверждённую формулировку и не спорила с `DESIGN.md`.

**Две волны, Storybook первым.**

1. **W11 — Storybook (web, RNW + Vite).** Сначала каталог, потом полировка: без него hover, fade и состояния нельзя ни проверить, ни показать человеку. Это же закрывает спор «`/ui-check` или каталог»: `/ui-check` остаётся проверкой серверного рендера Next, каталог — Storybook.
2. **W12.1–W12.12 — микрозадачи.** Маленькие, каждая — один коммит, со своими тестами и проверкой в каталоге (где применимо). Порядок в §6.

**Трудоёмкость:** средняя. W11 — 0,5–1,5 дня (установка, конфиг, провайдер, шрифты, сторис на 30+ компонентов/состояний, проверка дублей). W12.x — 0,25–1 день каждая; вместе 4–6 дней. W12.12+ (раскладки на `media`) — отдельный длинный хвост, по одному экрану.

**Почему не иначе:**

- *Расширить `/ui-check`* (вариант A из W7 §6.5) — дешевле на день, но не даёт ни args/controls, ни аддонов, ни изоляции компонента, ни a11y-панели; решение владельца — Storybook.
- *Storybook on-device* (вариант C) — единственный источник правды по iOS/Android, но требует правок `metro.config.js`/babel, отдельного entry-point и обхода запрета `process.env` в `apps/mobile` (`scripts/check-boundaries.mjs:52-61`). Отложено: каталог для веба, натив проверяется вручную.
- *Апгрейд Tamagui сразу* (пункт 9) — не требуется ни Storybook 10.6.7, ни фиксами; тянет за собой смену Stack и полный прогон, поэтому `proposed`.

**Риски и как закрываются:**

| Риск | Закрытие |
|---|---|
| Storybook тянет вторую копию `react`/`@tamagui/*` → `check-boundaries` падает, React-контексты расходятся (AD-28) | установка только в W11, сразу `node scripts/check-boundaries.mjs`; при дубле — точные `overrides`/dedupe, не «починить линт» |
| Токены `*-hover` в frontmatter сломают `tokens.test.ts` (он сверяет блок `colors` с кодом один в один) | в этом прогоне токены только в тексте DESIGN; frontmatter + `tokens.ts` вносятся вместе в W12.5 |
| Hover-затемнение 8% ухудшит контраст текста | посчитано: 8.04:1 / 5.65:1 / 7.40:1 — все ≥ 4.5 (см. §4.1.1) |
| Гейт `reduce` забудут на новом анимированном элементе | правило в DESIGN (`Движение`) + ключ `reduce` в конфиге + тест `config.media.reduce`; проверка в сторис с `prefers-reduced-motion` |
| Кольцо фокуса по `focus` на телефоне включится от касания | пара файлов `focus-ring.ts`/`.native.ts`: на вебе только `:focus-visible`, на телефоне `focus`; unit-тест на выбор пропсов |
| `Pressable` перестанет форсировать `role="button"` → другая семантика во всех чипах и карточках | W12.10 отдельным коммитом, DOM-тесты всех компонентов + ручная проверка TalkBack |
| Раскладки на `media` теряют safe-area и ширину меню/правой колонки | `cardGrid` остаётся источником колонок; перевод поэкранно, первыми — экраны без меню и правой колонки |
| Визуальные проверки в сторис не заменяют устройство | в отчётах и в `deferred-work.md` — «unit/happy-dom ≠ браузер/native»; ручные чек-листы остаются |

## 4. Изменения в документах

Нормативный текст ниже уже внесён в файлы (пункты 1–8). Формат: где было → что стало. Пункт 9 в файлы не вносился.

### 4.1 `DESIGN.md`

Frontmatter: `updated: 2026-11-04` → `updated: 2026-11-10`. В блоке `colors` добавлен комментарий (не токен): hover-токены вносятся сюда и в `tokens.ts` одной правкой в W12.5, потому что `tokens.test.ts` сверяет блок с кодом.

#### 4.1.1 Hover-токены `primary-hover`, `accent-hover`, `destructive-hover`

**Было** (раздел Colors, после Scrim): «… Прочие прозрачности: pressed — затемнение 8%, disabled — 40%.» и больше ничего про hover кнопок.

**Стало** (добавлен пункт):

> - **Hover-затемнение кнопок** (DECISION 2026-11-10). Hover кнопки — её фон, затемнённый на 8%: `primary-hover` `#2B5635` (текст `{colors.primary-foreground}` — 8.04:1), `accent-hover` `#C39315` (текст `{colors.accent-foreground}` — 5.65:1), `destructive-hover` `#A62016` (текст `{colors.destructive-foreground}` — 7.40:1). Все три пары проходят AA для текста 15 px/600; secondary на hover темнит границу до `{colors.foreground}`, ghost — фон `{colors.muted}`. Значения нормативны; в frontmatter и в `packages/ui/src/tokens.ts` они попадают одной правкой вместе с кодом кнопок (W12.5), потому что `tokens.test.ts` сверяет блок `colors` с кодом один в один. Новых цветов для чипов, полей и toast hover не добавляет.

**Расчёт (WCAG 2.x, 2026-11-10):** 8% темнее = каждый канал × 0.92 с округлением.

| Пара | Было | Стало (hover) | Контраст текста |
|---|---|---|---|
| primary / primary-foreground `#F7FAF7` | `#2F5D3A` — 7.27:1 | `#2B5635` | **8.04:1** (AA) |
| accent / accent-foreground `#1E241F` | `#D4A017` — 6.66:1 | `#C39315` | **5.65:1** (AA) |
| destructive / destructive-foreground `#FFFFFF` | `#B42318` — 6.57:1 | `#A62016` | **7.40:1** (AA) |

Совпадает с уже посчитанными строками 8 и 10 в `review-accessibility.md:22,24` (там «hover/pressed −8%»: 8.04 и 5.65) — то есть числа не новые, им просто не хватало токенов.

**Влияние на код:** `packages/ui/src/tokens.ts` (+3 цвета), frontmatter `colors` (+3), `packages/ui/src/button.tsx` (primary/reserve/destructive: `backgroundColor: "$primary hover:$primary-hover"` и т. д.); тест `tokens.test.ts` зелёный только когда оба места меняются вместе.

**Риск:** низкий. Hover на вебе Tamagui оборачивает в `@media (hover: hover)` (`node_modules/@tamagui/web/src/helpers/getSplitStyles.tsx:344-346`), на телефоне не применяется.

#### 4.1.2 Reduced motion: правило и медиа-ключ `reduce`

**Было** (App → Доступность): «**Движение:** fade и сдвиг шторки до 200 мс; при «уменьшить движение» (`prefers-reduced-motion`, `AccessibilityInfo.isReduceMotionEnabled`) — без сдвига, только fade; скелетон статичный. Скелетон в любом случае не мерцает дольше 5 с.»

**Стало** (пункт переписан целиком; нормативный текст — в файле):

> - **Движение** (DECISION 2026-11-10). Пресеты длительности — `quick` 160 мс и `medium` 240 мс (`packages/ui/src/animations.ts` и `animations.native.ts`). Шторка — сдвиг и fade **до 200 мс** (`quick`) на вебе и на телефоне: длительность задаётся явно, потому что нативный `Sheet` без `transition` берёт пружину ~0.5–0.8 с. Диалог и toast — fade `quick` при появлении и уходе (сейчас оба появляются мгновенно). Смена цвета и прозрачности на hover и press — `quick`; крупных движений нет: ни параллакса, ни scale больше 1.02, ни авто-анимаций, ни confetti. Скелетон статичный и в любом случае не мерцает дольше 5 с. **Правило:** все `transition` и анимации гейтятся «уменьшить движение» — в браузере `prefers-reduced-motion: reduce`, на телефоне `AccessibilityInfo.isReduceMotionEnabled`; в Tamagui это один медиа-ключ `reduce` (`media: { reduce: { prefersReducedMotion: "reduce" } }`), который читает обе платформы: веб — `window.matchMedia`, телефон — `@tamagui/react-native-media-driver` поверх `AccessibilityInfo`. Под `reduce` сдвиг, scale и смена раскладки выключаются, у слоёв остаётся только fade непрозрачности до 100 мс, hover и press меняют цвет мгновенно, индикатор ожидания у busy-кнопки не вращается (ожидание объявляется `aria-busy`).

**Проверено по коду библиотек:** медиа-объект сериализуется camelCase → kebab (`node_modules/@tamagui/web/src/helpers/mediaObjectToString.ts:2-32`), то есть ключ даёт ровно `(prefers-reduced-motion: reduce)`. Веб — `window.matchMedia` (`helpers/matchMedia.ts:3-5`). Телефон — `@tamagui/react-native-media-driver@3.1.10` распознаёт `(prefers-reduced-motion: …)` и подписывается на `AccessibilityInfo.isReduceMotionEnabled` / `reduceMotionChanged` (`src/mediaQueryList.native.ts:10-40,86-102`). Медиа-имена компилируются в модификаторы (`helpers/grammarConfig.ts:99-115`), поэтому доступны и как клаузула стиля (`reduce:`), и через `useMedia().reduce`.

**Влияние на код:** `packages/ui/src/config.ts:129-133` (+ ключ `reduce`), компоненты с `transition`/анимацией читают `useMedia().reduce`.

**Риск:** низкий (аддитивно); риск — забыть клаузулу на новом компоненте, поэтому правило записано в DESIGN как общее.

#### 4.1.3 Движение: BottomSheet ≤ 200 мс, Dialog и Toast

Внесено тем же пунктом «Движение» (см. 4.1.2): шторка `quick` 160 мс на обеих платформах (сейчас 240 мс только на вебе и пружина на телефоне), диалог и toast — fade `quick`.

Дополнительно в строке **Toast** таблицы Components:

**Было:** «Длительность: обычный — `max(4 с, 1 с + 60 мс × символ)`; undo toast «Отменить» — 10 с.» (плюс в EXPERIENCE — 10 с на undo).

**Стало:** «Длительность: обычный — `max(3000 мс, 60 мс × символ)` (DECISION 2026-11-10: на 1 с короче прежней формулы `max(4 с, 1 с + 60 мс × символ)`; короткое подтверждение не мигает); undo toast «Отменить» — 10 с. Появление и уход — fade до 160 мс (раздел Доступность → Движение).»

**Влияние на код:** `packages/ui/src/bottom-sheet.tsx:85` (`transition` на обеих платформах), `packages/ui/src/dialog.tsx` (animation на Overlay/Content), `packages/ui/src/toast.tsx` (fade), гейт `reduce`.

**Риск:** средний у шторки: `handleTransition` (`bottom-sheet.tsx:62-73`) завязан на события `open`/`close`; менять длительность — проверять возврат фокуса после закрытия (`bottom-sheet.test.tsx`, ручная проверка). У `Dialog` и `Toast` риск низкий.

#### 4.1.4 Кольцо фокуса для ссылок и на телефоне

**Было** (App → Мышь и клавиатура): «**Видимый фокус:** кольцо `{colors.ring}` 2 px с отступом 2 px на всём интерактивном, только при навигации с клавиатуры (`:focus-visible`). … В Android/iOS с внешней клавиатурой — то же кольцо.»

**Стало:**

> - **Видимый фокус:** кольцо `{colors.ring}` 2 px с отступом 2 px на всём интерактивном — кнопках, полях, чипах, карточках, пунктах меню и текстовых ссылках (`LinkText`, `NavLink`), в браузере только при навигации с клавиатуры (`:focus-visible`). Отступ — цвет фона под элементом, без него кольцо вокруг primary-кнопки не видно. На тёмных и цветных поверхностях (toast) — `{colors.ring-inverse}`. В Android/iOS с внешней клавиатурой — то же кольцо, но по состоянию `focus`: `:focus-visible` в React Native не наступает; кольцо на клик мышью включается только на вебе.

Плюс в App → «Компоненты на React Native» добавлено, что кольцо получают и текстовые ссылки, и почему на телефоне это `focus`, а на вебе — `:focus-visible`. В hover-пункте того же раздела: пункт меню — настоящая ссылка с `hover:`-фоном и кольцом, а не текст без состояния.

**Влияние на код:** `packages/ui/src/text.tsx:59-67` (+`focusRing`, hover/press по `nav-item`), `apps/mobile/src/ui/nav-link.tsx:24-28`; `packages/ui/src/pressable.tsx:6-11` → пара `focus-ring.ts` / `focus-ring.native.ts` (`focus-visible:` на вебе, `focus:` на телефоне).

**Риск:** средний: нельзя включать кольцо по `:focus` на вебе (появится от клика мышью) — поэтому платформенная пара файлов, а не одна клаузула; вид на устройстве — только ручная проверка.

#### 4.1.5 Состояния: Choice 0.4, видимая ошибка TagChip, спиннер busy

**Было:** общих правил состояний не было — только фраза в App → «Компоненты на React Native» (pressed/disabled/focus) и отдельные реализации в компонентах.

**Стало:** после таблицы Components добавлен блок (нормативный текст — в файле):

> **Состояния кнопок и нажимаемых поверхностей** (DECISION 2026-11-10; одни и те же у Button, Pressable, Choice, TagChip, VisibilityChip и WishCard):
> - **hover** — только при указателе: фон кнопки темнее на 8% (`primary-hover`, `accent-hover`, `destructive-hover`, раздел Colors), secondary — граница `{colors.foreground}`, ghost — фон `{colors.muted}`; у полей, чипов, toast и ⋯ вид не меняется, курсор — указатель.
> - **pressed** — затемнение фона на 8% (в коде это непрозрачность 0.9; отдельных pressed-токенов не вводится, чтобы не удваивать палитру); у ghost — фон `{colors.muted}`.
> - **disabled** — непрозрачность 0.4, `aria-disabled` / `accessibilityState.disabled`, элемент остаётся в порядке фокуса, причина рядом связана с ним (`aria-describedby`) и не бледнеет. Правило одно для кнопок, `Pressable`, радио-строк и чипов: 0.4, не 0.6.
> - **busy** — непрозрачность 0.6, `aria-busy`, нажатие и отправка формы заблокированы, рядом с текстом — индикатор ожидания (спиннер 16 px в `currentColor`, вращение линейное); при `prefers-reduced-motion` спиннер статичный, ожидание объявляется `aria-busy`.
> - **error** — у поля и у чипа видимая ошибка, не только ARIA: рамка `{colors.destructive}` 1 px плюс текст `destructive` рядом (у чипа — текст, который рендерит экран; у `ChoiceList` — ещё и рамка группы).

Дополнительно в строке **Tag picker** (Components): ошибка тега видна на самом чипе — рамка `{colors.destructive}` 1 px, текст ошибки рендерит экран; `aria-invalid` и `accessibilityHint` — в дополнение.

**Влияние на код:** `choice.tsx:72` (0.6 → 0.4), `tag-chip.tsx:233` (+`error ? "$destructive"`), `button.tsx:51-53,128-150` (спиннер), новый `Spinner` в `packages/ui`.

**Риск:** низкий у Choice; у TagChip — не сломать цвета `custom`/`selected` (рамка ошибки приоритетнее); у спиннера — не менять ширину кнопки при `busy` (место под индикатор резервируется).

#### 4.1.6 SafeAreaView и переход на Tamagui `media`

**Было:** в DESIGN про safe area и брейкпоинты в коде — ничего.

**Стало:** в вводном абзаце раздела App: «Safe-area insets — `SafeAreaView` / `useSafeAreaInsets` из `react-native-safe-area-context`; в `packages/ui` для них допустима тонкая обёртка без API, env и текстов (уточнение AD-2…).» И в конце раздела «Точки перехода» — нормативный абзац **«Реализация раскладки»**: сегодня `useWindowDimensions` + `cardGrid`, брейкпоинты темы не используются; цель — Tamagui `media`; перевод поэтапный, по одному экрану; `media` не знает safe-area, ширины меню и правой колонки, поэтому `cardGrid` остаётся источником числа колонок до общей обёртки области контента; первыми — экраны без меню и правой колонки (анонимные, «Настройки», загрузка и ошибки).

**Влияние на код:** новый компонент-обёртка в `packages/ui` (peer `react-native-safe-area-context`), 10 экранов переводятся с ручного `SafeAreaView`; `cardGrid` не удаляется.

**Риск:** средний (AD-2 меняется — «только Tamagui и React» получает одно узкое исключение); у `media` — риск, что CSS-медиазапрос не совпадёт с императивной математикой на границах 600/1024/1280 px, поэтому поэтапно и с проверкой в браузере на 360/390/412/577/600/640/1024/1279/1280/1440.

#### 4.1.7 Синхронизация с уже принятым кодом

| Что | Было | Стало |
|---|---|---|
| Тост | «`max(4 с, 1 с + 60 мс × символ)`» | «`max(3000 мс, 60 мс × символ)`» + fade (см. 4.1.3) |
| Порядок кнопок формы правки | не описан | в строке **Форма**: «слева «Удалить желание» (destructive), справа «Отмена» и «Сохранить»; деструктивное первым — осознанное исключение из правила «деструктивные пункты последними» (оно про меню ⋯ и строку человека); на узком экране пара переносится под удаление целиком» |
| Заголовок вишлиста | «Кнопки владельца … в строке над сеткой справа» | «… справа, заголовок экрана — в той же строке слева; если не помещаются — группа кнопок переносится под заголовок целиком, жёсткой привязки к брейкпоинту нет» |
| Лимиты полей W5b | не описаны | в строке **Форма**: название 120, описание 2000, ссылка 2048, свой тег 30 (единственный счётчик «N из 30»); `maxLength` не ставится — он считает UTF-16 и режет эмодзи, превышение — ошибка при отправке |
| Toggle пароля (W9) | «состояние pressed» | «`aria-pressed` в браузере и `role="button"` + `accessibilityState.checked` на телефоне» |
| 413 `PAYLOAD_TOO_LARGE` | не описан | в EXPERIENCE (§4.2), в AD-12 (§4.3) |

### 4.2 `EXPERIENCE.md`

Frontmatter: `updated: 2026-11-04` → `updated: 2026-11-10`.

| Место | Было | Стало |
|---|---|---|
| Foundation → «UI-система» | заканчивалось на «Behavioral delta здесь, visual delta в `DESIGN.md`.» | + «Visual-каталог компонентов — Storybook (web, react-native-web + Vite) как dev-зависимость: только разработка, в прод-бандлы не входит; `/ui-check` остаётся проверкой серверного рендера Next и каталогом не считается (DECISION 2026-11-10, Story 1.10).» |
| State Patterns | строки про 413 не было | + «Слишком большой запрос \| Любая мутация `api/v1` (413) \| Тело больше 32 КиБ (32768 байт) сервер отклоняет до разбора: конверт AD-12 с `code: VALIDATION` и `reason: PAYLOAD_TOO_LARGE`, без `field`. Клиент показывает `common.errors.reason.PAYLOAD_TOO_LARGE` — «Слишком большой запрос. Сократите текст и попробуйте ещё раз.» — ошибкой формы, а если формы нет, toast…» |
| Interaction Primitives | после «Копирование ссылки» сразу «Удаление желания» | + «**Долгое действие** (DECISION 2026-11-10): пока идёт запрос, кнопка отправки — `busy`: `aria-busy`, нажатие и повторная отправка заблокированы, в кнопке индикатор ожидания (спиннер 16 px; при «уменьшить движение» — статичный). Видимый текст кнопки не подменяется, кроме существующих пар каталога «Сохранить / Сохраняем…» и «Удалить / Удаляем…». Ошибка возвращает кнопку в обычное состояние и показывает ошибку формы; фокус не теряется.» |
| Accessibility Floor → навигация | один пункт про `nav`/`aria-current` | + пункт: фокус виден на всём интерактивном, включая текстовые ссылки; в браузере только `:focus-visible`, на телефоне — `focus` (внешняя клавиатура и TalkBack/VoiceOver), кольцо не отключается |
| Accessibility Floor → переключатели | только `switch` в confirm брони | + пункт про «Показать пароль»: имя не меняется, состояние — `aria-pressed` / `accessibilityState.checked`, дублируется иконкой Eye/EyeOff |
| Responsive & Platform, абзац про safe area | «Safe area — для вкладок, прилипшей «Куплю сам» и шторок…» | + «Экраны берут `SafeAreaView` / `useSafeAreaInsets` из `react-native-safe-area-context`; в `packages/ui` для такой обёртки допустим тонкий компонент без API, env и текстов (уточнение AD-2…), вложенных `SafeAreaView` не ставится.» |
| Concern Coverage → Motion | «Короткий fade Sheet/Dialog; без confetti при брони» | «Сдвиг и fade шторки ≤ 200 мс, fade диалога и toast, смена цвета на hover/press; все переходы гейтятся «уменьшить движение» (медиа-ключ `reduce`), под ним — без сдвига, только fade. Без confetti при брони» |

### 4.3 `ARCHITECTURE-SPINE.md`

Frontmatter: `updated: 2026-10-29` → `updated: 2026-11-10`.

| Место | Было | Стало |
|---|---|---|
| **AD-2** Rule, после основного текста | заканчивалось на «По API Tamagui v3 сверяться с `tamagui.dev/llms.txt` и `*.manifest.ts` компонентов.» | + **«Уточнения (2026-11-10, `sprint-change-proposal-2026-11-10-ui-polish.md`).»** 1) **Safe area:** тонкая обёртка над `SafeAreaView`/`useSafeAreaInsets` в `packages/ui` **допустима** — единственное исключение из «только Tamagui и React», потому что `react-native-safe-area-context` уже peer `@tamagui/sheet`, а обёртка без API/env/данных/текстов; вложенных обёрток не ставится. 2) **Каталог компонентов:** visual-каталог — Storybook для web (`@storybook/react-native-web-vite`, react-native-web + Vite, Story 1.10) как dev-зависимость; сторис в `packages/ui/src/**/*.stories.tsx`, конфиг в корне (`.storybook/`), в `src/index.ts` и экраны не импортируются, в прод-бандлы не попадают, `storybook-static/` в git не кладётся; `/ui-check` остаётся dev-проверкой серверного рендера Next и каталогом не считается; on-device Storybook в R1 не вводится |
| **AD-12** Rule, после абзаца про gift card | не было | + **«Размер тела запроса (2026-11-10).»** Мутация с телом > 32 КиБ (32768 байт) отклоняется до `JSON.parse`: HTTP 413 и конверт `{ ok: false, code: "VALIDATION", message, reason: "PAYLOAD_TOO_LARGE" }`, без `field`; закрытый `ErrorCode` не расширяется — номер ответа несёт `reason`; `Content-Length` — только ранний отказ, поток читается с бюджетом и отменяется при превышении; клиент показывает `common.errors.reason.PAYLOAD_TOO_LARGE` |
| **AD-28** Rule, после абзаца про явное закрепление | не было | + «Dev-инструменты (Storybook и аддоны, `vite`) версию React и Tamagui не меняют: после любой установки проверка копий (`scripts/check-boundaries.mjs`) обязана оставаться зелёной, а вложенные `react`, `react-dom`, `tamagui`, `@tamagui/*` из dev-зависимостей недопустимы так же, как из рантайма (2026-11-10, Story 1.10)» |
| **Stack** | строки про Storybook не было; Tamagui — 3.1.10 | + `| Storybook (storybook, @storybook/react-native-web-vite) — dev-only, visual-каталог packages/ui (Story 1.10) | 10.6.7 (framework требует storybook ^10.6.7, vite ^5…^8; в репозитории vite 8.3.5 транзитивно через vitest) |`. **Tamagui остаётся 3.1.10.** Примечание под таблицей: проверено npm view 2026-11-10 |
| **Structural Seed** | `ui/` без сторис | + `src/*.stories.tsx # visual-каталог, dev-only: не импортируется приложениями (Story 1.10)` и `.storybook/ # конфиг Storybook (web, RNW + Vite): dev-зависимость, AD-2` |

Версия Storybook проверена по npm 2026-11-10: `storybook` и `@storybook/react-native-web-vite` — **10.6.7** (W7 §6.2 видел 10.6.6 днём раньше; 10.6.7 опубликован 2026-11-09/10); `vite` в репозитории — 8.3.5 (в registry 8.3.7). Peer-требования framework: `vite ^5||^6||^7||^8`, `react ^16.8||17||18||19`, `react-dom ^16.8||…||19`, `react-native >=0.74.5`, `react-native-web ^0.19.12||^0.20||^0.21`, `storybook ^10.6.7` — все выполнены (React 19.3.0, RN 0.88.0, RNW 0.21.4). `@storybook/react` и `@storybook/builder-vite` — **зависимости** framework, отдельно ставить не нужно.

### 4.4 `epics.md`

| Где | Было | Стало |
|---|---|---|
| Epic 1, вводный абзац | «… Story 1.9 (D-47) добавлена, когда Epic 2 и 3 уже начаты…» | + «Story 1.10 (visual-каталог Storybook) добавлена 2026-11-10 и идёт сразу после Story 1.9, до микрозадач полировки UI; продукт она не меняет.» |
| ARCH-R1 | «… версии из Stack spine» | + «visual-каталог компонентов — Storybook для web как dev-зависимость (Story 1.10); версии из Stack spine» |
| **Story 1.10** | — | Новая история: «Каталог компонентов `packages/ui` в Storybook (web)», без FR, `As a разработчик и дизайнер…`, 11 AC: dev-зависимость и точные версии; `npm run storybook`, stories в `packages/ui/src/**/*.stories.tsx`, конфиг в `.storybook/`; провайдер и шрифты каталога; покрытие всех компонентов и состояний; строки-литералы (пакет без переводов); нет влияния на прод-бандлы, `storybook-static/` в `.gitignore`; нет вторых копий React/Tamagui, гейты зелёные, сторис проходят eslint; `/ui-check` — проверка SSR, не каталог; `AGENTS.md`; CI-сборка каталога по желанию |

Микрозадачи W12.x в `epics.md` **не добавляются**: это исправления уже сделанных историй и долгов без нового объёма, по конвенции W9 (микрозадача без истории, спека `spec-*.md` + отчёт).

### 4.5 `sprint-status.yaml`

- `last_updated: '2026-11-07'` → `'2026-11-10'`.
- Добавлен ключ: `1-10-каталог-компонентов-packages-ui-в-storybook: backlog # без FR: dev-only каталог, после 1.9; sprint change proposal 2026-11-10 (W11)`.
- Существующие ключи и номера не менялись; `epic-1` остаётся `in-progress`.

### 4.6 `AGENTS.md` — вне этого коммита

Правило про Storybook (где живут stories, как запускать, «dev-only») и уточнение AD-2 про safe-area относятся к `AGENTS.md` в корне репозитория. Коммит этого шага — только `_bmad-output/` (ограничение задачи), поэтому `AGENTS.md` обновляется в W11 вместе с установкой; в Story 1.10 это AC.

## 5. Одобрение

**Дословно:** `approved by Sergey, relayed by Evgeniy 2026-11-10 (t305u)`.

| Пункт | Статус | Применено в документах |
|---|---|---|
| 1. Hover-токены `primary-hover`, `accent-hover`, `destructive-hover` | approved | да (текст DESIGN; токены — W12.5) |
| 2. Reduced motion: правило + медиа-ключ `reduce` | approved | да |
| 3. Motion: BottomSheet ≤ 200 мс, Dialog/Toast, пресеты | approved | да |
| 4. Кольцо фокуса для LinkText/NavLink и на телефоне | approved | да |
| 5. Choice 0.4, видимая ошибка TagChip, спиннер busy | approved | да |
| 6. SafeAreaView в `packages/ui` + поэтапный переход на `media` | approved | да |
| 7. Storybook (web, RNW + Vite) как официальный каталог | approved | да (Story 1.10, AD-2, Stack); установка — W11 |
| 8. Синхронизация документов с W2/W4/W5b/W6/W9 | approved | да |
| 9. Апгрейд Tamagui 3.1.10 → 3.3.1 | **proposed** | **нет** |

Других одобрений и деталей разговора нет; решение по пункту 9 не принималось.

**Гейты после правок документов** (2026-11-10, ветка `evivanchikov/wishmoon-ui-config`):

| Команда | Exit | Числа |
|---|---|---|
| `npx vitest run src/tokens.test.ts` в `packages/ui` | **0** | 1 файл, 7 тестов — зелёные (frontmatter ↔ `tokens.ts` не разошлись) |
| `npm run typecheck` (корень, все workspace) | **0** | ошибок нет; Prisma Client 7.10.0 и route types сгенерированы |
| `npm run lint` (4 workspace + `check-boundaries.mjs`) | **0** | 0 ошибок; дублей и запрещённых импортов нет |
| `npm test` (корень, `scripts/run-suite.mjs`) | **0** | mobile 59/846, web 68/740, contracts 9/210, ui 25/125, `node --test` 13/13 |
| `npm test -w @gift-list/mobile` (уточнение чисел) | **0** | 59 файлов, 846 тестов, 49.33 с |

## 6. План реализации

Порядок обязателен: **сначала W11 (каталог), потом W12.x.** Каждая микрозадача — один локальный коммит (Conventional Commits), свои тесты, проверка в Storybook; где проверки вживую нет — это прямо записано.

### 6.1 W11 — Storybook (web, RNW + Vite)

| Что | Детали |
|---|---|
| Зависимости | `storybook@10.6.7`, `@storybook/react-native-web-vite@10.6.7` — dev в корне; `@storybook/react@10.6.7` — dev в `packages/ui` (типы сторис). `vite` отдельно **не** ставить: 8.3.5 уже в дереве через vitest и удовлетворяет peer `^8`; если npm положит вторую копию — закрепить `vite` 8.3.5 в корне и проверить `check-boundaries` |
| Конфиг | `.storybook/main.ts`: `framework: { name: "@storybook/react-native-web-vite" }`, `stories: ["../packages/ui/src/**/*.stories.tsx"]`; `.storybook/preview.tsx`: декоратор `GiftListProvider` с `createGiftListConfig({ body: "Manrope", heading: "Lora" })`, фон `#F4F1EA`, `parameters.a11y`; `.storybook/preview-head.html`: `<link>` на Google Fonts (Lora 600, Manrope 400/500/600) — без новых зависимостей; офлайн-фолбэк — системные шрифты с пометкой, `@fontsource/*` — только если это станет мешать |
| Где stories | `packages/ui/src/**/*.stories.tsx` — рядом с компонентами: их видит `tsc` пакета, eslint пакета и `check-boundaries` (запрет `"tamagui"` целиком и `process.env` действует автоматически). `src/index.ts` их не экспортирует, приложения не импортируют; `vitest` пакета берёт только `src/**/*.test.*` — сторис в тестах не участвуют |
| Скрипты | корень: `"storybook": "storybook dev -p 6006 -c .storybook"`, `"storybook:build": "storybook build -c .storybook"` |
| Покрытие | Button (5 вариантов × hover/press/disabled/busy), Pressable, TextField/PasswordField (обычное, фокус, ошибка, пароль открыт/закрыт), Choice/ChoiceList (выбран/не выбран/disabled/ошибка), TagChip (picker/card/custom, выбран, ошибка), VisibilityChip, StatusPill, RelationshipChip, WishCard (открыт/забронирован/получен, с фото/без), Dialog, BottomSheet, Toast (info/error/с действием), EmptyState, Skeleton/LoadingCards, PageFooter, ScrollView |
| Правила кода | сторис — именованные функции с `displayName` (eslint пакета), тексты — литералы каталога; никакого `process.env` |
| Прод | `.gitignore`: `storybook-static/`; `next build`/Expo-web/gzip-бюджет не меняются (сторис не импортируются); `/ui-check` остаётся и сужается до SSR-проверки |
| Проверки | `npm run storybook` открывается; `npm run storybook:build` собирается; `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `node scripts/check-boundaries.mjs`; `git diff package-lock.json` — без вторых копий `react`/`react-dom`/`tamagui`/`@tamagui/*`; `AGENTS.md` |
| Оценка | 0,5–1,5 дня; риск средний (lock, дубли, шрифты) |
| CI | по желанию: шаг `npx storybook build` (артефакт не публикуется); если не сделан — `deferred-work.md` |

### 6.2 W12.x — микрозадачи

Обозначения: **S** ≤ 2 ч, **M** 2–6 ч. Тесты — focused + полные `npm test -w @gift-list/ui|mobile` (и `web`, если тронут).

| # | Что | Файлы | Критерии приёмки | Тесты | Оценка | Зависимость |
|---|-----|-------|------------------|-------|--------|-------------|
| **W12.1** | Утечка `accessibilityHint` в DOM у `TextField`, `TagChip`, `Choice`, `ChoiceList` (ср. `cefa8af`, `choice-web-a11y-hint-report.md`) | `packages/ui/src/text-field.tsx:191`, `tag-chip.tsx:170,197,224`, `choice.tsx:48,147`; новая пара `a11y-hint.ts` / `.native.ts` | на вебе в DOM нет атрибута `accessibilityhint` и предупреждений React; на телефоне `accessibilityHint` остаётся; поведение диктора на вебе — `aria-description`/`aria-describedby` по месту | `text-field.test.tsx`, `tag-chip.test.tsx`, `choice.test.tsx`: рендер → в атрибутах нет `accessibility*`, `console.error` не вызван; mobile-тест на пропсы через пару файлов | S | нет |
| **W12.2** | `Choice` disabled 0.4 вместо 0.6 | `packages/ui/src/choice.tsx:72` | disabled-строка и чип — та же непрозрачность, что у `Pressable` (0.4), `aria-disabled` сохранён | `choice.test.tsx`: `getComputedStyle`/инлайн-стиль opacity = 0.4 для `row` и `chip` | S | нет |
| **W12.3** | Видимая ошибка `TagChip` | `packages/ui/src/tag-chip.tsx:159,233` | рамка `$destructive` у чипа с `error`, приоритет над `custom`/`selected`; `aria-invalid` остаётся | `tag-chip.test.tsx`: 3 варианта × error, `getComputedStyle(borderColor)` | S | нет |
| **W12.4** | Кольцо фокуса и hover у `LinkText`/`NavLink` | `packages/ui/src/text.tsx:59-67`, `apps/mobile/src/ui/nav-link.tsx` | у ссылки кольцо `$ring` 2 px/offset 2 только `:focus-visible`; hover-фон `$background`; `press:` 0.9 | `text.test.tsx` (новый): классы outline на `<a>`; mobile-тест `NavLink` не сломан | S | нет |
| **W12.5** | Hover-токены и hover кнопок | frontmatter `DESIGN.md` (colors +3, комментарий убрать), `packages/ui/src/tokens.ts`, `button.tsx:15-44` | `primary`/`reserve`/`destructive` темнеют на 8% по токенам; `secondary` — граница `$foreground`, `ghost` — `$muted`; описано в DESIGN | `tokens.test.ts` (frontmatter == код), `button.test.tsx`: hover-клаузула в пропсах | **M** | W11 (визуальная проверка) — не блокер |
| **W12.6** | Медиа-ключ `reduce` и гейт | `packages/ui/src/config.ts:129-133`, новый `use-reduce.ts` | `config.media.reduce` = `(prefers-reduced-motion: reduce)`; компоненты читают `useMedia().reduce` | новый тест конфига: сериализация медиа; тест хука с моком `matchMedia` | **M** | нет (до W12.7/W12.8) |
| **W12.7** | BottomSheet ≤ 200 мс + motion Dialog и Toast | `bottom-sheet.tsx:85`, `dialog.tsx`, `toast.tsx` | шторка `quick` 160 мс на вебе и телефоне; диалог и toast — fade; при `reduce` — без сдвига, только fade; возврат фокуса не ломается | `bottom-sheet.test.tsx` (длительность/закрытие), `dialog.test.tsx` (fade-пропсы), `toast.test.tsx`; ручная проверка в браузере и на устройстве | **M** | W12.6 |
| **W12.8** | Спиннер у busy-кнопки | `packages/ui/src/button.tsx:51-53,128-150`, новый `spinner.tsx` (имя + `displayName`) | индикатор 16 px `currentColor` слева от текста, ширина не прыгает, `aria-busy`, повторное нажатие заблокировано; при `reduce` — статичный | `button.test.tsx`: спиннер есть только в `busy`, нет в `inactive`; `displayName` | S–**M** | W12.6 (для reduce) |
| **W12.9** | Кольцо фокуса на телефоне | `pressable.tsx:6-11` → пара `focus-ring.ts` / `.native.ts`; `text.tsx`, `tag-chip.tsx` наследуют | на вебе кольцо только `:focus-visible`; на телефоне — по `focus` (внешняя клавиатура/TalkBack); на вебе клик мышью кольца не даёт | unit: выбор пропсов по платформе; DOM: на вебе нет `:focus`-кольца | **M** | W12.4 (для ссылок) |
| **W12.10** | Общий `Pressable`: роль на телефоне | `packages/ui/src/pressable.tsx:13-25` | на телефоне `accessibilityRole="button"` вместо форсированного `role`, чтобы стала возможна семантика `togglebutton`; на вебе DOM не меняется (остаётся `<div role="button">`/реальный `<button>` у `Button`) | DOM-тесты всех pressable-компонентов без изменений; unit на нативную ветку | **M** | W9-последствие; после W12.1 |
| **W12.11** | SafeArea-обёртка в `packages/ui` | новый `safe-area.tsx` (+ `react-native-safe-area-context` peer/optional dev), `Screen`/`PageContainer`; 10 экранов (`index.tsx:425`, `settings.tsx:200`, `gifts/new.tsx:219`, `gifts/[id]/edit.tsx:440`, `u/[nick].tsx:412`, `wishlist/[token].tsx:178`, `src/ui/*-screen.tsx`) | обёртка без вложенности, insets те же, вид не меняется; AD-2-исключение соблюдено (без API/env/текстов) | тесты экранов (моки `SafeAreaView` уже есть) + ручная проверка на устройстве/эмуляторе | **M** | после W12.9 (оба трогают `packages/ui`) |
| **W12.12** | `media` вместо `useWindowDimensions` поэкранно | `apps/mobile/src/ui/card-grid.ts` остаётся; экраны по одному | экран не читает ширину окна для раскладки, использует `$medium`/`$expanded`/`$wide`; число колонок сетки по-прежнему из `cardGrid` | тесты экрана (ширины 360/600/1024/1280), регресс в браузере и на телефоне | **M** на экран (L на весь хвост) | W12.11; по одному экрану, первыми — анонимные, настройки, загрузка/ошибки |

**Что проверяется вручную всегда:** реальный hover и `:focus-visible` в браузере, длительность и вид шторки, fade диалога/тоста, `prefers-reduced-motion` (включённый в ОС и в браузере), кольцо фокуса с внешней клавиатурой на Android/iOS, TalkBack/VoiceOver. Unit/happy-dom этого не заменяет.

## 7. Задачи реализации без изменения решений

Это дефекты и ограничения, для которых документы уже верны; решения не меняются, нужен код (могут идти в тех же W12.x):

1. **Утечка `accessibilityHint` в DOM** у `TextField` (`text-field.tsx:191`), `TagChip` (`tag-chip.tsx:170,197,224`) и `Choice`/`ChoiceList` (`choice.tsx:48,147`): на вебе React ругается «does not recognize the accessibilityHint prop on a DOM element» (видно в `W8-report.md` §1, stderr прогона mobile). Тип дефекта и способ — как в `cefa8af` (`choice-web-a11y-hint-report.md`): платформенная пара файлов. → **W12.1**.
2. **Общий `Pressable` форсирует `role="button"`** (`pressable.tsx:15`), поэтому корректная комбинация `togglebutton` + `accessibilityState.checked` недостижима: `role` в RN имеет приоритет, `undefined` не снимает нижний слой (`mergeProps.ts:5-13`), а `Role` на Android не знает `togglebutton` (см. W9-report, разбор). Сейчас toggle пароля объявляет состояние через `button` + `checked` — рабочая, но не идеальная семантика. → **W12.10**.
3. **`/ui-check` — оставить, сузить.** Рекомендация: оставить как dev-проверку серверного рендера Tamagui в Next (`useServerInsertedHTML`, CSS в HTML, Dialog в Next) — это единственное место, где SSR проверяется вручную, и на нём стоит тест (`ui-check.test.tsx`). Каталогом компонентов он больше не считается: состояния показывает Storybook. Примеры в нём не дублируют сторис, а проверяют то, что вне Next не проверить. → AC Story 1.10.

## 8. Передача

**Масштаб: Moderate.** Решения внутри согласованного MVP, одна новая dev-история, остальное — микрозадачи к уже сделанным историям.

| Кто | Что |
|---|---|
| Этот прогон (UX + архитектура + PM) | Правки `DESIGN.md`, `EXPERIENCE.md`, `ARCHITECTURE-SPINE.md`, `epics.md`, `sprint-status.yaml` — внесены; этот файл |
| Разработчик (`bmad-build`) | W11 (Story 1.10) → W12.1…W12.12; каждая — отдельный коммит; `deferred-work.md` для непроверенного вживую |
| Linear | Завести `Story 1.10: Каталог компонентов packages/ui в Storybook (web)` (волна: до W12.x) и микрозадачи W12.1–W12.12 с «Без истории» в описании, ссылкой на `epics.md` (для W12.x — на этот файл), блокерами `W12.6 → W12.7/W12.8`, `W12.11 → W12.12` |
| Sergey | Одобрение получено для 1–8; решение по пункту 9 (Tamagui 3.3.1) и по W1b — отдельно |

**Критерии, что запись состоялась:**

- В `DESIGN.md` есть нормативные hover-значения с контрастом, правило `reduce`, движение (160/240, шторка ≤200, fade), кольцо на ссылках и на телефоне, блок состояний, safe area, реализация раскладки, формула тоста, лимиты, порядок кнопок, заголовок вишлиста, toggle пароля.
- В `EXPERIENCE.md` есть 413, busy, фокус и toggle в Accessibility Floor, safe area, Motion.
- В spine AD-2 разрешает safe-area обёртку и описывает Storybook; AD-12 описывает 413; AD-28 — dev-зависимости; Stack содержит Storybook 10.6.7, Tamagui остаётся 3.1.10.
- В `epics.md` есть Story 1.10, ARCH-R1 её упоминает; `sprint-status.yaml` содержит ключ `1-10-…` в `backlog`.
- `tokens.test.ts`, `typecheck`, `lint`, `test` зелёные (числа — §5).
- Кода, конфигов, `package.json` и lock этот прогон не менял.

## 9. Пункт 9 — апгрейд Tamagui 3.1.10 → 3.3.1 (`proposed`, не утверждён)

**Не применять.** Версия в репозитории — 3.1.10 (`packages/ui/package.json:20-31`, корневой `@tamagui/native`), в spine закреплено 3.1.10 (`ARCHITECTURE-SPINE.md:408`, Stack). Актуальная на 2026-11-10 — 3.3.1 (`npm view @tamagui/core time`: 3.2.0…3.2.4 — 03–07.11, 3.3.0/3.3.1 — 08.11). Ни Storybook 10.6.7, ни пункты 1–8 от 3.3.1 не зависят: все API, которые нужны (медиа-драйвер, `focus`/`focus-visible`, Sheet `transition`), есть в 3.1.10.

**Если понадобится:** отдельная задача по процессу `bmad-architecture` (смена Stack + AD-28-прогон), затем установка всех `@tamagui/*` и `tamagui` одной версией, `@tamagui/native` в корне, `npm dedupe`, `node scripts/check-boundaries.mjs`, полный `npm test`/`build` и ручная проверка Dialog/Sheet на Android. Оценка — M, риск средний (8 релизов за 8 дней — читать changelog 3.2.x/3.3.x до установки).

## 10. Открытые вопросы

1. **Карточки Linear** не заведены (в этом прогоне трекер не трогался): Story 1.10 и W12.1–W12.12 — см. §8.
2. **`AGENTS.md`** правится в W11 (вне коммита docs): правило Storybook + уточнение механизма safe area.
3. **Шрифты каталога:** выбран `<link>` на Google Fonts (ноль зависимостей, но нужен интернет); `@fontsource/*` — если офлайн-разработка станет нормой. Решается в W11.
4. **`vite` в зависимостях:** ставить явно только если npm положит вторую копию; проверка — `git diff package-lock.json` + `check-boundaries`.
5. **On-device Storybook** отложен (требует `metro.config.js`, babel reanimated, entry-point и обхода запрета `process.env`); натив по-прежнему проверяется вручную.
6. **Пункт 9 (Tamagui 3.3.1)** — ждёт решения Sergey.
7. **W1b (бренд WishMoon)** не тронут: отдельное предложение `sprint-change-proposal-2026-11-10-wishmoon-brand.md` в статусе `proposed`.
8. **Замечено, вне изменения:** в `epics.md` (Story 1.9, AC) остаётся бюджет «150 КБ» gzip, а CI (`scripts/measure-web-size.mjs`) с 2026-11-10 держит 163 840 байт (160 КиБ) — расхождение уже зафиксировано в `deferred-work.md`; правка эпиков — отдельным `bmad-correct-course`.
