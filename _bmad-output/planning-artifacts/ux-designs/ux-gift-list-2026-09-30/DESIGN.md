---
name: Gift List
description: "Вишлист с видимостью на каждом желании и бронью «Куплю сам». Одно приложение Expo (React Native + react-native-web) на Android, iOS и в браузере — раздел App; четыре серверные страницы Next.js (/l, /i, /unsubscribe, /admin) на shadcn/ui + Tailwind — раздел Next-страницы. Токены общие, только светлая тема. Пилот на русском, мультиязычность заложена (кириллица + латиница)."
status: final
created: 2026-09-30
updated: 2026-10-28
language: ru
workflow: bmad-ux
round: 1
palette: forest-paper
sources:
  - "{planning_artifacts}/prds/prd-gift-list-2026-09-30/prd.md"
  - "{planning_artifacts}/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md"
  - "{planning_artifacts}/epics/epics-gift-list-2026-09-30/epics.md"
  - "{planning_artifacts}/briefs/brief-gift-list-2026-09-29/brief.md"
colors:
  # Locked: вариант C «Forest Paper» (подтверждено Sergey 2026-09-30).
  # Одни и те же значения: константы темы в apps/mobile и CSS-переменные shadcn в apps/web (AD-2).
  primary: '#2F5D3A'
  primary-foreground: '#F7FAF7'
  accent: '#D4A017'
  accent-foreground: '#1E241F'
  background: '#F4F1EA'
  foreground: '#1E241F'
  surface: '#FFFFFF'
  muted: '#E8E4DA'
  muted-foreground: '#5C6358'
  border: '#D9D3C6'
  # UX-A14 (принято Sergey 2026-10-28). Граница полей ввода, переключателей и чекбоксов: 3.6:1 к белому (WCAG 1.4.11).
  border-strong: '#8F8673'
  ring: '#2F5D3A'
  # Кольцо фокуса на тёмных и цветных поверхностях (toast, toast-error): 14.0:1 к foreground, 5.8:1 к destructive.
  ring-inverse: '#F4F1EA'
  # Семантические статусы желания (не brand-chrome)
  status-open: '#2F5D3A'
  # UX-A14 (принято Sergey 2026-10-28). Было #9A7609 — 3.4:1 на #F5E6B8, не проходит AA для 12px. Стало 4.9:1.
  status-reserved: '#7A5E07'
  status-reserved-bg: '#F5E6B8'
  status-closed: '#5C6358'
  destructive: '#B42318'
  destructive-foreground: '#FFFFFF'
  scrim: '#1E241F'
typography:
  # D-46 (Sergey 2026-10-28): Lora 600 + Manrope 400, 500, 600 — оба с кириллицей и латиницей (Google Fonts, OFL;
  # подмножества latin, latin-ext, cyrillic, cyrillic-ext). Fraunces и DM Sans заменены: в них нет кириллицы.
  # В React Native lineHeight задаётся в px: fontSize × множитель, округлить до целого.
  display:
    fontFamily: 'Lora'
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: '-0.01em'
  display-sm:
    fontFamily: 'Lora'
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '0'
  heading:
    fontFamily: 'Manrope'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.3'
  body-strong:
    fontFamily: 'Manrope'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: 'Manrope'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  button:
    fontFamily: 'Manrope'
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1.2'
  label:
    fontFamily: 'Manrope'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  caption:
    fontFamily: 'Manrope'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.35'
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  # 4-кратная шкала; в RN — dp/pt, в браузере — CSS px.
  page-gutter: 16px
  page-gutter-lg: 24px
  section-gap: 32px
  card-padding: 16px
  grid-gap: 16px
  card-min: 280px
  max-content: 720px
  max-form: 560px
  max-wide: 1120px
  sidebar: 264px
  right-column: 300px
  tab-bar: 56px
  header: 56px
  touch-target: 44px
  control-height: 48px
  dialog-width: 480px
  detail-width: 640px
  column-gap: 24px
  avatar-sm: 28px
  avatar-md: 40px
  avatar-lg: 64px
  icon-nav: 24px
  icon-inline: 20px
  icon-small: 16px
  pill-height: 24px
  chip-height: 28px
  row-height: 56px
  photo-thumb: 72px
  # [ASSUMPTION: UX-A12] Точки перехода по ширине окна (не устройства).
  bp-medium: 600px
  bp-expanded: 1024px
  bp-wide: 1280px
