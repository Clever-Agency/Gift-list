---
name: Gift List
description: "Веб-вишлист с двумя списками видимости и бронью «куплю сам». shadcn/ui + Next.js + Tailwind; этот DESIGN.md — brand-layer delta для Раунда 1."
status: final
created: 2026-09-30
updated: 2026-10-05
language: ru
workflow: bmad-ux
round: 1
palette: forest-paper
sources:
  - "{planning_artifacts}/prds/prd-gift-list-2026-09-30/prd.md"
  - "{planning_artifacts}/briefs/brief-gift-list-2026-09-29/brief.md"
colors:
  # Brand overrides поверх shadcn. Неперечисленные токены — defaults shadcn.
  # Locked: вариант C «Forest Paper» (подтверждено Sergey 2026-09-30).
  primary: '#2F5D3A'
  primary-foreground: '#F7FAF7'
  accent: '#D4A017'
  accent-foreground: '#1E241F'
  background: '#F4F1EA'
  foreground: '#1E241F'
  muted: '#E8E4DA'
  muted-foreground: '#5C6358'
  border: '#D9D3C6'
  ring: '#2F5D3A'
  # Семантические статусы подарка (не brand-chrome)
  status-open: '#2F5D3A'
  status-reserved: '#9A7609'
  status-closed: '#5C6358'
  destructive: '#B42318'
  destructive-foreground: '#FFFFFF'
typography:
  display:
    fontFamily: 'Fraunces'
    fontSize: 36px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: '-0.02em'
  display-sm:
    fontFamily: 'Fraunces'
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'DM Sans'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'DM Sans'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
  caption:
    fontFamily: 'DM Sans'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.35'
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  full: 9999px
spacing:
  # Tailwind/shadcn 4-based; именованные якоря контента
  page-gutter: 16px
  page-gutter-lg: 24px
  section-gap: 32px
  card-padding: 16px
  max-content: 720px
  sidebar: 264px
components:
  sidebar:
    background: '#FFFFFF'
    border-right: '1px solid {colors.border}'
    width: '{spacing.sidebar}'
    padding: '16px 12px'
  nav-item:
    foreground: '{colors.foreground}'
    radius: '{rounded.md}'
    padding: '9px 10px'
    active-background: '{colors.muted}'
    active-foreground: '{colors.primary}'
  user-menu:
    background: '#FFFFFF'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  button-reserve:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
  gift-card:
    background: '#FFFFFF'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
  status-pill-open:
    background: '{colors.muted}'
    foreground: '{colors.status-open}'
    radius: '{rounded.full}'
  status-pill-reserved:
    background: '#F5E6B8'
    foreground: '{colors.status-reserved}'
    radius: '{rounded.full}'
  status-pill-closed:
    background: '{colors.muted}'
    foreground: '{colors.status-closed}'
    radius: '{rounded.full}'
  friends-only-gate:
    background: '#FFFFFF'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '32px'
---

# Gift List — Design Spine

> **[DECISION] Палитра C — Forest Paper** подтверждена Sergey (2026-09-30). Рабочее имя «Gift List» остаётся до финального бренда/домена (Q-2 name only). Spines выигрывают у mockups при конфликте.
> [ASSUMPTION: UX-A1] Наследует shadcn/ui; здесь только brand-layer delta.
> [ASSUMPTION: UX-A8] Light-first; dark mode вне Раунда 1.

## Brand & Style

Gift List — тихий координатор подарков для узкого круга: ясность статуса важнее «праздничного» шума. Визуальный тон — «домашний вишлист на бумаге»: forest green (`{colors.primary}`) для доверия и навигации; mustard gold (`{colors.accent}`) — только сигнал «занято / бронь», не декор chrome. Фон `{colors.background}` — тёплый бумажный; карточки остаются белыми, чтобы список читался как записи на листе.

Продукт наследует shadcn/ui wholesale. Этот файл задаёт delta: primary/accent, display-типографика, семантику статусов подарка и пару brand-компонентов. Остальные примитивы (Button secondary/ghost, Input, Dialog, Sheet, Toast, Tabs, Avatar, Separator) — defaults shadcn без кастомизации.

Избегать: фиолетовых градиентов, glow, emoji в UI chrome, multi-layer shadows, pill-кластеров на hero, terracotta как второго brand-цвета (accent — mustard, не глина).

## Colors

- **Primary Forest (`{colors.primary}`)** — бренд и доверие. Primary-кнопки, активная навигация, ссылки, фокус-кольцо (`{colors.ring}`).
- **Reserve Mustard (`{colors.accent}`)** — только бронь и CTA «Куплю сам». Не для hover chrome, не для иконок навигации, не для декора.
- **Background (`{colors.background}`)** — тёплый paper (`#F4F1EA`); не чистый белый wall.
- **Карточки** — белый `#FFFFFF` на paper-фоне для лёгкого тонального разделения без теней-иерархий.
- **Статусы:** `открыт` → `{colors.status-open}`; `забронирован` → `{colors.status-reserved}` + фон `#F5E6B8`; `закрыт` → `{colors.status-closed}` (приглушённо, без «ошибки»).
- **Destructive** — удаление подарка, блок, снятие чужой брони владельцем. Не использовать для «закрыт».

