---
name: Gift List
description: "Вишлист с видимостью на каждом желании и бронью «Куплю сам». Одно приложение Expo (React Native + react-native-web) на Android, iOS и в браузере — раздел App; четыре серверные страницы Next.js (/l, /i, /unsubscribe, /admin) — раздел Next-страницы. Компоненты и токены — один пакет packages/ui на Tamagui (AD-2), светлая и тёмная темы (дизайн-система v8 «Ночное небо»; прежнее ограничение «только светлая тема», UX-A8, снято владельцем 2026-11-18). Пилот на русском, мультиязычность заложена (кириллица + латиница)."
status: final
created: 2026-09-30
updated: 2026-11-18
language: ru
workflow: bmad-ux
round: 1
palette: night-sky
sources:
  - "{planning_artifacts}/prds/prd-gift-list-2026-09-30/prd.md"
  - "{planning_artifacts}/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md"
  - "{planning_artifacts}/epics/epics-gift-list-2026-09-30/epics.md"
  - "{planning_artifacts}/briefs/brief-gift-list-2026-09-29/brief.md"
colors:
  # v8 «Ночное небо» (2026-11-18, владелец): светлая тема. Значения переносятся в
  # тему Tamagui в packages/ui и больше нигде в коде не повторяются (AD-2).
  # Тёмная тема — блок colors-dark ниже; ключи в обоих блоках совпадают один в один,
  # поэтому компоненты берут $токены и о теме не думают.
  # Primary — сплошной индиго (#2B3A7A), единственная яркая кнопка экрана.
  # accent — спокойная secondary: полупрозрачный фиолетовый фон, текст accent.11.
  # Жёлтого и золотого в палитре нет ни в одной роли.
  primary: '#2B3A7A'
  primary-hover: '#1E2B69'
  primary-foreground: '#FFFFFF'
  accent: '#EDEBF4'
  accent-hover: '#E5E2F1'
  accent-foreground: '#5B4C97'
  # Рамка спокойной secondary-кнопки и выбранного чипа: та же фиолетовая гамма шага 7.
  accent-border: '#BAB4E0'
  background: '#F3F1EC'
  foreground: '#1C1A2E'
  surface: '#FFFEFB'
  surface-raised: '#FFFEFB'
  # Бегунок переключателя: v8 держит его светлым в обеих темах (трек — primary вкл. / border-strong выкл.).
  switch-thumb: '#FFFFFF'
  muted: '#ECE7DF'
  muted-foreground: '#56565C'
  border: '#DAD6CE'
  border-strong: '#89888F'
  ring: '#2B3A7A'
  # Кольцо фокуса на тёмных и цветных поверхностях (toast): 15.0:1 к foreground.
  ring-inverse: '#F3F1EC'
  # Семантические статусы желания (не brand-chrome). Бронь — фиолетовый accent.11
  # на accent.3: жёлтой пары status-reserved/status-reserved-bg больше нет.
  status-open: '#2C7352'
  status-reserved: '#5B4C97'
  status-reserved-bg: '#EEEDFD'
  status-closed: '#56565C'
  destructive: '#C4473D'
  destructive-hover: '#B1352D'
  destructive-foreground: '#FFFFFF'
  scrim: '#1C1A2E'
colors-dark:
  # v8 «Ночное небо» (2026-11-18, владелец): тёмная тема. Те же ключи, что в colors.
  # Объём дают разница тонов слоёв и блик по верхней грани (блок effects), а не
  # большие тени; primary — periwinkle, текст на нём тёмный.
  primary: '#7C8CFF'
  primary-hover: '#8FA0FE'
  primary-foreground: '#0E0E20'
  accent: '#373458'
  accent-hover: '#413E64'
  accent-foreground: '#C6BCEB'
  accent-border: '#6F6895'
  background: '#0E0E20'
  foreground: '#F3F1F8'
  surface: '#1B1B3A'
  surface-raised: '#272642'
  switch-thumb: '#F3F1F8'
  muted: '#272642'
  muted-foreground: '#BABBD4'
  border: '#302F4B'
  border-strong: '#717289'
  ring: '#7C8CFF'
  ring-inverse: '#0E0E20'
  status-open: '#A1D1B6'
  status-reserved: '#C6BCEB'
  status-reserved-bg: '#211E2A'
  status-closed: '#BABBD4'
  destructive: '#EE8A80'
  destructive-hover: '#FC9C91'
  destructive-foreground: '#0E0E20'
  scrim: '#06041A'
typography:
  # D-46 (Sergey 2026-10-28): Lora 600 + Manrope 400, 500, 600 — оба с кириллицей и латиницей (Google Fonts, OFL;
  # подмножества latin, latin-ext, cyrillic, cyrillic-ext). Fraunces и DM Sans заменены: в них нет кириллицы.
  # v8 (2026-11-18): заголовки — Lora 600 (display, display-sm, heading), интерфейс — Manrope.
  # Имена ролей прежние, значения — из v8-шкалы: display 34, h2 → display-sm 22,
  # h3 → heading 18, h4 → body-strong 15, bodyLg → body 16, button 14/500,
  # label 13/500, caption 12. Новых имён не заводим, чтобы экраны не переписывать.
  # В React Native lineHeight задаётся в px: fontSize × множитель, округлить до целого.
  display:
    fontFamily: 'Lora'
    fontSize: 34px
    fontWeight: '600'
    lineHeight: '1.24'
    letterSpacing: '-0.018em'
  display-sm:
    fontFamily: 'Lora'
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.27'
    letterSpacing: '-0.018em'
  heading:
    fontFamily: 'Lora'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.33'
    letterSpacing: '-0.006em'
  body-strong:
    fontFamily: 'Manrope'
    fontSize: 15px
    fontWeight: '600'
    lineHeight: '1.47'
  body:
    fontFamily: 'Manrope'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  button:
    fontFamily: 'Manrope'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.43'
  label:
    fontFamily: 'Manrope'
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.38'
  caption:
    fontFamily: 'Manrope'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.33'
rounded:
  # v8 (2026-11-18): 8 — кнопки и поля, 16 — карточки и диалоги, 20 — шторка.
  # 6 — бейджи, чекбоксы, чипы. Круглыми остаются только аватары, switch и бегунок.
  sm: 6px
  md: 8px
  lg: 16px
  xl: 20px
  full: 9999px