components:
  # --- общее: приложение и Next-страницы ---
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
    typography: '{typography.button}'
  button-reserve:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
    typography: '{typography.button}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
  button-ghost:
    background: 'transparent'
    foreground: '{colors.primary}'
    radius: '{rounded.md}'
    min-height: '{spacing.touch-target}'
  gift-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
    hover-border: '{colors.primary}'
  status-pill-open:
    background: '{colors.muted}'
    foreground: '{colors.status-open}'
    radius: '{rounded.full}'
    typography: '{typography.caption}'
  status-pill-reserved:
    background: '{colors.status-reserved-bg}'
    foreground: '{colors.status-reserved}'
    radius: '{rounded.full}'
    typography: '{typography.caption}'
  status-pill-closed:
    background: '{colors.muted}'
    foreground: '{colors.status-closed}'
    radius: '{rounded.full}'
    typography: '{typography.caption}'
  visibility-chip-public:
    background: '{colors.surface}'
    foreground: '{colors.primary}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.sm}'
    icon: 'globe'
  visibility-chip-friends:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.sm}'
    icon: 'users'
  visibility-chip-secret:
    background: 'transparent'
    foreground: '{colors.muted-foreground}'
    border: '1px dashed {colors.border-strong}'
    radius: '{rounded.sm}'
    icon: 'lock'
  owner-action-label:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    border-left: '3px solid {colors.accent}'
    radius: '{rounded.md}'
    padding: '12px'
  reservation-phase:
    foreground: '{colors.status-reserved}'
    typography: '{typography.label}'
  input:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border-strong}'
    focus-border: '{colors.ring}'
    error-border: '{colors.destructive}'
    radius: '{rounded.sm}'
    min-height: '{spacing.control-height}'
  switch:
    track-on: '{colors.primary}'
    track-off: '{colors.border-strong}'
    thumb: '{colors.surface}'
  toast:
    background: '{colors.foreground}'
    foreground: '{colors.primary-foreground}'
    action-foreground: '{colors.background}'
    focus-ring: '{colors.ring-inverse}'
    radius: '{rounded.md}'
    max-width: '{spacing.dialog-width}'
  toast-error:
    background: '{colors.destructive}'
    foreground: '{colors.destructive-foreground}'
    focus-ring: '{colors.ring-inverse}'
    radius: '{rounded.md}'
  empty-state:
    title: '{typography.display-sm}'
    body: '{typography.body}'
    body-foreground: '{colors.muted-foreground}'
  badge-count:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.full}'
    typography: '{typography.caption}'
  tag-chip:
    background: '{colors.background}'
    foreground: '{colors.muted-foreground}'
    radius: '{rounded.sm}'
    typography: '{typography.caption}'
  list-row:
    background: '{colors.surface}'
    border-bottom: '1px solid {colors.border}'
    min-height: '{spacing.row-height}'
    padding: '8px {spacing.card-padding}'
    unread-indicator: '{colors.primary}'
  reservation-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
  wish-photo:
    background: '{colors.muted}'
    radius: '{rounded.md}'
    thumb-size: '{spacing.photo-thumb}'
  collection-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
  # --- приложение Expo ---
  tab-bar:
    background: '{colors.surface}'
    border-top: '1px solid {colors.border}'
    min-height: '{spacing.tab-bar}'
    active-foreground: '{colors.primary}'
    inactive-foreground: '{colors.muted-foreground}'
    active-indicator: '3px {colors.primary}, сверху'
    active-weight: '600'
  app-header:
    background: '{colors.background}'
    foreground: '{colors.foreground}'
    min-height: '{spacing.header}'
    title: '{typography.heading}'
  sidebar:
    background: '{colors.surface}'
    border-right: '1px solid {colors.border}'
    width: '{spacing.sidebar}'
    padding: '16px 12px'
  nav-item:
    foreground: '{colors.foreground}'
    radius: '{rounded.md}'
    padding: '10px 12px'
    min-height: '{spacing.touch-target}'
    hover-background: '{colors.background}'
    active-background: '{colors.muted}'
    active-foreground: '{colors.primary}'
    active-indicator: '3px {colors.primary}, слева'
    active-weight: '600'
  user-menu:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
  right-column-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
  install-hint:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '12px 16px'
  bottom-sheet:
    background: '{colors.surface}'
    radius: '{rounded.xl} {rounded.xl} 0 0'
    scrim: '{colors.scrim} at 40%'
  dialog:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    width: '{spacing.dialog-width}'
    scrim: '{colors.scrim} at 40%'
  # --- Next-страницы ---
  next-header:
    background: '{colors.background}'
    border-bottom: '1px solid {colors.border}'
    min-height: '{spacing.header}'
  next-panel:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '32px'
    max-width: '{spacing.dialog-width}'
---

# Gift List — Design Spine

> **[DECISION] Палитра C — Forest Paper** подтверждена Sergey (2026-09-30). Рабочее имя «Gift List» остаётся до финального бренда и домена (Q-2). Имя на экранах — переменная `BRAND_NAME` / `EXPO_PUBLIC_BRAND_NAME` (AD-24), в макетах — только плейсхолдер.
> **[DECISION] D-40 (2026-10-28).** Один клиент — приложение Expo на Android, iOS и в браузере; дизайн приложения один, с адаптивными раскладками (раздел **App**). Next.js отдаёт только `/l`, `/i`, `/unsubscribe`, `/admin` (раздел **Next-страницы**).
> [ASSUMPTION: UX-A8] Только светлая тема. **[DECISION] D-46:** пилот на русском, мультиязычность заложена — кириллица и латиница, слева направо (`EXPERIENCE.md` → Локализация).
> Spines главнее макетов. Ключевые экраны приложения (телефон и широкий браузер) — [`mockups/app-key-screens.html`](mockups/app-key-screens.html). `prototype/index.html` устарел (см. `EXPERIENCE.md` → Foundation).

## Brand & Style

Gift List — тихий координатор подарков для узкого круга: ясность статуса важнее праздничного шума. Визуальный тон — «домашний вишлист на бумаге»: forest green (`{colors.primary}`) для доверия и навигации; mustard gold (`{colors.accent}`) — только сигнал «занято / бронь», не декор. Фон `{colors.background}` — тёплый бумажный; карточки белые (`{colors.surface}`), чтобы список читался как записи на листе.

Один визуальный язык на всех поверхностях: приложение на телефоне, то же приложение в браузере и четыре Next-страницы. Приложение не копирует Material или iOS-стиль: системные только жесты, шторки, выбор даты и клавиатура. Next-страницы наследуют shadcn/ui и получают тот же brand-layer через CSS-переменные.

Избегать: фиолетовых градиентов, glow, emoji в chrome, многослойных теней, pill-кластеров на hero, terracotta как второго brand-цвета.

## Colors

- **Primary Forest (`{colors.primary}`)** — бренд и доверие. Primary-кнопки, активная навигация, ссылки, фокус (`{colors.ring}`), включённый переключатель.
- **Ring inverse (`{colors.ring-inverse}`)** — кольцо фокуса на тёмных и цветных поверхностях: toast и toast-error. Обычное `{colors.ring}` там даёт 2.1:1 и 1.2:1.
- **Reserve Mustard (`{colors.accent}`)** — только бронь: CTA «Куплю сам», кнопка подтверждения брони, полоса метки действия владельца. Не для hover, навигации, логотипа, пустых состояний.
- **Background (`{colors.background}`)** — тёплая бумага; фон всех экранов и шапки приложения.
- **Surface (`{colors.surface}`)** — белый: карточки, вкладки, боковое меню, шторки, диалоги.
- **Border / Border-strong.** `{colors.border}` — разделители и контур карточек (декоративный). `{colors.border-strong}` — контур того, с чем взаимодействуют: поля, переключатель в выкл., secondary-кнопки, чипы видимости (UX-A14, принято). На `{colors.muted}` и `{colors.status-reserved-bg}` не ставить (2.8:1 и 2.9:1): кнопки внутри OwnerActionLabel — на `{colors.surface}`.
- **Статусы:** `открыт` → `{colors.status-open}` на `{colors.muted}`; `забронирован` → `{colors.status-reserved}` на `{colors.status-reserved-bg}`; `закрыт` → `{colors.status-closed}` на `{colors.muted}` (приглушённо, не как ошибка).
- **Destructive (`{colors.destructive}`)** — удаление желания, блок, снятие чужой брони, «Выйти», «Удалить аккаунт», toast «Нет сети». Не для `закрыт`.
- **Scrim (`{colors.scrim}` 40%)** — подложка под шторкой, диалогом и выдвижным меню. Не опускать ниже 40%. Прочие прозрачности: pressed — затемнение 8%, disabled — 40%.