Не раздувать палитру: два brand-цвета + семантические статусы. Остальное — muted/border/foreground выше.

## Typography

- **Display (`Fraunces`)** — редкий акцент: empty-state заголовки, имя владельца на Профиле и на экране Ссылки на список, заголовок «Мои списки». Не для body, не для кнопок.
- **UI (`DM Sans`)** — body, labels, captions, формы, навигация.
- Иерархия: один `display` / `display-sm` на экран; ниже — `body` / `label` / `caption`.
- Цифры цены — tabular lining в `DM Sans`, суффикс «₽» через неразрывный пробел.

## Layout & Spacing

- **App shell:** от 900px — постоянный левый sidebar шириной `{spacing.sidebar}` (264px), контент сдвинут вправо; ниже 900px sidebar — drawer (см. Components → Sidebar).
- Максимальная ширина контента: `{spacing.max-content}` (720px). Gift List — не wide dashboard.
- Gutter: `{spacing.page-gutter}` на mobile, `{spacing.page-gutter-lg}` от `md`.
- Вертикальный ритм секций: `{spacing.section-gap}`.
- Список подарков — одна колонка карточек; на `lg` допускаются две колонки **только** на экране владельца «Мои списки» (две панели Discoverable / Friends-only рядом). На mobile — Tabs или stacked секции.
- Нижний sticky bar на mobile для primary CTA карточки подарка («Куплю сам»), если экран — деталь подарка; прижат к низу экрана (нижней tab-bar нет).

## Elevation & Depth

Минимум. Карточки опираются на border + белый fill, не на multi-shadow. Dialog/Sheet — стандартный shadcn overlay. Hover на gift-card: лёгкое усиление border (`{colors.primary}` at 20% opacity), без lift-анимации «карточки вверх».

## Shapes

`{rounded.sm}` — inputs; `{rounded.md}` — кнопки; `{rounded.lg}` — gift-card, gate-панели, dialogs. `{rounded.full}` — **только** status pills и badge непрочитанных. Не делать все кнопки pill.

## Components

Наследуют shadcn as-is: `Button` (secondary, outline, ghost, destructive), `Input`, `Textarea`, `Dialog`, `Sheet`, `Toast`, `Tabs`, `Avatar`, `Separator`, `DropdownMenu`, `Badge` (кроме status-pill ниже).

Brand-layer:

| Компонент | Визуал | Когда |
|-----------|--------|-------|
| **Button primary** | `{colors.primary}` / `{colors.primary-foreground}`, `{rounded.md}` | Сохранить, Принять дружбу, Войти, Копировать ссылку (после копирования — toast, кнопка не «success green») |
| **Button reserve** | `{colors.accent}` / `{colors.accent-foreground}` | Единственный CTA «Куплю сам» |
| **Gift card** | Белый fill, border, `{rounded.lg}`, padding `{spacing.card-padding}` | Строка/карточка подарка: название, опц. цена, status pill, имя бронировавшего если `забронирован` |
| **Status pill** | `open` / `reserved` / `closed` токены выше | Всегда рядом с названием подарка; одинаков для владельца и дарителя |
| **Sidebar** | Белый fill, `border-right`, 264px; логотип (Fraunces 22px), основные пункты `nav-item` (иконка 22px + label 15px, badge справа), секция «Недавние списки» (заголовок caption uppercase, строки с Avatar 28px + имя + @ник), низ — карточка пользователя | App shell для auth-экранов ≥900px; на меньших — drawer с scrim; активный пункт — фон `muted`, текст/иконка `primary`, без accent |
| **User menu** | Popover вверх от карточки пользователя, `{components.user-menu}`; email (caption), Настройки, Мой профиль, Связаться с нами, разделитель, Выйти (`destructive`) | Клик по карточке пользователя в sidebar |
| **Tabs (Друзья)** | shadcn Tabs, подчёркивание `primary` у активной, счётчик (`caption`) или badge у «Запросы» | Страница Друзья: «Друзья» / «Запросы» |
| **Friends-only gate** | Центрированная панель `{components.friends-only-gate}` | Валидная Friends-only-ссылка для не-друга / после входа не-друга — **не** blank, **не** «не найдено» |
| **List type chip** | Outline muted: «Открытый» / «Только друзья» | Метка типа списка на владельческом экране и на Ссылке на список |

## Do's and Don'ts

| Do | Don't |
|----|-------|
| Один primary action на экран | Стек CTA «оплатить / скинуться / куплю» в R1 |
| Accent только для брони | Accent на sidebar, логотипе, пустых состояниях |
| Fraunces — точечно | Body в serif «для уюта» |
| Объяснение Friends-only на gate-панели | Маскировать отказ под 404 / пустой список |
| Копирование ссылки + toast «Ссылка скопирована» | Share-sheet, QR, per-gift links |
| Приглушать `закрыт` | Выглядеть как ошибка / destructive |
| Paper-фон + белые карточки | Dark mode, purple gradients, glow |
| Mustard как единственный тёплый акцент брони | Terracotta / второй «праздничный» accent |