effects:
  # v8 (2026-11-18): объём. Светлая — двухслойная мягкая тень; тёмная — разница тонов
  # слоёв и блик по верхней грани, больших теней нет. Градиентов, glow и стекла нет.
  shadow-card-light: '0 1px 3px rgba(40,35,25,0.08), 0 12px 28px -4px rgba(40,35,25,0.08)'
  shadow-card-hover-light: '0 2px 4px rgba(40,35,25,0.10), 0 18px 36px -6px rgba(40,35,25,0.12)'
  shadow-popover-light: '0 2px 6px rgba(40,35,25,0.08), 0 24px 48px -12px rgba(40,35,25,0.18)'
  shadow-card-dark: '0 1px 2px rgba(4,4,20,0.4), 0 8px 24px -8px rgba(4,4,20,0.5)'
  shadow-card-hover-dark: '0 12px 32px -8px rgba(4,4,20,0.6)'
  shadow-popover-dark: '0 18px 48px -12px rgba(4,4,20,0.7)'
  highlight-card-light: 'inset 0 1px 0 rgba(255,255,255,1)'
  highlight-modal-light: 'inset 0 1px 0 rgba(255,255,255,1)'
  highlight-button-light: 'inset 0 1px 0 rgba(255,255,255,0.22)'
  highlight-card-dark: 'inset 0 1px 0 rgba(255,255,255,0.15)'
  highlight-modal-dark: 'inset 0 1px 0 rgba(255,255,255,0.18)'
  highlight-button-dark: 'inset 0 1px 0 rgba(255,255,255,0.15)'
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
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
    typography: '{typography.button}'
  button-secondary:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    border: '1px solid {colors.accent-border}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
  button-outline:
    background: 'transparent'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border-strong}'
    hover-background: '{colors.muted}'
    hover-border: '{colors.foreground}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
  button-ghost:
    background: 'transparent'
    foreground: '{colors.foreground}'
    hover-background: '{colors.muted}'
    radius: '{rounded.md}'
    min-height: '{spacing.touch-target}'
  gift-card:
    background: 'transparent'
    radius: '{rounded.lg}'
    photo-ratio: '4:5'
    photo-radius: '{rounded.lg}'
    photo-shadow: 'effect shadow-card (light: two layers, dark: highlight + shallow layers)'
    hover-photo-shadow: 'effect shadow-card-hover'
    padding: '0; текст под плиткой — 8 px сверху, 4 px по бокам'
  status-pill-open:
    background: '{colors.surface}'
    foreground: '{colors.muted-foreground}'
    border: '1px solid {colors.border}'
    dot: '{colors.status-open}'
    radius: '{rounded.sm}'
    typography: '{typography.caption}'
  status-pill-reserved:
    background: '{colors.surface}'
    foreground: '{colors.muted-foreground}'
    border: '1px solid {colors.border}'
    dot: '{colors.status-reserved}'
    radius: '{rounded.sm}'
    typography: '{typography.caption}'
  status-pill-closed:
    background: '{colors.surface}'
    foreground: '{colors.muted-foreground}'
    border: '1px solid {colors.border}'
    dot: '{colors.status-closed}'
    radius: '{rounded.sm}'
    typography: '{typography.caption}'
  visibility-chip-public:
    background: '{colors.surface}'
    foreground: '{colors.primary}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    icon: 'globe'
  visibility-chip-friends:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    icon: 'users'
  visibility-chip-secret:
    background: 'transparent'
    foreground: '{colors.muted-foreground}'
    border: '1px dashed {colors.border-strong}'
    radius: '{rounded.md}'
    icon: 'lock'
  owner-action-label:
    background: '{colors.muted}'
    foreground: '{colors.foreground}'
    border-left: '3px solid {colors.accent-foreground}'
    radius: '{rounded.md}'
    padding: '12px'
  reservation-phase:
    foreground: '{colors.status-reserved}'
    typography: '{typography.label}'
  input:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border-strong}'
    hover-border: '{colors.muted-foreground}'
    focus-border: '{colors.ring}'
    error-border: '{colors.destructive}'
    radius: '{rounded.md}'
    min-height: '{spacing.control-height}'
  switch:
    track-on: '{colors.primary}'
    track-off: '{colors.border-strong}'
    thumb: '{colors.switch-thumb}'
  toast:
    background: '{colors.surface}'
    foreground: '{colors.foreground}'
    border: '1px solid {colors.border}'
    action-foreground: '{colors.primary}'
    focus-ring: '{colors.ring}'
    radius: '{rounded.lg}'
    max-width: '{spacing.dialog-width}'
  toast-error:
    background: '{colors.surface}'
    foreground: '{colors.destructive}'
    border: '1px solid {colors.destructive}'
    action-foreground: '{colors.primary}'
    focus-ring: '{colors.ring}'
    radius: '{rounded.lg}'
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
    radius: '{rounded.md}'
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
    radius: '{rounded.lg}'
    ratio: '4:5'
    placeholder: 'спокойная тонированная плитка (accent или muted по хешу названия), светлое пятно и месяц, без текста'
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
    background: '{colors.surface-raised}'
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

> **[DECISION] Палитра C — Forest Paper** подтверждена Sergey (2026-09-30); **заменена дизайн-системой v8 «Ночное небо» 2026-11-18**. Имя продукта выбрано 2026-11-10 — **WishMoon** (D-35); домен остаётся открытым (Q-2). Имя на экранах — константа `PRODUCT_NAME` из `packages/contracts`, переопределяемая `BRAND_NAME` / `EXPO_PUBLIC_BRAND_NAME` (AD-24); в макетах — только плейсхолдер. «Написать автору» — `mailto:` на `AUTHOR_EMAIL` из того же файла (AD-24).
> **[DECISION] D-40 (2026-10-28).** Один клиент — приложение Expo на Android, iOS и в браузере; дизайн приложения один, с адаптивными раскладками (раздел **App**). Next.js отдаёт только `/l`, `/i`, `/unsubscribe`, `/admin` (раздел **Next-страницы**).
> **[DECISION] v8 (2026-11-18, владелец).** Дизайн-система **v8 «Ночное небо»**: светлая и тёмная темы, сплошной индиго primary, спокойная фиолетовая secondary, никакого жёлтого/золотого, радиусы 8/16/20. Прежнее ограничение **[ASSUMPTION: UX-A8] «только светлая тема» снято**: обе темы обязательны и равноправны; компоненты берут `$`-токены и о теме не думают, тему выбирает приложение (по умолчанию — светлая). Какие изменения уже в коде, а какие в следующих подзадачах — раздел **v8 (2026-11-18)** ниже. **[DECISION] D-46:** пилот на русском, мультиязычность заложена — кириллица и латиница, слева направо (`EXPERIENCE.md` → Локализация).

Spines главнее макетов. Ключевые экраны приложения (телефон и широкий браузер) — [`mockups/app-key-screens.html`](mockups/app-key-screens.html). `prototype/index.html` устарел (см. `EXPERIENCE.md` → Foundation).

## v8 (2026-11-18)

Владелец утвердил дизайн-систему **v8 «Ночное небо»** и отменил правило «только светлая тема» (UX-A8). Референс (вне репозитория, только для чтения): `D:\Clever\wishmoon-v8-ref\` — `design-system/README.md` (спека v8 и правила состояний), `design-system/tokens/wishmoon-tokens.json`, `design-system/tokens/contrast-report.csv`, `design-system/previews/` и `blocks/` (светлая и тёмная), `OPENCODE-BRIEF.md` (общие правила и обязательные решения v8). Референс — источник вида, но не код: токены живут только здесь, в frontmatter, и в `packages/ui/src/tokens.ts`.

Что изменилось в этой подзадаче (токены и темы):

- **Две палитры.** `colors` — светлая (`#F3F1EC` фон, `#FFFEFB` карточки), `colors-dark` — тёмная (`#0E0E20` фон, `#1B1B3A` карточки, `#272642` слой выше). Ключи в блоках совпадают один в один; тема Tamagui собирается из блоков в `packages/ui/src/config.ts` (`light` и `dark`).
- **Primary вместо Forest.** Сплошной индиго `#2B3A7A` (тёмная — periwinkle `#7C8CFF`), hover темнее на 8 %. Градиентного CTA нет.
- **Secondary — фиолетовая.** `accent` теперь не жёлтая заливка, а спокойная secondary: фон `#EDEBF4`, текст `#5B4C97`. Жёлтого/золотого (`#D4A017`) в палитре нет ни в одной роли; старые `#D4A017`/`#C39315` из темы ушли.
- **Статус брони — фиолетовый.** Жёлтая пара `status-reserved` / `status-reserved-bg` (`#7A5E07` на `#F5E6B8`) заменена на `#5B4C97` на `#EEEDFD` (6.21:1); `status-open` — зелёный `#2C7352` на `muted`, `status-closed` — серый. `status-open`/`status-reserved`/`status-closed` не меняют имён, меняют значения.
- **Типографика.** Заголовки — Lora 600: `display` 34/42, `display-sm` 22/28, `heading` 18/24 (`heading` перешёл с Manrope на Lora). Интерфейс — Manrope: `body-strong` 15/22, `body` 16/24, `button` 14/20/500, `label` 13/18/500, `caption` 12/16. Имена ролей прежние.
- **Радиусы.** `sm` 6 (бейджи, чипы, чекбоксы), `md` 8 (кнопки и поля), `lg` 16 (карточки и диалоги), `xl` 20 (шторка). Круглыми остаются только аватары, switch и бегунок (`full`).
- **Объём (блок `effects`).** Светлая — двухслойная мягкая тень `card`, усиленная `card-hover`, и `popover` для слоёв; тёмная — то же плюс блик по верхней грани `inset 0 1px 0 rgba(255,255,255,0.15)`, объём даёт разница тонов слоёв. Тени, блики и `surface-raised` уже в токенах; стекла, blur, glow и scrim-постера нет.
- **Контраст.** Все пары текста и фона проверены в обеих темах: текст ≥ 4.5:1, UI (рамки полей, фокус, иконки) ≥ 3:1, провалов нет; сводная таблица — `design-system/tokens/contrast-report.csv` в референсе. Исключение, как и в v8: белый текст на коралловом `#C4473D` — 4.87:1.

Базовые компоненты и карточка желания (подзадачи 2–3, 2026-11-18):