**Контраст (проверено 2026-10-28):** primary на paper 6.8:1, на белом 7.6:1; текст на accent 6.7:1; muted-foreground на paper 5.5:1, на muted 4.9:1; status-reserved на своём фоне 4.9:1; destructive на белом 6.6:1; primary-foreground на primary 7.3:1; status-open на muted 6.0:1; toast 15:1; ring-inverse к toast 14.0:1; border-strong к белому 3.6:1, к paper 3.2:1. `{colors.border}` (1.5:1) не несёт смысла сам по себе — только разделяет. Accent-заливка к paper 2.1:1 — допустимо, кнопку определяет текст (6.7:1). Полная таблица пар — `review-accessibility.md`. История выбора палитры — `.working/color-themes-1.html`.

## Typography

- **Display (`Lora`)** — редкий акцент: заголовок пустого состояния, имя владельца на вишлисте и профиле, приветствие на `/i`. Один display на экран. Не для body, кнопок, навигации.
- **UI (`Manrope`)** — всё остальное. `heading` — заголовок экрана в шапке и заголовки секций; `body-strong` — название желания в карточке; `button` — текст кнопок; `label` — подписи полей, пункты меню; `caption` — вспомогательный текст, pill, подписи вкладок.
- Цена — цифры lining tabular, код валюты после неразрывного пробела.
- Масштаб шрифта системы (Dynamic Type, «Размер шрифта» Android, zoom браузера) не отключается. Раскладка выдерживает 200%: строки переносятся, кнопки растут по высоте, текст не обрезается многоточием в действиях. Поэтому высоты в токенах — `min-height`, не фиксированные. Исключение одно: подписи нижних вкладок ограничены `maxFontSizeMultiplier = 1.5`; на iOS при долгом нажатии — Large Content Viewer. Проверка: 200% Android, AX3 iOS, zoom 200% и 400% в браузере.
- Логотип в боковом меню и шапках Next-страниц — `display-sm`.
- **Языки.** Шрифты покрывают кириллицу и латиницу, включая расширенные наборы (украинский, белорусский, польский, немецкий и т.п.). Подключать подмножества `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`; без системной подмены глифов. Перед добавлением нового языка — проверить его буквы в обоих шрифтах (например, казахские Ұ, Ү, Һ). Manrope шире DM Sans: подписи тестировать с самым длинным языком, а не с русским.

## Layout & Spacing

Шкала кратна 4. Gutter `{spacing.page-gutter}` на compact, `{spacing.page-gutter-lg}` от medium. Ритм секций `{spacing.section-gap}`. Формы и чтение — не шире `{spacing.max-form}` / `{spacing.max-content}`; сетка карточек — не шире `{spacing.max-wide}`. Раскладки по ширине окна — раздел **App → Точки перехода**.

## Elevation & Depth

Минимум. Карточки — border + белый fill, без теней. Тень одна, мягкая, только у плавающего: шторка, диалог, toast, меню пользователя. Hover на карточке — граница `{colors.primary}`, без подъёма.

## Shapes

`{rounded.sm}` — поля, чипы видимости; `{rounded.md}` — кнопки, пункты меню, toast; `{rounded.lg}` — карточки, диалоги, панели Next-страниц; `{rounded.xl}` — верхние углы шторки. `{rounded.full}` — только status pill и badge счётчика. Кнопки не делать pill.

## Components

Общие визуальные правила для приложения и Next-страниц. Как это собрано на React Native — раздел **App**; на shadcn — раздел **Next-страницы**.

| Компонент | Визуал | Когда |
|-----------|--------|-------|
| **Button primary** | `{components.button-primary}` | Сохранить, Войти, Принять, Скопировать ссылку |
| **Button reserve** | `{components.button-reserve}` | Только «Куплю сам» и «Подтвердить» в confirm брони |
| **Button secondary / ghost** | `{components.button-secondary}` / `{components.button-ghost}` | Второстепенное; «Отмена» — ghost |
| **Gift card** (в RN — WishCard) | `{components.gift-card}` | Необязательное фото-превью слева, название (`body-strong`, до 2 строк), опц. цена, status pill, теги, строка брони, у владельца — чип видимости и ⋯ |
| **Wish photo** | `{components.wish-photo}` | Превью `{spacing.photo-thumb}` × `{spacing.photo-thumb}` в карточке, крупно в детали. Нет фото — нет и места под него, без заглушки |
| **Status pill** | `{components.status-pill-open}` / `-reserved` / `-closed` | Всегда текстом: «Открыт» / «Забронирован» / «Получен» |
| **Visibility chip** | `{components.visibility-chip-public}` / `-friends` / `-secret`; иконка + текст | Только у владельца: «Всем» / «Друзьям» / «Секрет». Различаются иконкой и словом, не только цветом |
| **Owner action label** | `{components.owner-action-label}` | Внутри карточки владельца: «Ждёт вашего подтверждения», «Срок брони истёк» + до двух кнопок |
| **Tag chip** | `{components.tag-chip}` | Теги желания: «мечта», «нужно сейчас», «когда-нибудь», свой. Не нажимается в R1 |
| **Toast** (в т.ч. undo toast) | `{components.toast}`; ошибка — `{components.toast-error}` | Подтверждения, «Отменить», гонка брони, нет сети |
| **Empty state** | `{components.empty-state}`, один CTA или без него | Пустой вишлист, нет друзей, нет броней, нет уведомлений. Тексты — `EXPERIENCE.md` → Empty states |
| **List row** | `{components.list-row}` | Друзья, подписки, запросы, поиск, контакты, уведомления |
| **Reservation card** | `{components.reservation-card}` | «Мои брони» |
| **Collection card** | `{components.collection-card}` | «Подборки» |

## App

Приложение Expo: React Native на Android и iOS, react-native-web в браузере, одна кодовая база (AD-17). Токены выше — константы темы в `apps/mobile`, не общий пакет с `apps/web` (AD-2). Иконки — lucide (`lucide-react-native`): `{spacing.icon-nav}` в навигации (вкладки и боковое меню), `{spacing.icon-inline}` в карточках и кнопках, `{spacing.icon-small}` в pill, чипах и фазе брони *[ASSUMPTION: UX-A15]*.

Этот раздел — расширение спеки: платформенная реализация разделов Layout & Spacing и Components.

### Компоненты на React Native

Каждый интерактивный элемент — `Pressable` с `accessibilityRole` и `accessibilityLabel`, зона касания не меньше `{spacing.touch-target}`. Зона набирается `minHeight` / `minWidth` и прозрачным padding вокруг визуала, не `hitSlop`: в react-native-web он не расширяет зону для мыши и касания. Между соседними целями — не меньше 8. Состояния: pressed — затемнение фона на 8% (Android ripple допустим); disabled — 40% непрозрачности, `aria-disabled` / `accessibilityState.disabled`, элемент остаётся в порядке фокуса, пояснение рядом связано с ним (`aria-describedby`) и не бледнеет; focus (браузер, внешняя клавиатура) — кольцо 2 px `{colors.ring}` с отступом 2 px, на toast — `{colors.ring-inverse}`.

| Компонент | Анатомия | Размеры и состояния |
|-----------|----------|---------------------|
| **WishCard** (Gift card) | Если есть фото — слева превью `{spacing.photo-thumb}` (`object-fit: cover`, `{rounded.md}`), название, цена, pill и теги справа от него. «Куплю сам» и OwnerActionLabel — под фото на всю ширину карточки, как у карточки без фото. Сверху: название (`body-strong`, 2 строки), справа ⋯ (только владелец). Ниже: цена (`label`, `muted-foreground`), status pill, до трёх Tag chip в ряд (остальные — «+N»). Строка брони (`reservation-phase` или «Берёт {имя}», `label`). У владельца внизу слева — VisibilityChip; при `ownerAction` — OwnerActionLabel на всю ширину. **Структура:** карточка — контейнер без `accessible`; внутри три соседних элемента: (1) основная зона — ссылка на деталь (expo-router `<Link asChild>`, в браузере `<a href="/gifts/{id}">`), её подпись — фраза из «Доступность»; (2) VisibilityChip; (3) ⋯. На основной зоне — `accessibilityActions` «Изменить видимость» и «Меню» для ротора VoiceOver и действий TalkBack | Высота по содержимому; в сетке карточки одного ряда растягиваются до самой высокой. Hover (браузер) — `hover-border`. Закрытая — фон `{colors.surface}`, текст `muted-foreground`, pill «Получен»; в ⋯ у владельца — «Вернуть в открытые» (только в окне отмены), «Хочу ещё такой», «Удалить» |
| **StatusPill** | Текст `caption` в pill, без иконки | `min-height` `{spacing.pill-height}`, padding 0 10. Не нажимается |
| **VisibilityChip** | Иконка `{spacing.icon-small}` + текст `caption` | У владельца на карточке. У `открыт` — кнопка (`aria-haspopup="dialog"`, подпись «Видимость: всем. Изменить»), открывает выбор видимости (`radiogroup`, тот же список, что в форме); после сохранения фокус — обратно на чип. У `забронирован` и `закрыт` — не нажимается, только показывает значение (Story 2.3). `min-height` `{spacing.chip-height}` визуально, зона касания 44 за счёт padding |
| **ReserveButton «Куплю сам»** | `{components.button-reserve}`, на всю ширину в детали | На compact в детали — прилипает к низу над safe area. При `забронирован` / `закрыт` / «Можно дарить снова» кнопки нет, на её месте строка-пояснение `label` («Уже забронирован», «Уже подарено», «Можно дарить без брони»); фокус после брони переходит на эту строку |
| **ReserveConfirm** | Заголовок `heading` «Забронировать «{название}»?» · поле даты «Подарю до» · Switch «Показать владельцу, что это я» (выкл.) · Switch «Показать другим, кто берёт» (вкл.) · `caption`-подсказка про «Купил» · кнопки «Подтвердить» (reserve) и «Отмена» (ghost) | Compact — BottomSheet, кнопки во всю ширину, «Подтвердить» сверху. Medium+ — Dialog `{spacing.dialog-width}`, кнопки справа в ряд: «Отмена», «Подтвердить». Если деталь уже открыта диалогом (expanded+), confirm — шаг в том же диалоге, а не второй слой. Строки Switch — вся строка нажимается, `min-height` `{spacing.row-height}` |
| **ReservationPhase** | Иконка `{spacing.icon-small}` + текст `label` `{colors.status-reserved}` | Подписи по фазе и роли — одна таблица в `EXPERIENCE.md` → State Patterns → «Подписи брони». Флаг «Купил» у держателя — отдельный чип «Куплено» рядом. Срок в прошлом — иконка часов, без красного |
| **OwnerActionLabel** | Полоса accent слева, текст `label`, ниже 1–2 кнопки secondary `min-height` 44 на `{colors.surface}` | «Ждёт вашего подтверждения» → «Получил» / «Не получал»; «Срок брони истёк» → «Получил» / «Не получал, оставить бронь» / «Снять бронь» (третье — в ⋯) |
| **Toast** | Текст `label` + необязательное действие (`button`, `action-foreground`, подчёркнуто, зона 44×44); кольцо фокуса `ring-inverse` | Один постоянно смонтированный ToastHost (см. Доступность). Compact: снизу, над вкладками и над прилипшей кнопкой, отступ 8, ширина экрана минус gutter. Medium+: снизу по центру области контента, ширина до `{spacing.dialog-width}`. Длительность: обычный — `max(4 с, 1 с + 60 мс × символ)`; undo toast «Отменить» — 10 с. Любой toast на паузе при hover и фокусе; при включённом дикторе toast с действием не скрывается сам. «Нет сети» не скрывается сам, пока его не закрыли или не повторили действие. Один toast за раз, новый заменяет старый |
| **EmptyState** | Заголовок `display-sm`, текст `body` `muted-foreground`, не больше одного CTA primary | По центру области контента, ширина до `{spacing.max-form}`. Иллюстраций в R1 нет |
| **Форма** | Label (`label`) над полем · поле `{components.input}` · подсказка или ошибка `caption` под полем | `min-height` поля 48; фокус — граница `ring` 2 px; ошибка — граница и текст `destructive` + иконка. Обязательные поля не помечаются; необязательные — «(необязательно)» в подписи. Ошибка и подсказка связаны с полем: в браузере `aria-invalid` + `aria-describedby`, на телефоне — в `accessibilityHint` (на iOS ещё `accessibilityValue`). Кнопка отправки внизу формы; на compact — прилипает к низу над клавиатурой. Валюта — нативный `<select>` в браузере, шторка с радио на телефоне, пять кодов. Видимость — три строки-радио с иконкой и пояснением, по умолчанию «Всем». У `забронирован` и `закрыт` видимость и «Один раз / Можно дарить снова» не меняются: над ними `caption` «Нельзя менять, пока желание забронировано» (или «…получено») |
| **Поле даты** | Телефон — кнопка `accessibilityRole="button"` с подписью «Подарю до, 4 ноября 2026» и hint «Выбрать дату» → системный выбор (iOS — `display="inline"` в шторке). Браузер — `<input type="date">` с `min` и `max` | Под полем `caption` «Не позже {DD.MM}», связанный с полем. Дата вне диапазона — ошибка при отправке «Выберите дату не позже {DD.MM}» |
| **Поля входа** | Email и пароль; у пароля кнопка «Показать пароль» 44×44 (`accessibilityLabel`, состояние pressed) | Вставка не блокируется, CAPTCHA нет. Автозаполнение: email — web `type="email"` + `autocomplete="username"`, RN `autoComplete="email"`, `textContentType="username"`, `keyboardType="email-address"`; пароль при входе — `current-password` / `textContentType="password"`; при регистрации и сбросе — `new-password` / `newPassword`; имя — `name`; ник — `nickname`; телефон — `tel`; ДР — `bday-day` / `bday-month` / `bday-year`. iOS — `webcredentials:` в associated domains; Android — Digital Asset Links. Сброс — ссылкой из письма, без ручного кода |
| **Фото в форме** | Без фото — кнопка secondary «Добавить фото» с иконкой камеры → выбор «Сделать фото» / «Из галереи» (в браузере — выбор файла). С фото — превью 120×120 `{rounded.md}`, рядом «Заменить» и «Убрать» (ghost) | Пока фото ужимается и загружается — превью с индикатором и подписью «Загружаем фото…»; «Сохранить» ждёт загрузку. Ошибка — `caption` `destructive` под превью и «Повторить». Подпись для диктора: «Фото желания. Заменить» |
| **Фото в детали** | Сверху детали, на всю ширину, соотношение 4:3, `object-fit: contain` на `{colors.muted}`, `{rounded.lg}` | Нажатие — фото на весь экран (только просмотр, закрыть крестиком, Esc, «назад»). `accessibilityLabel` — «Фото: {название}» |
| **Tag picker** | В форме желания: ряд переключаемых чипов «мечта», «нужно сейчас», «когда-нибудь» + «Свой тег» → поле до 30 символов со счётчиком | Каждый чип — `checkbox` с состоянием; выбранный — заливка `muted`, граница `border-strong`, галочка. Свой тег добавляется чипом с крестиком «Убрать тег {имя}» |
| **Срок желания** | Поле даты «Убрать в архив после» (необязательно) в форме | `caption` «После этой даты желание уйдёт в архив». Не путать со Сроком брони |
| **Archive section** | У владельца, после «Получено (N)»: свёрнутая секция «Архив (N)» | Карточки как закрытые; в ⋯ — «Вернуть в вишлист» (форма с новой датой или без) и «Скопировать». Зрителям секции нет |
| **BottomSheet / Dialog** | Шторка: ручка 32×4 сверху (декоративная, не фокусируется), заголовок `heading`, видимая «Отмена» или «Закрыть» 44×44, содержимое, кнопки внизу. Диалог: заголовок, крестик «Закрыть», содержимое, кнопки справа | Шторка — compact; диалог — medium и шире. Одновременно не больше одного слоя: confirm и «Не сохранять изменения?» внутри диалога — шаг в том же слое (содержимое меняется, фокус на новый заголовок, «Отмена» и Esc возвращают прежний шаг) |
| **Badge** | `{components.badge-count}`, число до «99+» | На вкладке, пункте бокового меню, колокольчике. Число входит в подпись элемента («Друзья, 2 запроса») |
| **PersonRow** (строка человека) | `{components.list-row}`: Avatar `{spacing.avatar-md}` · имя `body-strong` + @ник `caption` `muted-foreground` · справа chip отношения (если есть) · ⋯ 44×44 | Одна строка во всех списках людей: Поиск, Друзья, Подписки, Мои подписчики, Найти знакомых. Chip и пункты ⋯ — по таблице «Отношение → статус и меню» в `EXPERIENCE.md`. Кнопок в строке нет, кроме «Принять» / «Отклонить» во вкладке «Запросы» (под именем на compact, справа от medium). Вся строка, кроме ⋯, — ссылка на профиль. Меню ⋯: на compact — шторка снизу с именем в заголовке, от medium — выпадающее меню `{components.user-menu}`; деструктивные пункты (`destructive`) — последними, после разделителя |
| **NotificationRow** | `{components.list-row}`: иконка события `{spacing.icon-inline}` · текст `body` (до 3 строк) · время `caption` · кнопки действий secondary ниже текста | Непрочитанная — точка `unread-indicator` 8 px слева и текст `body-strong`; подпись для диктора начинается с «Новое». Устаревший запрос — «Даритель уже ответил», без кнопок. Нажатие по строке — деталь желания или профиль |
| **ReservationCard** | `{components.reservation-card}`: название из снимка (`body-strong`) · «у @{ник владельца}» `caption` · Срок «до DD.MM» · ReservationPhase · чип «Куплено» · переключатели видимости свёрнуты в «Кто видит, что это я» | Действия: «Продлить до…», «Купил» (переключатель), «Подарил», «Снять бронь» (в ⋯). Без цены, тегов и остальных желаний (A-14, AD-7). Если доступа к вишлисту нет — без ссылки на деталь |
| **CollectionCard** | `{components.collection-card}`: необязательная картинка 16:9 `{rounded.md}` · название подборки `heading` · описание `body` 2 строки · число идей `caption` | Нажатие — подборка; у каждой идеи внутри — «Добавить в мой вишлист» (secondary), после — «Добавлено» (disabled) + toast |
| **Мелкие элементы** | Switch — трек 52×32, бегунок 28, вся строка нажимается. Avatar — круг `{spacing.avatar-sm}` / `-md` / `-lg`, инициалы на `muted`. Skeleton — блоки `muted` по форме карточки. Сегмент «Друзья · Подписки · Запросы» — текст `label`, выбранный — 600 и подчёркивание 2 px `primary`. OverflowMenu ⋯ — кнопка 44×44, меню `{components.user-menu}`. SearchField — поле с иконкой лупы и крестиком «Очистить». Chip «Куплено» и chip отношения («Друзья», «Зовёт в друзья», «Ожидает ответа», «Вы подписаны», «Подписан на вас», «Взаимная подписка», «Это вы») — как StatusPill: фон `muted`, текст `muted-foreground` (4.9:1); у «Зовёт в друзья» — текст `primary` 600, потому что это ждёт ответа. В списке, где отношение и так ясно («Друзья», «Я подписан»), chip не повторяется. Свёрнутая секция «Получено (N)» / «Уже подарено» / «Архив (N)» — заголовок-кнопка `heading` с шевроном, `aria-expanded` | Зона касания у всего нажимаемого — 44×44 |