- **Кнопки.** `primary` и `reserve` — сплошной индиго (одна яркая CTA на экран), `secondary` — спокойная фиолетовая заливка с рамкой `accent-border`, новый `outline` — нейтральная с рамкой `border-strong`, `ghost` — прозрачная с текстом `foreground`, `destructive` — коралл. Радиус 8, кольцо фокуса 2 px с отступом 2 px. Новый `IconButton` — иконочная кнопка 44 × 44 с рамкой 1 px (`outline`) или без неё (`plain`). Disabled и busy остаются прежними: 40 % и 60 % непрозрачности с блокировкой hover/press (DECISION 2026-11-10); черновик v8 рисует disabled нейтральной плашкой, но в этой спеке правило про непрозрачность сильнее — менять его отдельным решением.
- **Поля и выбор.** `input` и `textarea` — радиус 8, рамка `border-strong`, на hover `muted-foreground`, на фокусе `ring` плюс кольцо 2 px с отступом 2 px; ошибка — `destructive` с текстом под полем. `Choice` (строки и чипы) — радиус 8. `Switch` — бегунок `switch-thumb`, светлый в обеих темах.
- **Слои.** Тултип — мягкая поверхность `surface` с рамкой `border`, тенью `popover`, отступами 8/12 и без стрелки. Диалог — радиус 16 и тень `popover`. Шторка — радиус 20 сверху, `surface-raised` и тень `popover`.
- **Toast.** Карточка `surface` с рамкой и тенью, действие — `primary`, закрытие — `muted-foreground`; у ошибки коралловые рамка и текст. Раньше это была плотная тёмная (и красная) плашка, поэтому кольцо фокуса вернулось к обычному `ring`. Тоны остались `info | error`: тон виден только через иконку/акцент, а `success` и `warning` требуют своих иконок (`warning` к тому же не должен быть жёлтым) — это отдельная задача.
- **Статусы и чипы.** `StatusPill` — нейтральная плашка `surface` с рамкой 1 px и точкой 6 px цвета статуса, слово остаётся главным. `VisibilityChip` и `TagChip` — радиус 8; выбранный тег — фиолетовая заливка `accent` с рамкой `accent-border`; свой тег — рамка `accent-border` и звезда `accent-foreground`.
- **Скелетоны и пустое состояние.** Блоки скелетона — радиус 8 на `muted`, карточка-скелетон — `surface` с рамкой; `EmptyState` уже был на токенах и не менялся (иллюстрация — в подзадаче экранов).
- **Меню строки.** `OverflowMenu` по умолчанию показывает вертикальное `⋮` вместо `⋯`, кнопка 44 × 44 с радиусом 8, пункты меню подсвечиваются `muted`.
- **Аватар.** Новый `Avatar` в `packages/ui`: фото или инициалы на `muted` (текст `muted-foreground`, 5.9:1 в светлой и 7.7:1 в тёмной), размеры `avatar-sm` 28 / `avatar-md` 40 / `avatar-lg` 64, необязательная точка статуса с кольцом цвета фона. Слово статуса приходит переведённым (`statusLabel`) и входит в подпись для диктора; рядом с написанным именем аватар помечается `decorative`.
- **Карточка желания и сетка.** `WishCard` — вертикальная Pinterest-карточка: фото-плитка 4:5 с радиусом 16 и тенью `shadow-card` (в тёмной теме — блик по верхней грани), под ней на фоне страницы название (2 строки), цена без магазина, status pill, теги и строка брони; чип видимости остаётся соседним слоем над зарезервированным футером, поэтому Tab идёт сначала на карточку, потом на чип. Фото в контракте пока нет, поэтому на плитке — заглушка v8: спокойный тон (`accent` или `muted` по хешу названия), светлое пятно и месяц, без текста. Круглой кнопки брони в углу нет: карточка не отдаёт действие брони (оно живёт в детали). Тень карточки — одно значение на тему (`shadow-card` / `shadow-card-hover`), чтобы компонент не спрашивал имя темы. Скелетон повторяет ту же форму, а сетка стала 2 колонки до `bp-expanded` и 3 от него — горизонтальных строк желаний нет ни на одном экране.

Чего эти подзадачи **не** делают (следующие шаги v8): магазины-партнёры, «Подборки» варианта A, экраны «Друзья» (мобильный A и веб D), иллюстрация пустого состояния, подключение `Avatar` к экранам и строкам, фото желаний (сейчас у всех — заглушка). До них экраны рисуются прежними раскладками, но уже на токенах и компонентах v8.

## Brand & Style

Gift List — тихий координатор подарков для узкого круга: ясность статуса важнее праздничного шума. Визуальный тон v8 «Ночное небо»: индиго (`{colors.primary}`) — главное действие, навигация, фокус; спокойная фиолетовая `{colors.accent}` — secondary и «ваша бронь»; коралловый `{colors.destructive}` — только удаление и ошибки. Фон `{colors.background}` — тёплая бумага в светлой теме и ночной синий `colors-dark` в тёмной; карточки — `{colors.surface}`, чтобы список читался как записи на листе.

Один визуальный язык на всех поверхностях: приложение на телефоне, то же приложение в браузере и четыре Next-страницы. Приложение не копирует Material или iOS-стиль: системные только жесты, шторки, выбор даты и клавиатура. Next-страницы собраны из тех же компонентов `packages/ui`, что приложение.

Избегать: градиентного CTA, glow, стекла и blur, жёлтого и золотого, emoji в chrome, pill-кластеров на hero, второго яркого brand-цвета рядом с primary.

## Colors

Две темы с одинаковым набором ролей: `colors` (светлая) и `colors-dark` (тёмная) во frontmatter. Компоненты берут только `$`-токены, поэтому одна и та же разметка рисуется в обеих темах; тему выбирает приложение (`GiftListProvider`, по умолчанию светлая).

- **Primary Indigo (`{colors.primary}`)** — единственная яркая кнопка экрана, активная навигация, ссылки, фокус (`{colors.ring}`), включённый переключатель. Светлая — `#2B3A7A` (текст `{colors.primary-foreground}` 10.6:1), тёмная — periwinkle `#7C8CFF` с тёмным текстом (6.4:1).
- **Accent Violet (`{colors.accent}`)** — спокойная secondary: полупрозрачная фиолетовая заливка, текст `{colors.accent-foreground}` (6.1:1 в светлой, 6.6:1 в тёмной) и рамка `{colors.accent-border}` той же гаммы. Это не «вторая primary»: заливка тише primary и не спорит с ним; в этом же фиолетовом тоне — выбранный чип и «ваша бронь».
- **Switch thumb (`{colors.switch-thumb}`)** — бегунок переключателя остаётся светлым в обеих темах (в светлой `#FFFFFF`, в тёмной `#F3F1F8`), состояние несёт трек: `{colors.primary}` включён, `{colors.border-strong}` выключен.
- **Ring inverse (`{colors.ring-inverse}`)** — кольцо фокуса на плотной цветной заливке, где `{colors.ring}` не видно (запас на будущие поверхности; toast в v8 — светлая карточка и берёт обычное `{colors.ring}`).
- **Background (`{colors.background}`)** — фон всех экранов и шапки приложения: тёплая бумага `#F3F1EC` в светлой, ночной синий `#0E0E20` в тёмной.
- **Surface / Surface raised (`{colors.surface}`, `{colors.surface-raised}`)** — карточки, вкладки, боковое меню, шторки, диалоги; `surface-raised` — слой над карточкой (поповер, меню, поле на карточке). В светлой оба `#FFFEFB`, в тёмной `#1B1B3A` и `#272642`.
- **Border / Border-strong.** `{colors.border}` — разделители и контур карточек (декоративный, 1.1–1.2:1). `{colors.border-strong}` — контур того, с чем взаимодействуют: поля, переключатель в выкл., secondary-кнопки, чипы видимости: 3.5:1 к карточке в светлой и 3.5:1 в тёмной (WCAG 1.4.11). На `{colors.muted}` не ставить.
- **Статусы:** `открыт` → `{colors.status-open}` на `{colors.muted}`; `забронирован` → фиолетовый `{colors.status-reserved}` на `{colors.status-reserved-bg}` (6.2:1 светлая, 9.2:1 тёмная); `закрыт` → `{colors.status-closed}` на `{colors.muted}` (приглушённо, не как ошибка). Жёлтой пары у брони больше нет.
- **Destructive (`{colors.destructive}`)** — удаление желания, блок, снятие чужой брони, «Выйти», «Удалить аккаунт», toast «Нет сети». Не для `закрыт`. Коралл `#C4473D` в светлой, `#EE8A80` в тёмной.
- **Scrim (`{colors.scrim}` 40%)** — подложка под шторкой, диалогом и выдвижным меню. Не опускать ниже 40%. Прочие прозрачности: pressed — затемнение 8%, disabled — 40%.
- **Hover-затемнение кнопок** (v8). Hover кнопки — её фон, затемнённый на 8%: `primary-hover` `#1E2B69` (текст 13.1:1), `accent-hover` `#E5E2F1` (5.6:1), `destructive-hover` `#B1352D` (6.2:1); в тёмной теме — свои hover-значения из `colors-dark`. secondary на hover темнит границу до `{colors.foreground}`, ghost — фон `{colors.muted}`. Значения нормативны; в frontmatter и в `packages/ui/src/tokens.ts` они попадают одной правкой, потому что `tokens.test.ts` сверяет блок `colors` с кодом один в один.