### Навигация приложения

UX-A13 (принято Sergey 2026-10-28). Пять разделов и колокольчик. «Поиск» ищет среди всех пользователей, «Друзья» — только свой круг; поэтому поле в «Друзьях» подписано «Искать среди друзей».

| Раздел | Compact / medium | Expanded и шире |
|--------|------------------|-----------------|
| Мой вишлист | вкладка «Вишлист» | пункт бокового меню |
| Поиск — все пользователи | вкладка «Поиск»: поле «Имя или @ник» по всем пользователям приложения (FR-6, D-30) | пункт |
| Друзья (badge входящих) | вкладка «Друзья» — только свой круг: строка «Найти знакомых», сегмент «Друзья · Подписки · Запросы» (Story 4.3), поле «Искать среди друзей» | пункт |
| Мои брони | вкладка «Брони» | пункт |
| Профиль | вкладка «Профиль»: мой профиль, Подборки, Настройки, Написать автору, Выйти | карточка пользователя внизу меню → меню вверх; «Подборки» — отдельный пункт |
| Уведомления (badge) | колокольчик справа в шапке корневых экранов | пункт меню |

- **Шапка (compact/medium):** `{components.app-header}`. Заголовок экрана по правилу платформы: iOS — по центру, Android и браузер — слева. Назад — стрелка слева на вложенных экранах. На корневых экранах справа колокольчик.
- **Нижние вкладки:** `{components.tab-bar}` + safe area снизу; иконка `{spacing.icon-nav}` + подпись `caption`. Активная — полоса 3 px `primary` сверху, залитая иконка, подпись 600 и `primary`; остальные — `muted-foreground`. Выбранный раздел не передаётся одним цветом. Прячутся на экранах форм и в детали желания с прилипшей «Куплю сам».
- **Боковое меню (expanded+):** `{components.sidebar}`. Сверху логотип (`BRAND_NAME`, `display-sm`). Пункты `{components.nav-item}`: иконка `{spacing.icon-nav}` + текст `label`, badge справа. Секция «Недавние вишлисты» (заголовок `caption` прописными, 2–5 строк: Avatar `{spacing.avatar-sm}` + имя + @ник). Внизу — карточка пользователя (Avatar, имя, @ник) → `{components.user-menu}`: email, Мой профиль, Настройки, Написать автору, разделитель, Выйти (`destructive`). Активный пункт — фон `muted`, полоса 3 px `primary` слева, текст 600 и иконка `primary`.
- **Аноним** (вход, регистрация, сброс пароля): без вкладок и меню. Логотип сверху, форма по центру шириной до `{spacing.max-form}`, внизу ссылка «Написать автору».

### Точки перехода

*[ASSUMPTION: UX-A12]* Ширина окна, а не тип устройства: планшет в портрете попадает в medium, iPad в альбомной ориентации и браузер на ноутбуке — в expanded.

| Класс | Ширина окна | Где бывает | Раскладка |
|-------|-------------|------------|-----------|
| **compact** | < `{spacing.bp-medium}` | телефон; узкое окно браузера | Нижние вкладки, одна колонка, шторки снизу, «Куплю сам» прилипает к низу |
| **medium** | от `{spacing.bp-medium}` до < `{spacing.bp-expanded}` | планшет в портрете; телефон в альбомной; среднее окно | Нижние вкладки; сетка карточек; диалоги по центру; правой колонки нет |
| **expanded** | от `{spacing.bp-expanded}` до < `{spacing.bp-wide}` | планшет в альбомной; ноутбук | Боковое меню; сетка карточек; диалоги по центру |
| **wide** | ≥ `{spacing.bp-wide}` | монитор, ноутбук с большим окном | Боковое меню; в браузере — правая колонка `{spacing.right-column}` с подсказкой установить приложение, пока её не закрыли; сетка карточек |

Колонки карточек считаются от ширины области контента — это единственное место, где задано их число. Область контента = окно − боковое меню − правая колонка (если есть) − `{spacing.page-gutter-lg}` по краям − `{spacing.column-gap}` перед правой колонкой; не шире `{spacing.max-wide}`. В ней столько колонок шириной не меньше `{spacing.card-min}` с промежутком `{spacing.grid-gap}`, сколько помещается, но не больше трёх. Примеры: 600 → 1; 640 → 2; 1024 → 2; 1279 → 3; без правой колонки 1280 и 1440 → 3; с правой колонкой 1280 и 1440 → 2, от 1508 → 3.

Порядок карточек в DOM и для диктора — по строкам слева направо, как визуально; masonry и CSS `order` запрещены. Сетка — `role="list"`, карточка — `listitem`. Списки строк (друзья, брони, уведомления, поиск) остаются одной колонкой шириной до `{spacing.max-content}`.

### Широкий экран

От expanded приложение — не растянутый телефон:

- **Боковое меню вместо нижних вкладок.** Шапки с колокольчиком нет: заголовок экрана (`heading`) — над контентом, уведомления — пункт меню.
- **Сетка карточек.** «Мой вишлист», чужой вишлист, профиль и подборки показывают карточки сеткой (правило колонок выше). Кнопки владельца («Добавить желание», «Скопировать ссылку») — в строке над сеткой справа.
- **Правая колонка (wide, только браузер).** `{components.right-column-card}`, прокручивается вместе со страницей. В пилоте в ней одна карточка — подсказка «Установите приложение»; закрыли подсказку — колонки нет, сетка занимает место. В приложении на планшете колонки нет. Есть только на корневых экранах (Вишлист, Друзья, Поиск, Брони, Уведомления, чужой вишлист); на формах, в настройках и в детали её нет. Landmark `complementary`. «Ближайшие даты» отложены (UX-A16) — когда вернутся, встанут сюда первой карточкой.
- **Диалоги по центру.** Confirm брони, видимость, подтверждения, форма желания — Dialog `{spacing.dialog-width}` (форма — до `{spacing.max-form}`). Деталь желания — Dialog до `{spacing.detail-width}` поверх сетки, URL меняется (`/gifts/{id}`), «назад» браузера = Esc. Разметка: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = название. Открыт по прямой ссылке или после обновления — под ним вишлист владельца, фокус на заголовке; после закрытия фокус — на карточке этого желания, а если её нет — на `h1`.
- **«Куплю сам»** в детали — обычная кнопка внизу диалога, не прилипает.
- **Подсказка «Установите приложение»** (только браузер, UX-DR11): `{components.install-hint}` — иконка телефона, текст «Установите приложение: поиск друзей по контактам», ссылка «Google Play» (и «App Store» при `IOS_APP_PUBLISHED`), крестик. Место — одно правило для всех ширин: на wide — в правой колонке; на compact, medium и expanded — карточкой вверху «Найти знакомых» и вверху «Профиля» (на expanded — «Мой профиль»). Других мест нет. Крестик «Закрыть подсказку» 44×44; после закрытия фокус — на следующий элемент экрана, подсказка больше не показывается в этом браузере. В приложении на телефоне её нет.

### Мышь и клавиатура в браузере

- **Hover** (только при указателе, `@media (hover: hover)`): карточка — граница `primary`; пункт меню — фон `{colors.background}`; кнопка — затемнение 8%; ⋯ и чип видимости — курсор-указатель. Ничего не прячется за hover: все действия видны и на касании.
- **Видимый фокус:** кольцо `{colors.ring}` 2 px с отступом 2 px на всём интерактивном, только при навигации с клавиатуры (`:focus-visible`). Отступ — цвет фона под элементом, без него кольцо вокруг primary-кнопки не видно. На тёмных и цветных поверхностях (toast) — `{colors.ring-inverse}`. В Android/iOS с внешней клавиатурой — то же кольцо.
- **Фокус не перекрыт (2.4.11):** прокручиваемая область получает `scroll-padding-bottom` / `contentInset` = высота прилипших элементов (вкладки, «Куплю сам», кнопка формы, toast) + 8; элемент в фокусе докручивается в видимую зону (`scrollIntoView({block: 'nearest'})`). Если высота окна < 480 CSS px, шапка, «Куплю сам» и кнопка формы не прилипают и идут в потоке.
- **Порядок Tab:** ссылка «Перейти к содержимому» (первая, видна при фокусе; на всех ширинах и на Next-страницах) → боковое меню сверху вниз → заголовок и кнопки экрана → карточки слева направо, сверху вниз (внутри карточки: основная зона → чип видимости → ⋯) → правая колонка. На compact в браузере: «Перейти к содержимому» → шапка → контент → вкладки.
- **Клавиши:** Enter/Space — нажатие; Space — переключатель; стрелки — в меню, радио-группе и сегменте «Друзья · Подписки · Запросы»; Enter в форме — отправка, кроме многострочного поля.
- **Esc** закрывает верхний слой: меню, шторку, диалог, деталь; внутри диалога сначала возвращает прежний шаг. Фокус возвращается на элемент, который открыл слой, а если его уже нет — по правилу «Куда уходит фокус» в разделе Доступность. Черновик формы при Esc не теряется: если есть изменения — шаг «Не сохранять изменения?».
- **Фокус в слое:** при открытии диалога или шторки фокус на заголовке, Tab не выходит за пределы слоя.
- Своих сочетаний клавиш в R1 нет.

### Доступность

- **Браузер:** WCAG 2.2 AA для веб-сборки приложения и Next-страниц. Контраст — раздел Colors. Цель нажатия не меньше 24×24 по 2.5.8; у нас везде 44×44. Фокус не перекрыт — механизм в «Мышь и клавиатура».
- **Язык и заголовки страниц:** `<html lang>` = текущий язык (в пилоте `ru`) — в `app/+html.tsx` (expo-router) и `app/layout.tsx` (Next). `document.title` на каждом маршруте — «{Экран} — {BRAND_NAME}», у детали — «{название} — {BRAND_NAME}» (expo-router `Head`, Next `metadata`). После перехода фокус — на `h1` (`tabIndex=-1`), без дублирования live-регионом.
- **Landmarks и заголовки:** шапка — `banner`, меню и вкладки — `nav`, область контента — `main`, правая колонка — `complementary`. `h1` — экран; `h2` (`role="heading"`, `aria-level={2}`) — секции («Получено (N)», «Архив», «Недавние вишлисты»), карточки правой колонки, заголовки диалогов и шторок. В react-native-web `accessibilityRole="header"` по умолчанию даёт `h1`, поэтому уровень задаётся явно.
- **Куда уходит фокус, если открывший элемент исчез** (закрыли желание, приняли запрос, удалили карточку, забронировали, закрыли подсказку): (а) на «Отменить» в toast, если оно есть; иначе (б) на элемент, который его заменил (строка-пояснение вместо «Куплю сам», pill нового статуса); иначе (в) на следующий элемент списка, если его нет — на предыдущий; иначе (г) на `h1` экрана. Фокус никогда не уходит на `body`.
- **ToastHost:** постоянно смонтирован, два региона — вежливый и срочный. Браузер — `role="status"` и `role="alert"` (в DOM до появления текста); Android — `accessibilityLiveRegion` на хосте; iOS — ещё `AccessibilityInfo.announceForAccessibility`. Длительность и пауза — строка Toast выше.
- **Android и iOS:** у каждого интерактивного — `accessibilityRole`, `accessibilityLabel`, состояние (`accessibilityState`: selected, checked, disabled, expanded). Порядок TalkBack/VoiceOver совпадает с визуальным. Основная зона карточки читается одной фразой: «{название}, {цена}, {статус}, {теги}, {строка брони}, видимость {всем}»; превью фото в карточке декоративное (`accessible={false}`, `alt=""`), потому что название уже прочитано; чип и ⋯ — отдельные соседние элементы (см. WishCard). Ориентация не блокируется: `app.json` → `"orientation": "default"`.
- **Касание:** не меньше `{spacing.touch-target}` × `{spacing.touch-target}` на всех платформах; между соседними целями не меньше 8.
- **Движение:** fade и сдвиг шторки до 200 мс; при «уменьшить движение» (`prefers-reduced-motion`, `AccessibilityInfo.isReduceMotionEnabled`) — без сдвига, только fade; скелетон статичный. Скелетон в любом случае не мерцает дольше 5 с.
- Смысл не передаётся одним цветом: pill — словом, чип видимости — словом и иконкой, ошибка — текстом.