**Контраст (проверено 2026-11-18, обе темы).** Текст ≥ 4.5:1, UI (рамки полей, фокус, иконки) ≥ 3:1, провалов нет. Светлая: foreground на paper 15.0:1, на карточке 16.8:1; muted-foreground на paper 6.5:1, на карточке 7.2:1, на muted 5.9:1; primary на paper 9.4:1; текст на accent 6.1:1; status-open на muted 4.6:1; status-reserved на своём фоне 6.2:1; destructive на карточке 4.8:1; ring-inverse на foreground 15.0:1; border-strong к карточке 3.5:1, к paper 3.1:1. Тёмная: foreground на фоне 17.0:1, на карточке 14.8:1; muted-foreground на карточке 8.8:1; primary на фоне 6.4:1; текст на accent 6.6:1; status-reserved на своём фоне 9.2:1; border-strong к карточке 3.5:1. Компромисс v8: белый текст на коралле `#C4473D` — 4.87:1, на грани нормы; темнее цвет делать нельзя, станет «тревожно-красным». `{colors.border}` (1.1:1) не несёт смысла сам по себе — только разделяет. Полная таблица пар — `design-system/tokens/contrast-report.csv` в референсе v8.

## Typography

- **Display (`Lora`, 600)** — заголовки. `display` 34/42 — редкий акцент: заголовок пустого состояния, имя владельца на вишлисте и профиле, приветствие на `/i`; один display на экран. `display-sm` 22/28 — заголовки Next-страниц и логотип. `heading` 18/24 — заголовок экрана в шапке, заголовки секций и слоёв. Lora не используется для body, кнопок и навигации.
- **UI (`Manrope`)** — всё остальное: `body-strong` 15/600 — название желания и имена в строках списков; `body` 16/24 — основной текст; `button` 14/20/500 — текст кнопок; `label` 13/18/500 — подписи полей, пункты меню, строка брони; `caption` 12/16 — вспомогательный текст, pill, подписи вкладок.
- Цена — цифры lining tabular, код валюты после неразрывного пробела.
- Масштаб шрифта системы (Dynamic Type, «Размер шрифта» Android, zoom браузера) не отключается. Раскладка выдерживает 200%: строки переносятся, кнопки растут по высоте, текст не обрезается многоточием в действиях. Поэтому высоты в токенах — `min-height`, не фиксированные. Исключение одно: подписи нижних вкладок ограничены `maxFontSizeMultiplier = 1.5`; на iOS при долгом нажатии — Large Content Viewer. Проверка: 200% Android, AX3 iOS, zoom 200% и 400% в браузере.
- Логотип в боковом меню и шапках Next-страниц — `display-sm`.
- **Языки.** Шрифты покрывают кириллицу и латиницу, включая расширенные наборы (украинский, белорусский, польский, немецкий и т.п.). Подключать подмножества `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`; без системной подмены глифов. Перед добавлением нового языка — проверить его буквы в обоих шрифтах (например, казахские Ұ, Ү, Һ). Manrope шире DM Sans: подписи тестировать с самым длинным языком, а не с русским.

## Layout & Spacing

Шкала кратна 4. Gutter `{spacing.page-gutter}` на compact, `{spacing.page-gutter-lg}` от medium. Ритм секций `{spacing.section-gap}`. Формы и чтение — не шире `{spacing.max-form}` / `{spacing.max-content}`; сетка карточек — не шире `{spacing.max-wide}`. Раскладки по ширине окна — раздел **App → Точки перехода**.

## Elevation & Depth

Мягкий объём из двух слоёв (v8). Светлая тема: карточка — двухслойная тень `{effects.shadow-card-light}`, hover — `{effects.shadow-card-hover-light}`, плавающее (шторка, диалог, toast, меню пользователя) — `{effects.shadow-popover-light}`; блик по верхней грани `{effects.highlight-card-light}`. Тёмная тема: больших теней нет — объём даёт разница тонов слоёв (`surface` над `background`, `surface-raised` над `surface`) и блик `{effects.highlight-card-dark}`, у кнопок — `{effects.highlight-button-dark}`. Hover карточки — граница `{colors.primary}` и (на вебе) усиленная тень, без подъёма на 4 px. Градиентов, glow, стекла и blur нет ни в одной теме.

## Shapes

`{rounded.md}` 8 — кнопки, поля, табы, теги и чипы видимости; `{rounded.sm}` 6 — бейджи и статусная pill; `{rounded.lg}` 16 — карточки, диалоги, toast, панели Next-страниц; `{rounded.xl}` 20 — верхние углы шторки. `{rounded.full}` — только аватары, switch и бегунок слайдера; кнопки и карточки pill-формой не делать.

## Components

Общие визуальные правила для приложения и Next-страниц. Как это собрано: компоненты `packages/ui` (Tamagui) — раздел **App**; что отличается на Next-страницах — раздел **Next-страницы**.

| Компонент | Визуал | Когда |
|-----------|--------|-------|
| **Button primary** | `{components.button-primary}` | Сохранить, Войти, Принять, Скопировать ссылку |
| **Button reserve** | `{components.button-reserve}` — сплошной primary, как у главной | Только «Куплю сам» и «Подтвердить» в confirm брони |
| **Button secondary / outline / ghost** | `{components.button-secondary}` (спокойная фиолетовая) / `{components.button-outline}` / `{components.button-ghost}` | Второстепенное: «Загадать», «Поделиться», «Отмена» |
| **Gift card** (в RN — WishCard) | `{components.gift-card}`: вертикальная Pinterest-карточка — фото-плитка 4:5 сверху (`{rounded.lg}`, тень карточки), под ней на фоне страницы название (`body-strong`, 2 строки), цена, status pill, теги, строка брони; у владельца — чип видимости и ⋮ | Все желания, во всех списках: сетка 2/3 колонки. Горизонтальных строк желаний нет |
| **Wish photo** | `{components.wish-photo}`: плитка 4:5 на всю ширину карточки, `{rounded.lg}`, заглушка — спокойный тонированный фон с месяцем, без текста | Фото у желания (когда появится) и на месте фото — заглушка, выбранная детерминированно из названия |
| **Status pill** | `{components.status-pill-open}` / `-reserved` / `-closed`: нейтральная плашка, рамка 1 px и цветная точка 6 px | Всегда текстом: «Открыт» / «Забронирован» / «Получен» |
| **Visibility chip** | `{components.visibility-chip-public}` / `-friends` / `-secret`; иконка + текст | Только у владельца: «Всем» / «Друзьям» / «Секрет». Различаются иконкой и словом, не только цветом |
| **Owner action label** | `{components.owner-action-label}` | Внутри карточки владельца: «Ждёт вашего подтверждения», «Срок брони истёк» + до двух кнопок |
| **Tag chip** | `{components.tag-chip}` | Теги желания: «мечта», «нужно сейчас», «когда-нибудь», свой. Не нажимается в R1 |
| **Toast** (в т.ч. undo toast) | `{components.toast}`: карточка `surface` с рамкой, тенью `popover` и действием `primary`; ошибка — `{components.toast-error}` с коралловой рамкой и текстом | Подтверждения, «Отменить», гонка брони, нет сети |
| **Empty state** | `{components.empty-state}`, один CTA или без него | Пустой вишлист, нет друзей, нет броней, нет уведомлений. Тексты — `EXPERIENCE.md` → Empty states |
| **List row** | `{components.list-row}` | Друзья, подписки, запросы, поиск, контакты, уведомления |
| **Reservation card** | `{components.reservation-card}` | «Мои брони» |
| **Collection card** | `{components.collection-card}` | «Подборки» |

**Состояния кнопок и нажимаемых поверхностей** (DECISION 2026-11-10; одни и те же у Button, Pressable, Choice, TagChip, VisibilityChip и WishCard):

- **hover** — только при указателе: фон кнопки темнее на 8% (`primary-hover`, `accent-hover`, `destructive-hover`, раздел Colors), secondary — фон `{colors.accent-hover}`, outline — граница `{colors.foreground}` и фон `{colors.muted}`, ghost — фон `{colors.muted}`; у поля темнеет рамка до `{colors.muted-foreground}`, у чипов, toast и ⋮ вид не меняется, курсор — указатель. disabled и busy не реагируют на hover и press — вид не меняется (DECISION 2026-11-10, t312u).
- **pressed** — затемнение фона на 8% (в коде это непрозрачность 0.9; отдельных pressed-токенов не вводится, чтобы не удваивать палитру); у ghost — фон `{colors.muted}`.
- **disabled** — непрозрачность 0.4, `aria-disabled` / `accessibilityState.disabled`, элемент остаётся в порядке фокуса, причина рядом связана с ним (`aria-describedby`) и не бледнеет. Правило одно для кнопок, `Pressable`, радио-строк и чипов: 0.4, не 0.6.
- **busy** — непрозрачность 0.6, `aria-busy`, нажатие и отправка формы заблокированы, рядом с текстом — индикатор ожидания (спиннер 16 px в `currentColor`, вращение линейное); при `prefers-reduced-motion` спиннер статичный, ожидание объявляется `aria-busy`.
- **error** — у поля и у чипа видимая ошибка, не только ARIA: рамка `{colors.destructive}` 1 px плюс текст `destructive` рядом (у чипа — текст, который рендерит экран; у `ChoiceList` — ещё и рамка группы).

## App

Приложение Expo: React Native на Android и iOS, react-native-web в браузере, одна кодовая база (AD-17). Токены выше — тема Tamagui в `packages/ui`, общая с Next-страницами (AD-2). Иконки — lucide (`lucide-react-native`): `{spacing.icon-nav}` в навигации (вкладки и боковое меню), `{spacing.icon-inline}` в карточках и кнопках, `{spacing.icon-small}` в pill, чипах и фазе брони *[ASSUMPTION: UX-A15]*. Safe-area insets — `SafeAreaView` / `useSafeAreaInsets` из `react-native-safe-area-context`; в `packages/ui` для них допустима тонкая обёртка без API, env и текстов (уточнение AD-2, DECISION 2026-11-10).

Этот раздел — расширение спеки: платформенная реализация разделов Layout & Spacing и Components.

### Компоненты на React Native

Каждый интерактивный элемент — компонент `packages/ui` (Tamagui; в браузере — настоящий `<button>`/`<a>`) с ролью и подписью (`role`, `aria-label`), зона касания не меньше `{spacing.touch-target}`. Зона набирается `minHeight` / `minWidth` и прозрачным padding вокруг визуала, не `hitSlop`: в react-native-web он не расширяет зону для мыши и касания. Между соседними целями — не меньше 8. Состояния: hover — по разделу Components; pressed — затемнение фона на 8% (Android ripple допустим); disabled — 40% непрозрачности, `aria-disabled` / `accessibilityState.disabled`, элемент остаётся в порядке фокуса, пояснение рядом связано с ним (`aria-describedby`) и не бледнеет; focus (браузер, внешняя клавиатура) — кольцо 2 px `{colors.ring}` с отступом 2 px. Кольцо получают все интерактивные элементы, включая текстовые ссылки «Назад» и пункты меню (`LinkText`, `NavLink`). На телефоне `:focus-visible` не наступает: состояния «последнее взаимодействие было клавиатурой» там нет, поэтому кольцо рисуется по обычному `focus` — внешняя клавиатура и фокус TalkBack/VoiceOver; на вебе кольцо остаётся только на `:focus-visible`, иначе оно появляется от клика мышью.