## Next-страницы

Next.js + shadcn/ui + Tailwind. Тот же brand-layer: CSS-переменные shadcn (`--primary`, `--accent`, `--background`, `--border`, `--ring`, …) принимают значения из frontmatter, шрифты — Lora и Manrope через `next/font` с подмножествами `cyrillic` и `latin`. `lang` страницы — язык страницы, не жёстко `ru`. Своего UI вошедшего пользователя здесь нет (AD-17): вошедшего каждая страница передаёт в приложение.

Общий каркас `/l`, `/i`, `/unsubscribe`: `{components.next-header}` — логотип (`BRAND_NAME`, `display-sm`) слева; справа «Войти» (ghost) там, где вход уместен. Контент по центру, gutter как в приложении, без бокового меню; внизу футер со ссылкой «Написать автору». Сначала телефон (UX-DR10): первый показ — серверный HTML, без загрузки приложения. Доступность — как в приложении: `lang="ru"`, ссылка «Перейти к содержимому», `main`, `h1`. Заголовки страниц: «Вишлист {имя} — {BRAND}», «{Имя} приглашает в друзья — {BRAND}», «Отписка — {BRAND}», «Список не найден — {BRAND}».

| Страница | Вид | Действия |
|----------|-----|----------|
| **`/l/{token}`** — вишлист по ссылке | Имя владельца `display-sm`, @ник `caption`. Карточки — тот же Gift card, только желания «всем», без чипа видимости и без счётчика скрытых. Одна колонка до 600 px, дальше сетка до 3 колонок (`card-min`), ширина до `{spacing.max-wide}`. `h1` — имя владельца. Пусто — EmptyState «Пока нет открытых желаний». Невалидный токен или Block — «Список не найден» | **«Куплю сам»** у единичного открытого желания — ссылка `<a>` (`aria-label="Куплю сам: {название}"`, видимый текст тот же) → переход в приложение: без сессии — экран входа приложения с возвратом на этот вишлист и открытым confirm этого желания; «Зарегистрироваться» там же, дружба не создаётся. Есть сессия — сразу экран вишлиста в приложении. При установленном приложении ОС может открыть ссылку в нём (App Links / Universal Links). Мета-теги превью: имя владельца и бренд, без названий и фото желаний. Фото на карточках `/l` — только у желаний «всем» |
| **`/i/{token}`** — приглашение | `{components.next-panel}` по центру: Avatar `{spacing.avatar-lg}`, «{Имя} приглашает вас в друзья» (`display-sm`, `h1`), текст `body` — что даст дружба | Primary «Принять приглашение» → регистрация в приложении с токеном; ghost «У меня уже есть аккаунт» → вход. С сессией — сразу экран приложения «Добавить {имя} в друзья?». Невалидный токен и Block — «Приглашение не найдено». Состояния вошедшего (своя ссылка, уже друзья) — в приложении, `EXPERIENCE.md` → Flow 15 |
| **`/unsubscribe/{token}`** | `next-panel` по центру, без «Войти»: «Вы отписались от {тип писем}» (`heading`, `h1`), пояснение `body` | Secondary «Вернуть» → «Подписка возвращена» на месте (`role="status"`, фокус на этот текст). Ошибка «Вернуть» — «Не получилось. Попробуйте ещё раз.» под кнопкой. Невалидный токен — «Ссылка недействительна. Управлять письмами можно в настройках приложения.» Никаких данных аккаунта и ссылок внутрь |
| **`/admin`** | shadcn без изменений поведения: Sidebar (shadcn) слева — «Подборки», «Теги»; таблицы (`Table` с `<caption>`, можно визуально скрытой, и `<th scope="col">`), формы в `Sheet` справа (`SheetTitle` обязателен); публикация — `Switch` с подписью; toasts Sonner в `role="status"`. Бренд-цвета из токенов. Рассчитана на компьютер, от 1024 px; уже — одной колонкой, таблицы прокручиваются горизонтально внутри контейнера | Создать, изменить, опубликовать, снять с публикации. USER и аноним получают «не найдено» — без формы входа, чтобы не выдавать, что страница есть (Story 10.1, 10.2). Пустые таблицы — «Подборок пока нет» / «Тегов на модерации нет» |

## Do's and Don'ts

| Do | Don't |
|----|-------|
| Один primary action на экран | Стек CTA «оплатить / скинуться / куплю» в R1 |
| Accent только для брони | Accent на навигации, логотипе, пустых состояниях |
| Lora — точечно, один раз на экран | Body в serif «для уюта» |
| На широком экране — меню, сетка, правая колонка, диалог по центру | Растянутый на 1440 px телефон с нижними вкладками |
| Зона касания 44×44 везде, фокус виден везде | Действия, доступные только по hover; `hitSlop` вместо настоящей зоны |
| Выбранный раздел — полоса, вес и цвет | Выбранный раздел только цветом |
| Фото ужато на устройстве, в базе только ключ | Хранить фото в базе или грузить исходник 5 МБ |
| Скрытые желания просто отсутствуют | «Ещё 3 желания скрыты», gate-панель, 404 вместо пустого |
| Копирование ссылки + toast «Ссылка скопирована» | Share-sheet, QR, ссылка на отдельное желание |
| Приглушать `закрыт` | Показывать `закрыт` как ошибку |
| Paper-фон + белые карточки | Dark mode, фиолетовые градиенты, glow |
| Подсказка установить приложение — одна, закрывается | Баннер на каждом экране, модалка «Скачайте приложение» |
| Системные шторки, выбор даты, жесты «назад» | Самодельный выбор даты на телефоне |