| Компонент | Анатомия | Размеры и состояния |
|-----------|----------|---------------------|
| **WishCard** (Gift card) | Вертикальная Pinterest-карточка (v8). Сверху — фото-плитка 4:5 на всю ширину, `{rounded.lg}`, тень `card` (в тёмной — блик по верхней грани); нет фото — заглушка (тонированная плитка с месяцем, без текста). Под плиткой на фоне страницы: название (`body-strong`, 2 строки), цена (`label` 600, только цена), status pill, до трёх Tag chip в ряд (остальные — «+N»), строка брони (`label`). У владельца внизу слева — VisibilityChip; при `ownerAction` — OwnerActionLabel на всю ширину. **Структура:** карточка — контейнер без `accessible`; внутри соседние элементы: (1) основная зона — ссылка на деталь (expo-router `<Link asChild>`, в браузере `<a href="/gifts/{id}">`), её подпись — фраза из «Доступность»; (2) VisibilityChip; (3) ⋮. На основной зоне — `accessibilityActions` «Изменить видимость» и «Меню» для ротора VoiceOver и действий TalkBack | Высота по содержимому. Hover (браузер) — тень плитки `cardHover`, без подъёма текста. Закрытая — текст `muted-foreground`, pill «Получен»; в ⋮ у владельца — «Вернуть в открытые» (только в окне отмены), «Хочу ещё такой», «Удалить». Текста на фото нет; сердечка и полоски «подарено» нет |
| **StatusPill** | Плашка `surface` с рамкой 1 px, точка 6 px цвета статуса и текст `caption` (`muted-foreground`) | `min-height` `{spacing.pill-height}`, padding 0 10. Не нажимается; точку читает не диктор — смысл в слове |
| **VisibilityChip** | Иконка `{spacing.icon-small}` + текст `caption` | У владельца на карточке. У `открыт` и `забронирован` — кнопка (`aria-haspopup="dialog"`, подпись «Видимость: всем. Изменить»), открывает выбор видимости (`radiogroup`, тот же список, что в форме); после сохранения фокус — обратно на чип. У `забронирован` сужение, отнимающее у держателя доступ, открывает confirm «Бронирующий потеряет доступ, бронь снимется» (Подтвердить / Отмена). У `закрыт` и в архиве — не нажимается, только показывает значение (Story 2.3). `min-height` `{spacing.chip-height}` визуально, зона касания 44 за счёт padding |
| **ReserveButton «Куплю сам»** | `{components.button-reserve}`, на всю ширину в детали | На compact в детали — прилипает к низу над safe area. При `забронирован` / `закрыт` / «Можно дарить снова» кнопки нет, на её месте строка-пояснение `label` («Уже забронирован», «Уже подарено», «Можно дарить без брони»); фокус после брони переходит на эту строку |
| **ReserveConfirm** | Заголовок `heading` «Забронировать «{название}»?» · поле даты «Подарю до» · Switch «Показать владельцу, что это я» (выкл.) · Switch «Показать другим, кто берёт» (вкл.) · `caption`-подсказка про «Купил» · кнопки «Подтвердить» (reserve) и «Отмена» (ghost) | Compact — BottomSheet, кнопки во всю ширину, «Подтвердить» сверху. Medium+ — Dialog `{spacing.dialog-width}`, кнопки справа в ряд: «Отмена», «Подтвердить». Если деталь уже открыта диалогом (expanded+), confirm — шаг в том же диалоге, а не второй слой. Строки Switch — вся строка нажимается, `min-height` `{spacing.row-height}` |
| **ReservationPhase** | Иконка `{spacing.icon-small}` + текст `label` `{colors.status-reserved}` | Подписи по фазе и роли — одна таблица в `EXPERIENCE.md` → State Patterns → «Подписи брони». Флаг «Купил» у держателя — отдельный чип «Куплено» рядом. Срок в прошлом — иконка часов, без красного |
| **OwnerActionLabel** | Полоса accent слева, текст `label`, ниже 1–2 кнопки secondary `min-height` 44 на `{colors.surface}` | «Ждёт вашего подтверждения» → «Получил» / «Не получал»; «Срок брони истёк» → «Получил» / «Не получал, оставить бронь» / «Снять бронь» (третье — в ⋮) |
| **Toast** | Карточка `surface` с рамкой и тенью `popover`: текст `label` + необязательное действие (`button`, `primary`, подчёркнуто, зона 44×44); кольцо фокуса `ring`; у ошибки — рамка и текст `destructive` | Один постоянно смонтированный ToastHost (см. Доступность). Compact: снизу, над вкладками и над прилипшей кнопкой, отступ 8, ширина экрана минус gutter. Medium+: снизу по центру области контента, ширина до `{spacing.dialog-width}`. Длительность: обычный — `max(3000 мс, 60 мс × символ)` (DECISION 2026-11-10: на 1 с короче прежней формулы `max(4 с, 1 с + 60 мс × символ)`; короткое подтверждение не мигает); undo toast «Отменить» — 10 с. Появление и уход — fade до 160 мс (раздел Доступность → Движение). Любой toast на паузе при hover и фокусе; при включённом дикторе toast с действием не скрывается сам. «Нет сети» не скрывается сам, пока его не закрыли или не повторили действие. Один toast за раз, новый заменяет старый |
| **EmptyState** | Заголовок `display-sm`, текст `body` `muted-foreground`, не больше одного CTA primary | По центру области контента, ширина до `{spacing.max-form}`. Иллюстраций в R1 нет |
| **Форма** | Label (`label`) над полем · поле `{components.input}` · подсказка или ошибка `caption` под полем | `min-height` поля 48; фокус — граница `ring` 2 px; ошибка — граница и текст `destructive` + иконка. Обязательные поля не помечаются; необязательные — «(необязательно)» в подписи. Ошибка и подсказка связаны с полем: в браузере `aria-invalid` + `aria-describedby`, на телефоне — в `accessibilityHint` (на iOS ещё `accessibilityValue`). Кнопка отправки внизу формы; на compact — прилипает к низу над клавиатурой. Валюта — нативный `<select>` в браузере, шторка с радио на телефоне, пять кодов. Видимость — три строки-радио с иконкой и пояснением, по умолчанию «Всем». У `забронирован` видимость меняется; если новый выбор отнимает у держателя доступ, confirm «Бронирующий потеряет доступ, бронь снимется». «Один раз / Можно дарить снова» по-прежнему меняется только у `открыт`: над ним `caption` «Сколько раз можно дарить — меняется только у открытого желания». У `закрыт` и в архиве форма read-only, у обоих один `caption` «Архивное желание можно только просматривать.». **Лимиты полей** (DECISION 2026-11-10): название — до 120 символов, описание — до 2000, ссылка — до 2048, свой тег — до 30 (единственный счётчик, «N из 30»); `maxLength` не ставится — он считает UTF-16 и режет эмодзи, поэтому превышение показывается ошибкой при отправке, а ввод никогда не обрезается молча. **Строка действий на экране правки:** слева «Удалить желание» (destructive), справа «Отмена» и «Сохранить»; деструктивное действие первым — осознанное исключение из правила «деструктивные пункты последними» (оно про меню ⋮ и строку человека, а не про строку формы). На узком экране пара «Отмена»/«Сохранить» переносится под удаление целиком, ничего не обрезается |
| **Поле даты** | Телефон — кнопка `accessibilityRole="button"` с подписью «Подарю до, 4 ноября 2026» и hint «Выбрать дату» → системный выбор (iOS — `display="inline"` в шторке). Браузер — `<input type="date">` с `min` и `max` | Под полем `caption` «Не позже {DD.MM}», связанный с полем. Дата вне диапазона — ошибка при отправке «Выберите дату не позже {DD.MM}» |
| **Поля входа** | Email и пароль; у пароля кнопка «Показать пароль» 44×44 (`accessibilityLabel`, имя не меняется; состояние «нажато» — `aria-pressed` в браузере и `role="button"` + `accessibilityState.checked` на телефоне, DECISION 2026-11-10) | Вставка не блокируется, CAPTCHA нет. Автозаполнение: email — web `type="email"` + `autocomplete="username"`, RN `autoComplete="email"`, `textContentType="username"`, `keyboardType="email-address"`; пароль при входе — `current-password` / `textContentType="password"`; при регистрации и сбросе — `new-password` / `newPassword`; имя — `name`; ник — `nickname`; телефон — `tel`; ДР — `bday-day` / `bday-month` / `bday-year`. iOS — `webcredentials:` в associated domains; Android — Digital Asset Links. Сброс — ссылкой из письма, без ручного кода |
| **Фото в форме** | Без фото — кнопка secondary «Добавить фото» с иконкой камеры → выбор «Сделать фото» / «Из галереи» (в браузере — выбор файла). С фото — превью 120×120 `{rounded.md}`, рядом «Заменить» и «Убрать» (ghost) | Пока фото ужимается и загружается — превью с индикатором и подписью «Загружаем фото…»; «Сохранить» ждёт загрузку. Ошибка — `caption` `destructive` под превью и «Повторить». Подпись для диктора: «Фото желания. Заменить» |
| **Фото в детали** | Сверху детали, на всю ширину, соотношение 4:3, `object-fit: contain` на `{colors.muted}`, `{rounded.lg}` | Нажатие — фото на весь экран (только просмотр, закрыть крестиком, Esc, «назад»). `accessibilityLabel` — «Фото: {название}» |
| **Tag picker** | В форме желания: ряд переключаемых чипов «мечта», «нужно сейчас», «когда-нибудь» + «Свой тег» → поле до 30 символов со счётчиком | Каждый чип — `checkbox` с состоянием; выбранный — заливка `muted`, граница `border-strong`, галочка. Свой тег добавляется чипом с крестиком «Убрать тег {имя}». Ошибка тега (длиннее 30, повтор, тега больше нет в каталоге) видна на самом чипе: рамка `{colors.destructive}` 1 px; текст ошибки рендерит экран рядом с рядом чипов, `aria-invalid` и `accessibilityHint` — в дополнение к видимой рамке, не вместо неё |
| **Срок желания** | Поле даты «Убрать в архив после» (необязательно) в форме | `caption` «После этой даты желание уйдёт в архив». Не путать со Сроком брони |
| **Archive section** | У владельца, после «Получено (N)»: свёрнутая секция «Архив (N)» | Карточки как закрытые; в ⋮ — «Вернуть в вишлист» (форма с новой датой или без) и «Скопировать». Зрителям секции нет |
| **BottomSheet / Dialog** | Шторка: ручка 32×4 сверху (декоративная, не фокусируется), заголовок `heading`, видимая «Отмена» или «Закрыть» 44×44, содержимое, кнопки внизу. Диалог: заголовок, крестик «Закрыть», содержимое, кнопки справа | Шторка — compact; диалог — medium и шире. Одновременно не больше одного слоя: confirm и «Сохранить изменения?» внутри диалога — шаг в том же слое (содержимое меняется, фокус на новый заголовок, крестик «Закрыть» и Esc возвращают прежний шаг). Закрываются и системной «Назад» на Android |
| **Badge** | `{components.badge-count}`, число до «99+» | На вкладке, пункте бокового меню, колокольчике. Число входит в подпись элемента («Друзья, 2 запроса») |
| **PersonRow** (строка человека) | `{components.list-row}`: Avatar `{spacing.avatar-md}` · имя `body-strong` + @ник `caption` `muted-foreground` · справа chip отношения (если есть) · ⋮ 44×44 | Одна строка во всех списках людей: Поиск, Друзья, Подписки, Мои подписчики, Найти знакомых. Chip и пункты ⋮ — по таблице «Отношение → статус и меню» в `EXPERIENCE.md`. Кнопок в строке нет, кроме «Принять» / «Отклонить» во вкладке «Запросы» (под именем на compact, справа от medium). Вся строка, кроме ⋮, — ссылка на профиль. Меню ⋮: на compact — шторка снизу с именем в заголовке, от medium — выпадающее меню `{components.user-menu}`; деструктивные пункты (`destructive`) — последними, после разделителя |
| **NotificationRow** | `{components.list-row}`: иконка события `{spacing.icon-inline}` · текст `body` (до 3 строк) · время `caption` · кнопки действий secondary ниже текста | Непрочитанная — точка `unread-indicator` 8 px слева и текст `body-strong`; подпись для диктора начинается с «Новое». Устаревший запрос — «Даритель уже ответил», без кнопок. Нажатие по строке — деталь желания или профиль |
| **ReservationCard** | `{components.reservation-card}`: название из снимка (`body-strong`) · «у @{ник владельца}» `caption` · Срок «до DD.MM» · ReservationPhase · чип «Куплено» · переключатели видимости свёрнуты в «Кто видит, что это я» | Действия: «Продлить до…», «Купил» (переключатель), «Подарил», «Снять бронь» (в ⋮). Без цены, тегов и остальных желаний (A-14, AD-7). Если доступа к вишлисту нет — без ссылки на деталь |
| **CollectionCard** | `{components.collection-card}`: необязательная картинка 16:9 `{rounded.md}` · название подборки `heading` · описание `body` 2 строки · число идей `caption` | Нажатие — подборка; у каждой идеи внутри — «Добавить в мой вишлист» (secondary), после — «Добавлено» (disabled) + toast |
| **Мелкие элементы** | Switch — трек 52×32, бегунок 28 светлый в обеих темах, вся строка нажимается. Avatar — круг `{spacing.avatar-sm}` / `-md` / `-lg`, фото или инициалы на `muted` (`muted-foreground`, 5.9:1), точка статуса с кольцом цвета фона. Skeleton — блоки `muted` по форме карточки. Сегмент «Друзья · Подписки · Запросы» — текст `label`, выбранный — 600 и подчёркивание 2 px `primary`. OverflowMenu ⋮ — вертикальное многоточие, кнопка 44×44, меню `{components.user-menu}`. SearchField — поле с иконкой лупы и крестиком «Очистить». Chip «Куплено» и chip отношения («Друзья», «Зовёт в друзья», «Ожидает ответа», «Вы подписаны», «Подписан на вас», «Взаимная подписка», «Это вы») — как нейтральный чип: фон `muted`, текст `muted-foreground` (5.9:1); у «Зовёт в друзья» — текст `primary` 600, потому что это ждёт ответа. В списке, где отношение и так ясно («Друзья», «Я подписан»), chip не повторяется. Свёрнутая секция «Получено (N)» / «Уже подарено» / «Архив (N)» — заголовок-кнопка `heading` с шевроном, `aria-expanded` | Зона касания у всего нажимаемого — 44×44 |

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

Колонки карточек заданы шириной области контента — это единственное место, где задано их число. Область контента = окно − боковое меню − правая колонка (если есть) − `{spacing.page-gutter-lg}` по краям − `{spacing.column-gap}` перед правой колонкой; не шире `{spacing.max-wide}`. В v8 колонок всегда **две** до точки `{spacing.bp-expanded}` и **три** от неё, с промежутком `{spacing.grid-gap}`; `{spacing.card-min}` больше не решает число колонок — карточка Pinterest узкая по замыслу. Примеры: 360 и 600 → 2; 768 и 1023 → 2; 1024 → 3; 1280 и 1440 → 3 (с правой колонкой область уже, но если она остаётся ≥ 976 px — тоже 3).

Порядок карточек в DOM и для диктора — по строкам слева направо, как визуально; masonry и CSS `order` запрещены. Сетка — `role="list"`, карточка — `listitem`. Списки строк (друзья, брони, уведомления, поиск) остаются одной колонкой шириной до `{spacing.max-content}`.

**Реализация раскладки** (DECISION 2026-11-10). Сегодня ширину окна читает `useWindowDimensions`, число колонок считает `cardGrid` (`apps/mobile/src/ui/card-grid.ts`), а брейкпоинты `medium`/`expanded`/`wide`, объявленные в теме, ни один компонент не использует. Целевое состояние — раскладки на Tamagui `media` (в браузере это настоящие CSS-медиазапросы, на телефоне тот же медиа-ключ), чтобы ресайз окна и серверный рендер вели себя одинаково. Перевод поэтапный, по одному экрану: `media` не знает safe-area insets, ширины бокового меню и правой колонки, поэтому математика `cardGrid` остаётся единственным источником числа колонок до появления общей обёртки области контента в `packages/ui`. Первыми переводятся экраны без меню и правой колонки: анонимные экраны, «Настройки», состояния загрузки и ошибки.

### Широкий экран

От expanded приложение — не растянутый телефон:

- **Боковое меню вместо нижних вкладок.** Шапки с колокольчиком нет: заголовок экрана (`heading`) — над контентом, уведомления — пункт меню.
- **Сетка карточек.** «Мой вишлист», чужой вишлист, профиль и подборки показывают карточки сеткой (правило колонок выше). Кнопки владельца («Добавить желание», «Скопировать ссылку», подсказка-иконка) — в строке над сеткой справа, заголовок экрана — в той же строке слева (DECISION 2026-11-10). Если заголовок и кнопки не помещаются, группа кнопок переносится под заголовок целиком: жёсткой привязки к брейкпоинту нет, ничего не обрезается, не скрывается и не сжимается; иконка-подсказка переносится вместе с кнопкой, к которой относится.
- **Правая колонка (wide, только браузер).** `{components.right-column-card}`, прокручивается вместе со страницей. В пилоте в ней одна карточка — подсказка «Установите приложение»; закрыли подсказку — колонки нет, сетка занимает место. В приложении на планшете колонки нет. Есть только на корневых экранах (Вишлист, Друзья, Поиск, Брони, Уведомления, чужой вишлист); на формах, в настройках и в детали её нет. Landmark `complementary`. «Ближайшие даты» отложены (UX-A16) — когда вернутся, встанут сюда первой карточкой.
- **Диалоги по центру.** Confirm брони, видимость, подтверждения, форма желания — Dialog `{spacing.dialog-width}` (форма — до `{spacing.max-form}`). Деталь желания — Dialog до `{spacing.detail-width}` поверх сетки, URL меняется (`/gifts/{id}`), «назад» браузера = Esc. Разметка: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` = название. Открыт по прямой ссылке или после обновления — под ним вишлист владельца, фокус на заголовке; после закрытия фокус — на карточке этого желания, а если её нет — на `h1`.
- **«Куплю сам»** в детали — обычная кнопка внизу диалога, не прилипает.
- **Подсказка «Установите приложение»** (только браузер, UX-DR11): `{components.install-hint}` — иконка телефона, текст «Установите приложение: поиск друзей по контактам», ссылка «Google Play» (и «App Store» при `IOS_APP_PUBLISHED`), крестик. Место — одно правило для всех ширин: на wide — в правой колонке; на compact, medium и expanded — карточкой вверху «Найти знакомых» и вверху «Профиля» (на expanded — «Мой профиль»). Других мест нет. Крестик «Закрыть подсказку» 44×44; после закрытия фокус — на следующий элемент экрана, подсказка больше не показывается в этом браузере. В приложении на телефоне её нет.

### Мышь и клавиатура в браузере

- **Hover** (только при указателе, `@media (hover: hover)`): карточка — граница `primary`; пункт меню — фон `{colors.muted}`; кнопка — затемнение 8% (`primary-hover`, `accent-hover`, `destructive-hover` из раздела Colors), secondary — фон `{colors.accent-hover}`, outline — граница `{colors.foreground}` и фон `{colors.muted}`, ghost — фон `{colors.muted}`; у поля темнеет рамка, у чипов, ⋮ и toast вид не меняется, только курсор-указатель. Ничего не прячется за hover: все действия видны и на касании. Пункт меню (боковое меню и навигация) — настоящая ссылка с `hover:`-фоном и кольцом фокуса, а не текст без состояния.
- **Видимый фокус:** кольцо `{colors.ring}` 2 px с отступом 2 px на всём интерактивном — кнопках, полях, чипах, карточках, пунктах меню и текстовых ссылках (`LinkText`, `NavLink`), в браузере только при навигации с клавиатуры (`:focus-visible`). Отступ — цвет фона под элементом, без него кольцо вокруг primary-кнопки не видно. В Android/iOS с внешней клавиатурой — то же кольцо, но по состоянию `focus`: `:focus-visible` в React Native не наступает; кольцо на клик мышью включается только на вебе.
- **Фокус не перекрыт (2.4.11):** прокручиваемая область получает `scroll-padding-bottom` / `contentInset` = высота прилипших элементов (вкладки, «Куплю сам», кнопка формы, toast) + 8; элемент в фокусе докручивается в видимую зону (`scrollIntoView({block: 'nearest'})`). Если высота окна < 480 CSS px, шапка, «Куплю сам» и кнопка формы не прилипают и идут в потоке.
- **Порядок Tab:** ссылка «Перейти к содержимому» (первая, видна при фокусе; на всех ширинах и на Next-страницах) → боковое меню сверху вниз → заголовок и кнопки экрана → карточки слева направо, сверху вниз (внутри карточки: основная зона → чип видимости → ⋮) → правая колонка. На compact в браузере: «Перейти к содержимому» → шапка → контент → вкладки.
- **Клавиши:** Enter/Space — нажатие; Space — переключатель; стрелки — в меню, радио-группе и сегменте «Друзья · Подписки · Запросы»; Enter в форме — отправка, кроме многострочного поля.
- **Esc** закрывает верхний слой: меню, шторку, диалог, деталь; внутри диалога сначала возвращает прежний шаг. Фокус возвращается на элемент, который открыл слой, а если его уже нет — по правилу «Куда уходит фокус» в разделе Доступность. Черновик формы при Esc не теряется: если есть изменения — шаг «Сохранить изменения?» с «Сохранить» (сохраняет и уводит; при ошибках форма остаётся с ошибками), «Не сохранять» (уводит без сохранения) и крестиком «Закрыть» (Esc и клик по scrim — то же).
- **Фокус в слое:** при открытии диалога или шторки фокус на заголовке, Tab не выходит за пределы слоя.
- Своих сочетаний клавиш в R1 нет.

### Доступность

- **Браузер:** WCAG 2.2 AA для веб-сборки приложения и Next-страниц. Контраст — раздел Colors. Цель нажатия не меньше 24×24 по 2.5.8; у нас везде 44×44. Фокус не перекрыт — механизм в «Мышь и клавиатура».
- **Язык и заголовки страниц:** `<html lang>` = текущий язык (в пилоте `ru`) — в `app/+html.tsx` (expo-router) и `app/layout.tsx` (Next). `document.title` на каждом маршруте — «{Экран} — {BRAND_NAME}», у детали — «{название} — {BRAND_NAME}» (expo-router `Head`, Next `metadata`). После перехода фокус — на `h1` (`tabIndex=-1`), без дублирования live-регионом.
- **Landmarks и заголовки:** шапка — `banner`, меню и вкладки — `nav`, область контента — `main`, правая колонка — `complementary`. `h1` — экран; `h2` (`role="heading"`, `aria-level={2}`) — секции («Получено (N)», «Архив», «Недавние вишлисты»), карточки правой колонки, заголовки диалогов и шторок. В react-native-web `accessibilityRole="header"` по умолчанию даёт `h1`, поэтому уровень задаётся явно.
- **Куда уходит фокус, если открывший элемент исчез** (закрыли желание, приняли запрос, удалили карточку, забронировали, закрыли подсказку): (а) на «Отменить» в toast, если оно есть; иначе (б) на элемент, который его заменил (строка-пояснение вместо «Куплю сам», pill нового статуса); иначе (в) на следующий элемент списка, если его нет — на предыдущий; иначе (г) на `h1` экрана. Фокус никогда не уходит на `body`.
- **ToastHost:** постоянно смонтирован, два региона — вежливый и срочный. Браузер — `role="status"` и `role="alert"` (в DOM до появления текста); Android — `accessibilityLiveRegion` на хосте; iOS — ещё `AccessibilityInfo.announceForAccessibility`. Длительность и пауза — строка Toast выше.
- **Android и iOS:** у каждого интерактивного — `accessibilityRole`, `accessibilityLabel`, состояние (`accessibilityState`: selected, checked, disabled, expanded). Порядок TalkBack/VoiceOver совпадает с визуальным. Основная зона карточки читается одной фразой: «{название}, {цена}, {статус}, {теги}, {строка брони}, видимость {всем}»; превью фото в карточке декоративное (`accessible={false}`, `alt=""`), потому что название уже прочитано; чип и ⋮ — отдельные соседние элементы (см. WishCard). Ориентация не блокируется: `app.json` → `"orientation": "default"`.
- **Касание:** не меньше `{spacing.touch-target}` × `{spacing.touch-target}` на всех платформах; между соседними целями не меньше 8.
- **Движение** (DECISION 2026-11-10). Пресеты длительности — `quick` 160 мс и `medium` 240 мс (`packages/ui/src/animations.ts` и `animations.native.ts`). Шторка — сдвиг и fade **до 200 мс** (`quick`) на вебе и на телефоне: длительность задаётся явно, потому что нативный `Sheet` без `transition` берёт пружину ~0.5–0.8 с. Диалог и toast — fade `quick` при появлении и уходе (сейчас оба появляются мгновенно). Смена цвета и прозрачности на hover и press — `quick`; крупных движений нет: ни параллакса, ни scale больше 1.02, ни авто-анимаций, ни confetti. Скелетон статичный и в любом случае не мерцает дольше 5 с. **Правило:** все `transition` и анимации гейтятся «уменьшить движение» — в браузере `prefers-reduced-motion: reduce`, на телефоне `AccessibilityInfo.isReduceMotionEnabled`; в Tamagui это один медиа-ключ `reduce` (`media: { reduce: { prefersReducedMotion: "reduce" } }`), который читает обе платформы: веб — `window.matchMedia`, телефон — `@tamagui/react-native-media-driver` поверх `AccessibilityInfo`. Под `reduce` сдвиг, scale и смена раскладки выключаются, у слоёв остаётся только fade непрозрачности до 100 мс, hover и press меняют цвет мгновенно, индикатор ожидания у busy-кнопки не вращается (ожидание объявляется `aria-busy`).
- Смысл не передаётся одним цветом: pill — словом, чип видимости — словом и иконкой, ошибка — текстом.

## Next-страницы

Next.js + компоненты `packages/ui` с серверным рендером: CSS приходит в HTML первого ответа. Шрифты — Lora и Manrope через `next/font` с подмножествами `cyrillic` и `latin`. `lang` страницы — язык страницы, не жёстко `ru`. Своего UI вошедшего пользователя здесь нет (AD-17): вошедшего каждая страница передаёт в приложение.

Общий каркас `/l`, `/i`, `/unsubscribe`: `{components.next-header}` — логотип (`BRAND_NAME`, `display-sm`) слева; справа «Войти» (ghost) там, где вход уместен. Контент по центру, gutter как в приложении, без бокового меню; внизу футер со ссылкой «Написать автору». Сначала телефон (UX-DR10): первый показ — серверный HTML, без загрузки приложения. Доступность — как в приложении: `lang="ru"`, ссылка «Перейти к содержимому», `main`, `h1`. Заголовки страниц: «Вишлист {имя} — {BRAND}», «{Имя} приглашает в друзья — {BRAND}», «Отписка — {BRAND}», «Список не найден — {BRAND}».

| Страница | Вид | Действия |
|----------|-----|----------|
| **`/l/{token}`** — вишлист по ссылке | Имя владельца `display-sm`, @ник `caption`. Карточки — тот же Gift card, только желания «всем», без чипа видимости и без счётчика скрытых. Одна колонка до 600 px, дальше сетка до 3 колонок (`card-min`), ширина до `{spacing.max-wide}`. `h1` — имя владельца. Пусто — EmptyState «Пока нет открытых желаний». Невалидный токен или Block — «Список не найден» | **«Куплю сам»** у единичного открытого желания — ссылка `<a>` (`aria-label="Куплю сам: {название}"`, видимый текст тот же) → переход в приложение: без сессии — экран входа приложения с возвратом на этот вишлист и открытым confirm этого желания; «Зарегистрироваться» там же, дружба не создаётся. Есть сессия — сразу экран вишлиста в приложении. При установленном приложении ОС может открыть ссылку в нём (App Links / Universal Links). Мета-теги превью: имя владельца и бренд, без названий и фото желаний. Фото на карточках `/l` — только у желаний «всем» |
| **`/i/{token}`** — приглашение | `{components.next-panel}` по центру: Avatar `{spacing.avatar-lg}`, «{Имя} приглашает вас в друзья» (`display-sm`, `h1`), текст `body` — что даст дружба | Primary «Принять приглашение» → регистрация в приложении с токеном; ghost «У меня уже есть аккаунт» → вход. С сессией — сразу экран приложения «Добавить {имя} в друзья?». Невалидный токен и Block — «Приглашение не найдено». Состояния вошедшего (своя ссылка, уже друзья) — в приложении, `EXPERIENCE.md` → Flow 15 |
| **`/unsubscribe/{token}`** | `next-panel` по центру, без «Войти»: «Вы отписались от {тип писем}» (`heading`, `h1`), пояснение `body` | Secondary «Вернуть» → «Подписка возвращена» на месте (`role="status"`, фокус на этот текст). Ошибка «Вернуть» — «Не получилось. Попробуйте ещё раз.» под кнопкой. Невалидный токен — «Ссылка недействительна. Управлять письмами можно в настройках приложения.» Никаких данных аккаунта и ссылок внутрь |
| **`/admin`** | Компоненты `packages/ui`: боковое меню слева — «Подборки», «Теги»; таблицы — TanStack Table с `<caption>` (можно визуально скрытой) и `<th scope="col">`; формы в Sheet справа с обязательным заголовком; публикация — Switch с подписью; toast в `role="status"`. Бренд-цвета из токенов. Рассчитана на компьютер, от 1024 px; уже — одной колонкой, таблицы прокручиваются горизонтально внутри контейнера | Создать, изменить, опубликовать, снять с публикации. USER и аноним получают «не найдено» — без формы входа, чтобы не выдавать, что страница есть (Story 10.1, 10.2). Пустые таблицы — «Подборок пока нет» / «Тегов на модерации нет» |

## Do's and Don'ts

| Do | Don't |
|----|-------|
| Один primary action на экран | Стек CTA «оплатить / скинуться / куплю» в R1 |
| Accent — спокойная secondary и «ваша бронь» | Accent на навигации, логотипе, пустых состояниях |
| Lora — заголовки, точечно в теле экрана | Body в serif «для уюта» |
| На широком экране — меню, сетка, правая колонка, диалог по центру | Растянутый на 1440 px телефон с нижними вкладками |
| Зона касания 44×44 везде, фокус виден везде | Действия, доступные только по hover; `hitSlop` вместо настоящей зоны |
| Выбранный раздел — полоса, вес и цвет | Выбранный раздел только цветом |
| Фото ужато на устройстве, в базе только ключ | Хранить фото в базе или грузить исходник 5 МБ |
| Скрытые желания просто отсутствуют | «Ещё 3 желания скрыты», gate-панель, 404 вместо пустого |
| Копирование ссылки + toast «Ссылка скопирована» | Share-sheet, QR, ссылка на отдельное желание |
| Приглушать `закрыт` | Показывать `закрыт` как ошибку |
| Светлая и тёмная темы на одних токенах | Жёлтый/золотой акцент, градиентный CTA, glow, стекло |
| Подсказка установить приложение — одна, закрывается | Баннер на каждом экране, модалка «Скачайте приложение» |
| Системные шторки, выбор даты, жесты «назад» | Самодельный выбор даты на телефоне |
