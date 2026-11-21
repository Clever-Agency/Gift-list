---
title: '6.2: Навигация приложения: вкладки, боковое меню, «назад» и ссылки'
type: 'feature'
created: '2026-11-22'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '5dfc91168de0859ea28f2198fcad290482b450fc'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics/epics-gift-list-2026-09-30/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Экраны Epic 1–5 живут в одном корневом `Stack`, без разделов: в «Мой вишлист» стоят временные строки «Поиск», «Друзья», «Мои брони» и «Настройки», «Выйти» висит в том же футере, а между экранами можно ходить только вперёд и системным «назад». Пользователь не видит, где он и что ещё доступно, на широком экране приложение остаётся растянутым телефоном, а `/l/*`, `/i/*` и `/wishlist/*` на телефоне не открывают нужный экран. UX-A13 и UX-DR4 задают пять разделов («Вишлист · Поиск · Друзья · Брони · Профиль») с нижними вкладками на compact/medium и боковым меню от expanded, но в коде нет ни вкладок, ни меню, ни `Badge`, ни `NavItem` (`packages/ui`), а `(app)` не имеет своего `_layout.tsx`.

**Approach:** Появляется оболочка навигации из двух уровней. `app/(app)/_layout.tsx` — `Stack` для вошедшей части: вкладки первым экраном и вложенные экраны (`gifts/*`, `settings`) поверх них. `app/(app)/(tabs)/_layout.tsx` — headless `Tabs` из уже установленного `expo-router/ui` (без новых пакетов): пять вкладок в порядке UX-A13, первая — «Вишлист», `backBehavior: "firstRoute"`. Оболочка `AppShell` из `packages/ui` на compact/medium показывает нижние вкладки, от `expanded` (1024 px) — боковое меню 264 px; обе навигации — настоящие ссылки/вкладки с `aria-current` и `selected`. «Профиль» получает собственный экран-меню (мой профиль, настройки, «Написать автору», «Выйти»), временные строки из «Моего вишлиста» убираются. `Badge` на «Друзьях» читает уже существующий `incomingCount` из `GET /api/v1/me/invites`. «Уведомления» (Story 6.1) и «Подборки» (Story 10.1) не показываются, пока разделов нет; колокольчик, «Недавние вишлисты», правая колонка и полный user-menu остаются на потом.

## Boundaries & Constraints

**Always:**
- Состав и порядок разделов — UX-A13 и `DESIGN.md` → App → «Навигация приложения»: **Вишлист → Поиск → Друзья (badge) → Брони → Профиль**. Первый маршрут вкладок — `index` (`/`), поэтому системное «назад» Android на корне любой вкладки сначала ведёт на «Вишлист», а на «Вишлисте» сворачивает приложение (`backBehavior: "firstRoute"`). В браузере у каждого экрана остаётся свой URL (`/`, `/search`, `/friends`, `/reservations`, `/profile`, `/settings`, `/gifts/:id`); SPA fallback и `apps/web/src/lib/spa-paths.ts` не меняются.
- Вкладки — headless `Tabs`/`TabList`/`TabTrigger`/`TabSlot` из `expo-router/ui` (пакет `expo-router` уже стоит). Никаких `@react-navigation/*`, `expo-router/js-tabs`, нативных `BottomTabBar` и новых зависимостей; новых пакетов в `package.json` нет. На web вкладки — `<nav aria-label="Разделы">` со ссылками и `aria-current="page"`; на Android/iOS — `accessibilityRole="tab"` и `accessibilityState.selected` (EXPERIENCE.md → Доступность → Навигация). Выбранный раздел не передаётся одним цветом: полоса 3 px `primary`, подпись 600 и `primary`, иконка `primary`.
- Нижние вкладки: `{components.tab-bar}`, высота `{spacing.tab-bar}` = 56 плюс safe area снизу, иконка `{spacing.icon-nav}` 24 и подпись `caption`; показываются на compact и medium (< 1024 px). Боковое меню: `{components.sidebar}` шириной `{spacing.sidebar}` = 264, от `expanded` (`{spacing.bp-expanded}` = 1024); сверху `BRAND_NAME` (`display-sm`), пункты `{components.nav-item}` с иконкой 24, текстом `label` и badge справа; внизу — карточка пользователя (Avatar, имя, `@ник`) и переход в «Профиль». Вкладки в этом режиме не показываются; колокольчика в шапке нет. Точки перехода — только существующие `media.medium`/`media.expanded`/`media.wide` из `packages/ui/src/config.ts`; новых брейкпоинтов нет, правая колонка `wide` не делается (Story 6.5).
- Вся новая разметка оболочки — компоненты `packages/ui` на Tamagui (AD-2): `Badge`, `NavItem` (варианты `tab` и `side`), `TabBar`, `Sidebar`, `AppShell`, `SkipLink`; тексты, иконки-узлы и данные приходят пропсами, в пакете нет API, env, Prisma и строк интерфейса. Иконки разделов — новые `Heart`, `Users`, `CalendarCheck`, `User` в `packages/ui/src/icons` (пара `*.tsx`/`*.native.tsx`, как `Search`); «Поиск» использует существующую `Search`. Библиотек иконок не добавляем. Экранные обвязки (маршруты, `TabTrigger`, активный пункт, счётчик) живут в `apps/mobile/src/navigation/**` и `app/**`.
- `AppShell` — единственное место с landmark `main` (`id="main-content"`, `tabIndex={-1}`) и ссылкой «Перейти к содержимому» (ключ `web.skipToContent`, уже в каталоге; новых текстов нет): skip-link идёт первым в DOM, ниже — боковое меню и контент, на compact — контент и вкладки. `SkipLink` на телефоне не рисуется. `TabBar` и `Sidebar` на web — `<nav>`/`role="navigation"` с подписью «Разделы»; на телефоне семантику несут сами пункты (`tab`/`link`).
- Экраны внутри вкладок ставят `SafeArea` с `bottom={false}` (новый необязательный проп, по умолчанию `true`): нижний inset уже держит `TabBar`; иначе home indicator складывается дважды. Вложенные экраны (`gifts/*`, `settings`, `u/[nick]`, `wishlist/[token]`, `invite/[token]`) остаются с полным `SafeArea`. `ToastHost` поднимается над вкладками: высота берётся из контекста `AppShell` (56 на compact/medium, 0 от `expanded`) и складывается с существующим `offsetBottom`; на вложенных экранах контекст равен 0.
- Badge «Друзья» — число входящих запросов из уже существующего `GET /api/v1/me/invites` (`incomingCount` в `CircleInvitesData`, клиент `fetchInvites`). Нового серверного маршрута нет. Число `> 0` рисуется в `Badge` (до «99+»), `0` или ошибка чтения — badge нет; ошибка не показывается пользователю и не блокирует навигацию. Полная подпись элемента — по ключу `app.nav.friendsBadge` («Друзья, N запросов»), badge входит в неё. Запрос идёт один раз при появлении оболочки и повторяется после собственных действий со запросами (принять, отклонить, отменить) и после `refresh()` из экрана «Друзья»; опроса и push нет (Story 6.1).
- «Профиль» — новый экран `app/(app)/(tabs)/profile.tsx` с защитой сессии, как у «Настроек» (`next=/profile`): строки «Мой профиль» → `/u/{nick}`, «Настройки» → `/settings`, «Написать автору» (существующий `AuthorLink`), «Выйти» (существующий `signOut`). «Подборки» не показываются (Story 10.1). «Выйти» переносится сюда из футера «Моего вишлиста»; временные строки «Поиск», «Друзья», «Мои брони», «Настройки» из футера удаляются вместе с `testID`-ожиданиями тестов. Ссылка на автора остаётся в футере «Моего вишлиста».
- Вкладки «Поиск» и «Друзья» — корневые экраны: их ручные ссылки «Назад» удаляются (корень вкладки не имеет «назад»; системная «назад» уводит на «Вишлист»). «Мои брони» — тоже корень: `onBack` у `ReservationsScreen` становится необязательным и не передаётся. «Настройки», деталь и форма остаются вложенными и сохраняют свои «Назад»/«К моему вишлисту»; `router.canGoBack() ? back() : replace("/")` остаётся правилом вложенных экранов.
- App Links и Universal Links: `app.config.ts` уже объявляет `giftlist://` и intent filters/associated domains для `/l/`, `/i/`, `/wishlist/`, `/reset`; `apps/web` уже отдаёт `.well-known/assetlinks.json` и `.well-known/apple-app-site-association` (`apps/web/src/lib/app-links.ts`). В приложении добавляются маршруты-двойники `app/l/[token].tsx` и `app/i/[token].tsx`, которые рендерят те же экраны, что `/wishlist/[token]` и `/invite/[token]` (не `redirect`, чтобы «назад» не проскакивал запись истории). `/wishlist/*` уже открывается SPA-маршрутом. Настоящая проверка ассоциаций в сторах, отпечатки и `APPLE_TEAM_ID` — вне 6.2 (CLE-108/CLE-85).
- Тексты — только из `packages/contracts/src/i18n/ru/*.json`, дословно из DESIGN/EXPERIENCE/epics, где они есть. Новые ключи — блок `app.nav.*` (см. «Design Notes → Тексты»). Новые строки, которых нет в источниках, перечислены в «Открытых вопросах» и в отчёте как «новые тексты, без утверждения в UX».
- Каждая подзадача: свои тесты, `npm run test -w <пакет>` затронутых пакетов, затем `npm run typecheck`, `npm run lint`. Новые компоненты `packages/ui` и `apps/mobile/src/ui` — с `displayName`, stories (`UI/…` и `App/…`) и проверкой 360 px/1280 px через `globals.viewport`; hover/focus не подделывать. Dev-серверы, Storybook, сборка и замер бандла — координатор, не подзадача.

**Never:**
- Экран, пункт и badge «Уведомления», колокольчик в шапке и любой badge уведомлений: это Story 6.1. «Подборки» (`/collections`, Story 10.1) и «Недавние вишлисты» (нет источника данных) тоже не появляются.
- Новые пакеты, `npm install`, `npx` с загрузкой, `@react-navigation/*`, `expo-router/js-tabs`, нативные `BottomTabBar`/`Drawer`, библиотеки иконок (lucide и т. п.), новый шрифт.
- Сервер, `apps/web/src/**` (кроме regression-теста `spa-paths.test.ts`), Prisma, миграции, env, `.well-known` (уже есть, не переписывать), `app.config.ts` (ссылки уже настроены), `apps/web/public/**`.
- Правки `_bmad-output/planning-artifacts/**` и `sprint-status.yaml`; изменение PRD/эпиков/архитектуры/UX без BMAD.
- Оплата, «Мои взносы», тёмная тема, share-sheet, OAuth, репорты/жалобы — A-24/UX-A8/D-34.
- Переписывание бизнес-логики экранов, смена API, контрактов, видимости, брони и уведомлений; смена URL существующих экранов.
- Per-tab stacks и подсветка вкладки на вложенных экранах (настройки, деталь, профиль): вложенные экраны — Stack поверх вкладок, панель скрыта; это зафиксировано открытым вопросом.
- Правая колонка `wide` с подсказкой установки (Story 6.5), полный user-menu в боковом меню (Story 6.3), двухпанельные «Друзья» (данные друзей), filled-варианты иконок активной вкладки.
- Цветовые/размерные токены вне `packages/ui/src/tokens.ts`; правка `tokens.ts` без нужды (все нужные значения — `sidebar` 264, `tab-bar` 56, `icon-nav` 24, `bp-*` — уже есть).
- Подключение к БД, миграции, Docker, dev-серверы, Storybook, `npm run build`, замер бандла внутри подзадач.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| TAB_OPEN | вошедший, приложение открылось | пять вкладок: Вишлист, Поиск, Друзья, Брони, Профиль; активна «Вишлист»; вложенных экранов нет | — |
| TAB_SWITCH | нажата «Друзья» | URL `/friends`, вкладка «Друзья» активна (полоса, 600, `primary`), «Вишлист» неактивна; состояние списка сохраняется | — |
| TAB_ROOT_BACK_ANDROID | Android, корень «Друзья», системная «назад» | открывается «Вишлист» (`firstRoute`), приложение не закрывается | — |
| TAB_ROOT_BACK_EXIT | Android, корень «Вишлист», «назад» | приложение сворачивается (нативное поведение) | — |
| NESTED_BACK | Android/iOS, `/settings` или `/gifts/:id`, «назад»/жест | закрывается верхний экран, возврат на экран, откуда пришли; «Вишлист»/«Профиль» остаётся в состоянии | — |
| TAB_ROOT_NO_BACK | «Поиск»/«Друзья»/«Брони» как вкладка | ручной ссылки «Назад» нет; футер броней не дублирует «К моему вишлисту» | — |
| WEB_URLS | браузер, переход по вкладкам | `/`, `/search`, `/friends`, `/reservations`, `/profile`; обновление страницы открывает тот же экран; «назад» браузера возвращает предыдущий URL | — |
| WIDE_LAYOUT | окно ≥ 1024 px | вкладок нет; боковое меню 264 слева, `BRAND_NAME` сверху, пять пунктов, карточка пользователя внизу; контент справа, не растянутый телефон | — |
| MEDIUM_LAYOUT | окно 600–1023 px | нижние вкладки; сетка/диалоги как раньше; бокового меню нет | — |
| COMPACT_LAYOUT | окно < 600 px | нижние вкладки, подписи caption, safe area снизу; контент не перекрыт панелью | — |
| BADGE_N | `incomingCount = 2`, вошедший | badge «2» на «Друзьях» (вкладка и пункт меню); подпись «Друзья, 2 запроса» | — |
| BADGE_LARGE | `incomingCount = 120` | на badge «99+»; подпись содержит фактическое число (120) | — |
| BADGE_ZERO | `incomingCount = 0` | badge не рисуется, подпись «Друзья» | — |
| BADGE_FAIL | сеть/ошибка чтения `/me/invites` | badge не появляется или остаётся последним известным; навигация работает, ошибки пользователю нет | тихо; повторится при следующем `refresh()`/запуске |
| BADGE_REFRESH | принят/отклонён/отменён запрос на «Друзьях» | `refresh()` после успешного действия; badge совпадает с ответом сервера | ошибка действия — существующие тосты 4.3 |
| ANON | нет сессии, прямой `/profile` | редирект на `/login?next=/profile`, как у «Настроек» | — |
| LOGOUT | «Выйти» в «Профиле» | сессия погашена, приложение анонимно; открывается вход с `next=/profile` | сеть — «Нет соединения. Попробуйте ещё раз.» |
| PROFILE_LINKS | «Профиль» | «Мой профиль» → `/u/{nick}`, «Настройки» → `/settings`, «Написать автору» → `mailto:`, «Выйти»; «Подборок» нет | — |
| DEEP_LINK_WISHLIST | App Link `/wishlist/tok` | открывается экран публичного вишлиста; «назад»/«К моему вишлисту» ведут на «Вишлист» | неверный токен — существующий not-found |
| DEEP_LINK_L | App Link `/l/tok` на телефоне | тот же экран, что `/wishlist/tok`; URL истории не переписывается | неверный токен — существующий not-found |
| DEEP_LINK_I | App Link `/i/tok` на телефоне | тот же экран приглашения, что `/invite/tok`; после принятия — «Друзья» | неверный токен — существующий not-found |
| LINK_BACK | открыт App Link, «назад» | возврат на корень вкладок («Вишлист»), а не выход из приложения | — |
| A11Y_WEB | браузер, Tab | «Перейти к содержимому» первым; затем `nav` «Разделы», пункты — ссылки, активный `aria-current="page"`; контент `main#main-content`; фокус-кольцо `ring` | — |
| A11Y_NATIVE | Android/iOS, TalkBack/VoiceOver | вкладки `role="tab"`, `selected` у активной, подпись с badge; порядок совпадает с визуальным; зона 44×44 | — |
| SAFE_AREA | iPhone с home indicator, вкладки | панель стоит над индикатором; контент не складывает нижний inset дважды | — |
| TOAST_OFFSET | тост на экране вкладки | тост поднят над панелью на её высоту; на широком экране смещения нет | — |
| HIDDEN_SECTIONS | любой экран | нет «Уведомлений», «Подборок», «Моих взносов», оплаты и тёмной темы | — |
| FORM_DETAIL | `/gifts/new`, `/gifts/:id`, `/settings` | панель вкладок скрыта, экран занимает весь кадр, «назад» возвращает в раздел | — |
| UNKNOWN_PATH | путь вне маршрутов | существующий `+not-found`, оболочка не ломается | — |
| W360 | 360 px, длинные русские подписи | вкладки не переполняются; боковое меню не показывается | — |

</frozen-after-approval>

## Open Questions

1. **«Уведомления» (Story 6.1) — решено: не показывать.** AC Story 6.2 перечисляет «Уведомления» с badge, но раздела, маршрута `/notifications` и центра уведомлений ещё нет; пункт, ведущий в пустоту, хуже его отсутствия. Колокольчик и пункт меню появятся в 6.1 без ломки оболочки: у `AppShell`/`SidebarNav` остаётся место. Пока AC 6.2 в этой части закрывается только 6.1 — зафиксировать при приёмке.
2. **«Подборки» (Story 10.1) — решено: не показывать.** В «Профиле» пункта нет; он появится после 10.1.
3. **Подсветка вкладки на вложенных экранах — консервативно.** `EXPERIENCE.md` хочет «вкладка остаётся подсвеченной», но вложенные экраны (`/settings`, `/gifts/:id`, `/u/:nick`) живут в `Stack` поверх вкладок, поэтому панель скрыта и подсвечивать нечего. Деталь и формы по DESIGN и так прячут вкладки; для «Настроек» это отклонение. Возврат сохраняет вкладку-раздел (история стека), но без видимой панели. Per-tab stacks — отдельное решение после 6.2 (открытый вопрос, не делать сейчас).
4. **Боковое меню: карточка пользователя — простая ссылка в «Профиль».** `DESIGN.md` описывает карточку → `{components.user-menu}` (email, профиль, настройки, автор, выход). Готового user-menu нет, `OverflowMenu` открывает шторку снизу и для desktop не подходит. Консервативно: карточка (Avatar, имя, `@ник`) — ссылка на вкладку «Профиль», где те же действия строками. Полный user-menu — 6.3.
5. **«Недавние вишлисты» — решено: не делать.** В приложении нигде не хранится история просмотренных вишлистов; источник данных не описан ни в одном документе. Пункт вернётся вместе с данными/6.5.
6. **Badge: свежесть и цена запроса.** `fetchInvites` отдаёт обе страницы запросов (по 15), а не только счётчик. Консервативно используем его: дополнительный запрос при старте оболочки и после действий. Число от других пользователей обновится при следующем запуске/действии; push и периодический опрос — 6.1. Отдельный `countOnly`-маршрут — возможная оптимизация, но это серверная работа вне 6.2.
7. **Активная иконка вкладки не «залитая».** Есть только stroke-иконки; активное состояние несут полоса 3 px, вес 600 и цвет `primary` (не только цвет). Filled-варианты — если UX настоит, отдельная история иконок.
8. **`SafeArea bottom={false}` — расширение существующего пропса.** Вкладки держат нижний inset, поэтому экраны вкладок его не дублируют. API необязательный, по умолчанию `true`; вложенные экраны и веб не меняются.
9. **`/l` и `/i` — маршруты-двойники, а не редирект.** `redirect` заменил бы запись истории и «назад» из публичного экрана выходил бы из приложения; двойник рендерит тот же экран под исходным App-Link-путём. На вебе `/l` и `/i` остаются Next-страницами (`spa-paths.ts`), двойники работают только в приложении.
10. **«Назад» после `/i` ведёт на «Вишлист», а не на «Друзья».** Корень стека — вкладки с первой «Вишлист»; после принятия приглашения экран сам уводит в «Друзья». Если продукт захочет иное, это меняет `initialRouteName` deep link — отдельное решение.
11. **Заголовки экранов.** Экраны продолжают задавать `document.title`/title через `<Stack.Screen options={{ title }}>`; внутри вкладок это ближайший навигатор (`Tabs`), поэтому title применяется к экрану вкладки. Проверить в браузере вручную; если title не обновится — это не AC 6.2, а долг 6.4.
12. **Стрелка «Назад» в шапке.** Сейчас вложенные экраны показывают текст «Назад» (уже в каталоге и доступен диктору). Стрелка в `AppHeader` — визуальное требование DESIGN, но полноценной шапки в 6.2 нет; откладывается до 6.3/6.4, чтобы не переписывать заголовки всех экранов.
13. **Новые тексты без утверждения в UX:** `app.nav.myProfile` «Мой профиль» (в DESIGN это пункт списка «мой профиль»), формы множественного числа для `app.nav.friendsBadge` («1 запрос / 2 запроса / 5 запросов»). Остальные строки дословно из источников или уже в каталоге.

## Code Map

Порядок волн: **A → (B ∥ C) → D → E → F**. A создаёт все компоненты и тексты; B и C не пересекаются по файлам и ждут только A; D — самая большая волна, ждёт B и C; E и F идут после D. Внутри D файлы `app/(app)/(tabs)/*` перемещаются (старые пути удаляются) — это одна волна, чтобы дерево маршрутов оставалось рабочим.

### A — общие компоненты навигации и тексты (packages)
- `packages/contracts/src/i18n/ru/app.json` — блок `app.nav`: `sections` «Разделы», `wishlist` «Мой вишлист», `wishlistTab` «Вишлист», `search` «Поиск», `friends` «Друзья», `reservations` «Мои брони», `reservationsTab` «Брони», `profile` «Профиль», `myProfile` «Мой профиль», `friendsBadge` «Друзья, {count, plural, one {# запрос} few {# запроса} many {# запросов} other {# запроса}}».
- `packages/contracts/src/i18n/i18n.test.ts` — строки дословные/непустые; `friendsBadge` на 1/2/5; «Разделы».
- `packages/ui/src/badge.tsx` + `.test.tsx` + `.stories.tsx` — `Badge({ count })`: число, `99+`, не рисуется при `0`; декоративен (`aria-hidden`), число входит в подпись родителя; stories normal/99+/360.
- `packages/ui/src/nav-item.tsx` + `nav-item.native.tsx` + `.test.tsx` + `.stories.tsx` — пункт навигации: `label`, `secondary?`, `icon`, `badge?`, `selected`, `isFocused?` (приходит от `TabTrigger asChild` и считается активностью), `variant: "tab" | "side"`, `href?`, `onPress?`; web — настоящая ссылка (`<a href>`, `aria-current="page"` только у активного, фокус-кольцо), переход делает сама ссылка; native — `Pressable` `role="tab"` + `accessibilityState.selected`, `accessibilityLabel` с badge, переход по `onPress`. Tab: колонка, иконка 24 + caption 12, полоса 3 px сверху у активного, `minHeight` 56; side: строка, `minHeight` 44, полоса 3 px слева, фон `muted` у активного. `displayName`; stories: tab normal/active/с badge/длинная кириллица, side normal/active, 360.
- `packages/ui/src/tab-bar.tsx` + `tab-bar.native.tsx` + `.test.tsx` + `.stories.tsx` — `nav aria-label` пропсом, дети-пункты, верхняя граница `border`, фон `surface`, safe area снизу только на native; story с пятью пунктами и badge, 360.
- `packages/ui/src/sidebar.tsx` + `.test.tsx` + `.stories.tsx` — колонка 264, логотип-текст (`brand`, `display-sm`), дети-пункты, `footer?` (карточка пользователя); на web — landmark навигации, story 1280 и длинная кириллица.
- `packages/ui/src/app-shell.tsx` + `.test.tsx` + `.stories.tsx` — `sidebar`, `tabBar`, `skipLabel`, дети: `SkipLink` первым, строка «сайдбар + main» и панель вкладок; `media.expanded` переключает видимость через `useMedia`; `main id="main-content" tabIndex={-1}`; контекст высоты панели (`useTabBarInset`); `tabBar` остаётся смонтированным и на широком экране (скрыт стилем), иначе `TabList` перестанет регистрировать маршруты вкладок; stories compact 360, medium 768, expanded 1280, с badge и длинными подписями.
- `packages/ui/src/skip-link.tsx` + `skip-link.native.tsx` + `.test.tsx` + `.stories.tsx` — web: скрытая до фокуса ссылка `href="#main-content"`, фокус переводит на `main`; native: `null`; story «нажмите Tab».
- `packages/ui/src/safe-area.tsx` + `safe-area.native.tsx` + `safe-area.types.ts` + `safe-area.test.tsx` + `safe-area.stories.tsx` — необязательный `bottom?: boolean` (по умолчанию `true`); native `edges` без `bottom` при `false`; web не меняется; story «экран вкладки без нижнего inset».
- `packages/ui/src/icons/Heart.tsx`/`.native.tsx`, `Users.tsx`/`.native.tsx`, `CalendarCheck.tsx`/`.native.tsx`, `User.tsx`/`.native.tsx` — Lucide-глифы 24, как `Search`; `packages/ui/src/icons/index.ts` — экспорт; `packages/ui/src/index.ts` — экспорт новых компонентов, иконок и `useTabBarInset`.
- `packages/ui/src/component-names.test.tsx` правок не требует: имена проверяются автоматически.

### B — данные badge «Друзья»
- `apps/mobile/src/navigation/invite-badge.tsx` — `InviteBadgeProvider` + `useInviteBadge()`: при `auth.ready` один `fetchInvites()`, `count = incomingCount`; `refresh()` повторяет чтение; при ошибке первого чтения `null`, при повторной — последнее известное число; 401 не показывает badge, сессию ведёт существующий `AuthContext`. Без polling, `AppState`, push.
- `apps/mobile/src/navigation/invite-badge.test.tsx` — успех, 0, 99+, сеть, 401, повторный `refresh`, один запрос на монтирование, отсутствие запроса у анонима.

### C — боковое меню
- `apps/mobile/src/navigation/sidebar-nav.tsx` — пункты меню из `app.nav.*` (те же иконки/порядок, что вкладки), активный по `usePathname` (точное совпадение корня), карточка пользователя из `useAuth` (Avatar, имя, `@ник`) — ссылка `/profile`; переиспользует `Sidebar`/`NavItem` из A. `displayName`.
- `apps/mobile/src/navigation/sidebar-nav.test.tsx` — пять пунктов, активный пункт, badge, карточка ведёт в `/profile`, длинное имя не обрезается, аноним/ошибка сессии.

### D — вкладки, экраны, «Профиль»
- `apps/mobile/app/(app)/_layout.tsx` — новый `Stack` вошедшей части (`headerShown: false`, фон темы): `(tabs)` первым, ниже `gifts/*` и `settings` (вложенные экраны поверх вкладок).
- `apps/mobile/app/(app)/(tabs)/_layout.tsx` — `Tabs` из `expo-router/ui` с `backBehavior: "firstRoute"`; `InviteBadgeProvider`; `AppShell` с `TabBar` (внутри `TabList` пять `TabTrigger` → `NavItem`) и `Sidebar` (`SidebarNav`); `TabSlot`; `skipLabel` из `web.skipToContent`.
- `apps/mobile/app/(app)/index.tsx` → `apps/mobile/app/(app)/(tabs)/index.tsx` — «Мой вишлист» как вкладка; `SafeArea bottom={false}`; из футера убраны временные «Поиск», «Друзья», «Мои брони», «Настройки» и «Выйти», остаётся ссылка автора; `Stack.Screen` с title сохраняется.
- `apps/mobile/app/(app)/friends.tsx` → `...(tabs)/friends.tsx` — корень вкладки: ссылка «Назад» удалена, `SafeArea bottom={false}`, после успешных действий со запросами зовёт `refresh()` badge; всё остальное (сегменты, списки, меню) не переписывается.
- `apps/mobile/app/(app)/search.tsx` → `...(tabs)/search.tsx` — корень вкладки: «Назад» удалена, `SafeArea bottom={false}`.
- `apps/mobile/app/(app)/reservations.tsx` → `...(tabs)/reservations.tsx` — корень вкладки: `SafeArea bottom={false}`, не передаёт `onBack`; поведение списка/действий 5.5 сохраняется.
- `apps/mobile/app/(app)/(tabs)/profile.tsx` — новая вкладка «Профиль»: защита сессии (`next=/profile`), заголовок, `ProfileMenu`.
- `apps/mobile/src/ui/profile-menu.tsx` + `.test.tsx` + `.stories.tsx` — презентационное меню: «Мой профиль» (`/u/{nick}`), «Настройки» (`/settings`), «Написать автору», «Выйти» (destructive); `displayName`, story 360 и длинная кириллица.
- `apps/mobile/src/navigation/tab-items.ts` + `.test.ts` — закрытый список пяти разделов: ключ, href, иконка, ключи подписей вкладки и меню, признак badge; порядок и первый `index`.
- `apps/mobile/src/ui/reservations-screen.tsx` + `.stories.tsx` — `onBack` необязательный; без него ссылки «К моему вишлисту» нет; story `ReservationsScreen` без back (остальные состояния не меняются).
- `apps/mobile/src/ui/toast.tsx` + `.test.tsx` — `ToastHost` прибавляет `useTabBarInset()` к `offsetBottom`; вне `AppShell` контекст 0.
- `apps/mobile/src/session/my-wishlist-screen.test.tsx`, `friends-screen.test.tsx`, `search-screen.test.tsx`, `reservations-screen.test.tsx` — импорты с новых путей, отсутствие временных строк/«Назад»/футера броней, сохранение остальных сценариев.
- `apps/mobile/src/session/my-profile-screen.test.tsx` — сессия, ссылки строк, выход, сеть выхода, 360.

### E — ссылки, «назад» и URL
- `apps/mobile/app/l/[token].tsx` — маршрут-двойник: `export { default } from "../wishlist/[token]";` (тот же экран публичного вишлиста под App-Link-путём).
- `apps/mobile/app/i/[token].tsx` — маршрут-двойник экрана приглашения.
- `apps/mobile/src/navigation/app-link-routes.test.tsx` — `l/[token]` и `i/[token]` — те же компоненты, что `wishlist/[token]`/`invite/[token]`; `+not-found` не задействован; `token` читается тем же `useLocalSearchParams`.
- `apps/web/src/lib/spa-paths.test.ts` — regression: `/profile` и `/friends` идут в SPA fallback; `/l/*`, `/i/*`, `/.well-known` остаются Next-owned; `spa-paths.ts` не меняется.

### F — документация
- `_bmad-output/implementation-artifacts/deferred-work.md` — новая секция Story 6.2 с пунктами из «Отложено».
- `sprint-status.yaml`, `_bmad-output/planning-artifacts/**` — **не трогать**.

## Tasks & Acceptance

### A — общие компоненты навигации и тексты
- [ ] `packages/contracts/src/i18n/ru/app.json` + `i18n.test.ts` — блок `app.nav.*`, дословные строки, plural badge.
- [ ] `Badge` + тест/story — число, 99+, ноль, подпись родителя.
- [ ] `NavItem` (web/native) + тест/story — ссылка/`aria-current`, `role="tab"`/`selected`, tab/side, badge, 360, длинная кириллица.
- [ ] `TabBar`, `Sidebar`, `AppShell` + тесты/stories — 264, 56, 1024, landmark `main`, `useTabBarInset`, compact/medium/expanded.
- [ ] `SkipLink` (web/native) + тест/story — первый фокус, `#main-content`, на телефоне `null`.
- [ ] `SafeArea` `bottom={false}` + тест/story.
- [ ] Иконки `Heart`, `Users`, `CalendarCheck`, `User` (web/native) и экспорты `packages/ui/src/index.ts`.
- [ ] `npm run test -w @gift-list/contracts`, `-w @gift-list/ui`; `npm run typecheck`, `npm run lint`.

### B — данные badge
- [ ] `InviteBadgeProvider`/`useInviteBadge` + тесты — один запрос, `incomingCount`, `refresh`, ошибки, 401, 99+.
- [ ] `npm run test -w @gift-list/mobile`.

### C — боковое меню
- [ ] `SidebarNav` + тест — пять пунктов, активный, badge, карточка → `/profile`, длинное имя.
- [ ] `npm run test -w @gift-list/mobile`.

### D — вкладки и экраны
- [ ] `(app)/_layout.tsx`, `(tabs)/_layout.tsx` — Stack + Tabs, `firstRoute`, `AppShell`, `SidebarNav`, `TabBar`, `InviteBadgeProvider`, `TabSlot`, title.
- [ ] Перемещение `index`, `friends`, `search`, `reservations` в `(tabs)`; удаление временных строк футера и «Назад» на корнях; `SafeArea bottom={false}`.
- [ ] `profile.tsx` + `ProfileMenu` + тест/story — «Мой профиль», «Настройки», «Написать автору», «Выйти»; «Подборок» нет.
- [ ] `tab-items.ts` + тест — порядок, href, иконки, подписи, badge.
- [ ] `reservations-screen` без `onBack`; `toast` с высотой панели.
- [ ] Тесты экранов с новыми путями; `my-profile-screen.test.tsx`; 360.
- [ ] `npm run test -w @gift-list/mobile`; `npm run typecheck`, `npm run lint`.

### E — ссылки, «назад» и URL
- [ ] `app/l/[token].tsx`, `app/i/[token].tsx` + тест тождества экранов.
- [ ] `spa-paths.test.ts` — `/profile` в SPA, `/l`/`/i`/`.well-known` не в SPA.
- [ ] `npm run test -w @gift-list/mobile`, `-w @gift-list/web`.

### F — документация
- [ ] `deferred-work.md` — секция Story 6.2.
- [ ] Никаких правок `sprint-status.yaml` и planning-artifacts.

**Acceptance Criteria:**
- Given вошедший пользователь, when открывает приложение, then видит пять разделов «Вишлист · Поиск · Друзья · Брони · Профиль»; активный раздел отмечен не только цветом; временных строк в «Моём вишлисте» и «Выйти» в футере больше нет.
- Given compact или medium, when окно уже 1024 px, then нижние вкладки с safe area; given expanded/wide, then боковое меню 264 и нет нижних вкладок; контент не растянут как телефон.
- Given Android и корень любой вкладки, when системная «назад», then открывается «Вишлист»; на «Вишлисте» приложение сворачивается; given вложенный экран, then «назад»/жест закрывает его и возвращает в раздел.
- Given браузер, when переход по вкладкам, then URL `/`, `/search`, `/friends`, `/reservations`, `/profile`, обновление страницы и «назад» работают; SPA fallback не изменился.
- Given входящие запросы, when badge читает `incomingCount`, then число (до «99+») видно на «Друзьях» и входит в подпись «Друзья, N запросов»; при 0/ошибке badge нет; после действий на «Друзьях» число обновляется.
- Given App Link `/l/tok`, `/i/tok`, `/wishlist/tok`, when приложение открыто, then показывается соответствующий экран, а «назад» ведёт на корень вкладок, не наружу.
- Given браузер и клавиатура, when Tab с начала страницы, then первым доступна «Перейти к содержимому», затем `nav` «Разделы» со ссылками и `aria-current` у активного, затем `main`; given TalkBack/VoiceOver, then вкладки объявлены как `tab` с `selected`.
- Given iPhone с home indicator, when экран вкладки, then нижний inset не удваивается, тост поднят над панелью.
- Given любой экран, when проверка, then нет «Уведомлений», «Подборок», «Моих взносов», оплаты и тёмной темы; приложение не сломано отсутствием 6.1/10.1.
- Given `npm run typecheck`, `npm run lint` и тесты пакетов, when проверка, then зелёные; новых зависимостей, миграций и серверных изменений нет.

## Implementation Notes

— (заполняется при реализации)

## Spec Change Log

- 2026-11-22 (CLE-117, рамки координатора): спека Story 6.2; headless `Tabs` из `expo-router/ui` без новых пакетов; пять разделов UX-A13, первая «Вишлист», `backBehavior: "firstRoute"`; `AppShell`/`TabBar`/`Sidebar`/`NavItem`/`Badge` в `packages/ui`; «Профиль» — новый экран-меню, временные строки футера убираются; badge «Друзья» на существующем `incomingCount`; «Уведомления»/«Подборки»/«Недавние вишлисты»/user-menu/правая колонка не делаются; `/l` и `/i` — маршруты-двойники; `SafeArea bottom={false}` и высота тоста над вкладками; вложенные экраны остаются Stack поверх вкладок (подсветка вкладки — открытый вопрос).

## Review Triage Log

— (заполняется при ревью)

## Design Notes

**Что уже есть в коде.** Корневой `app/_layout.tsx` — один `Stack` с `headerShown: false`; `(app)` без своего `_layout.tsx`. Маршруты: `/`, `/search`, `/friends`, `/settings`, `/reservations`, `/gifts/new`, `/gifts/:id`, `/gifts/:id/edit`, `/u/:nick`, `/wishlist/:token`, `/invite/:token`, анонимные `(auth)` и `+not-found`. Переходы — временные строки в футере «Моего вишлиста» (`wishlist-search`, `wishlist-friends`, `wishlist-reservations`, `wishlist-settings`, `wishlist-logout`) и текстовые «Назад» на экранах. Системная «назад» Android и жест iOS уже закрывают экраны `Stack`; в браузере URL и обновление страницы уже работают через SPA fallback, но корневого правила «с вкладки — на Вишлист» нет, потому что вкладок нет; `/l/*` и `/i/*` в приложении пока не открываются — для них нет маршрутов. В `packages/ui` нет `Badge`, `TabBar`, `Sidebar`, `NavItem`, `AppShell`, `SkipLink`; иконки — только `AlertTriangle`, `Check`, `CheckCircle`, `CircleAlert`, `Close`, `Eye`, `EyeOff`, `Info`, `Moon`, `Search`, `Star`. `SafeArea` не умеет отключать нижний inset. `ToastHost` уже принимает `offsetBottom`. `GET /api/v1/me/invites` уже отдаёт `incomingCount` (`CircleInvitesData`), клиент — `fetchInvites`. `app.config.ts` уже объявляет associated domains/intent filters для `/l/`, `/i/`, `/wishlist/`, `/reset`; `apps/web` уже отдаёт оба `.well-known`. Токены `sidebar` 264, `tab-bar` 56, `bp-expanded` 1024 и media `expanded` уже есть. Значит, 6.2 — сборка оболочки и маршрутов, а не новые серверные или контрактные возможности.

**Почему headless `Tabs`, а не `expo-router/js-tabs` и не нативная панель.** Нативная нижняя панель приносит свою шапку, свои стили и safe area, которые пришлось бы перекрывать; `js-tabs` тянет готовую панель с не нашим визуалом. Headless `Tabs` из `expo-router/ui` даёт только навигатор, состояние вкладок, URL и `backBehavior`, а вид рисуют `TabBar`/`NavItem` из `packages/ui` по DESIGN. Это же сохраняет один визуальный язык на телефоне и в браузере. `backBehavior: "firstRoute"` — ровно правило «на корне вкладки Android сначала на Вишлист, потом сворачивает»; первый маршрут поэтому обязан быть `index`.

**Почему вложенные экраны — Stack поверх вкладок.** Деталь и формы по DESIGN прячут вкладки; настройки и чужой профиль открываются «поверх раздела». Один общий Stack даёт корректное системное «назад» и не требует дублировать одни и те же маршруты под каждой вкладкой. Цена — панель вкладок скрыта и на настройках/профиле, поэтому «вкладка остаётся подсвеченной» не видно; возврат всё равно попадает в прежнюю вкладку (её состояние в навигаторе сохраняется). Per-tab stacks — отдельное решение: они потребуют переносить `u/[nick]` и деталь в каждый стек или дублировать маршруты, что противоречит «один экран — один URL».

**Почему `/l` и `/i` — двойники, а не редирект.** App Link приходит с путём `/l/{token}`. `redirect` на `/wishlist/{token}` заменил бы запись истории: «назад» из списка вышло бы из приложения, а не вернулось на «Вишлист». Двойник рендерит тот же экран по исходному пути — история цела, публичный экран сам ведёт в нужный раздел. На вебе `/l` и `/i` остаются Next-страницами и в SPA не попадают (`spa-paths.ts`), поэтому двойники не конфликтуют с AD-26.

**Почему badge читает `/me/invites`.** Счётчик входящих уже существует и уже используется экраном «Друзья»; отдельный маршрут только ради числа — серверная работа без пользы для 6.2. Запрос один на оболочку и повтор после собственных действий: этого достаточно, чтобы badge не врал после принятия/отклонения, а чужие запросы подтянутся при следующем запуске. Push, опрос и real-time — 6.1.

**Почему «Профиль» — экран-меню.** `DESIGN.md` перечисляет в «Профиле» мой профиль, подборки, настройки, автора и выход. Полный user-menu в боковом меню требует отдельного popover-компонента и повторяет те же действия; консервативно все строки живут на экране «Профиль», а карточка в боковом меню ведёт туда же. «Подборки» появятся после 10.1, «Уведомления» — после 6.1, без переделки оболочки.

**Safe area и тост.** Панель вкладок стоит в колонке `AppShell` ниже контента и сама держит нижний inset; экран внутри вкладки не должен добавлять его второй раз, поэтому `SafeArea` получает необязательный `bottom={false}`. Тост живёт в экране и позиционируется от низа окна; чтобы он не оказался под панелью, `AppShell` публикует высоту панели контекстом, а `ToastHost` прибавляет её к своему `offsetBottom`. На вложенных экранах контекста нет — смещение 0, прежнее поведение.

**Тексты.** Дословно из источников: «Разделы» (EXPERIENCE → Навигация/`aria-label`), «Вишлист», «Поиск», «Друзья», «Брони», «Профиль», «Мой вишлист», «Мои брони» (DESIGN → Навигация, UX-A13), «Настройки» (`app.settings.title`), «Написать автору» (`common.writeToAuthor`), «Выйти» (`app.myWishlist.logout`), «Перейти к содержимому» (`web.skipToContent`). Новые, без утверждения в UX: «Мой профиль» (`app.nav.myProfile`) и формы множественного числа `app.nav.friendsBadge` («Друзья, 1 запрос / 2 запроса / 5 запросов»); шаблон «Друзья, N запроса» взят из DESIGN → Badge. Их список продублирован в отчёте.

**Бюджет веб-бандла.** Запас по правилам ночи — около 53 байт прироста; в него 6.2 не помещается. Оценка: headless-навигатор `expo-router/ui` с `TabRouter`/`TabSlot`/`TabTrigger` — примерно 6–10 КиБ gzip; оболочка, шесть компонентов, четыре иконки, экран «Профиль» и его чанк — примерно 6–10 КиБ gzip. Итого ориентир **12–20 КиБ gzip**; точный замер делает координатор. Новых зависимостей и целых библиотек нет, `js-tabs`/нативные панели не тянутся, иконки — по одному глифу, новые маршруты используют существующие экраны. Потолок предлагается поднять на 24 КиБ отдельным коммитом координатора; если замер окажется меньше, шаг можно уменьшить. Внутри подзадач `npm run build` и `measure-web-size` не запускаются.

**Доступность.** Web: `nav` с подписью «Разделы», настоящие ссылки, `aria-current="page"`, skip-link первым, `main#main-content`, фокус-кольцо; активное состояние — полоса + вес + цвет. Native: `role="tab"`, `accessibilityState.selected`, подпись с числом запросов, зона 44. Фокус после смены вкладки — на `h1` экрана (существующее правило), панель не перехватывает фокус. Hover/focus не подделываются: в stories показываются настоящие состояния.

## Отложено

- Экран, маршрут `/notifications`, колокольчик и badge уведомлений — Story 6.1.
- «Подборки» в «Профиле» и маршрут `/collections` — Story 10.1.
- «Недавние вишлисты» в боковом меню: нет источника данных (история просмотров нигде не хранится) — вместе с данными/6.5.
- Полный user-menu бокового меню (email, профиль, настройки, автор, выход в popover) — Story 6.3; сейчас карточка ведёт в «Профиль».
- Правая колонка `wide` с подсказкой установки — Story 6.5 (UX-DR11).
- Per-tab stacks и видимая подсветка вкладки на вложенных экранах (настройки, чужой профиль, деталь) — открытый вопрос; сейчас Stack поверх вкладок.
- Filled-иконки активной вкладки — отдельная история иконок, если UX настоит.
- Push/опрос badge и уведомлений, real-time — Story 6.1.
- Двухпанельные «Друзья» на `wide` (`FriendsTwoPane`) — когда появится запрос вишлиста выбранного друга.
- Проверка App Links/Universal Links в сторах, отпечатки `ANDROID_SHA256_CERT_FINGERPRINTS`, `APPLE_TEAM_ID`, публикация — CLE-108/CLE-85 и выкладка; 6.2 только маршруты.
- Стрелка «Назад» и общая шапка приложения — 6.3/6.4; сейчас текстовые «Назад» вложенных экранов.
- Отдельный `countOnly`-маршрут счётчика запросов — оптимизация после 6.1, если цена `fetchInvites` станет заметной.
- E2E-прогон нативных вкладок и системного «назад» на устройстве — ручная проверка/6.4; в CI только unit/typecheck/lint.

## Verification

**Commands:**
- `npm run test -w @gift-list/contracts` — `app.nav.*`, plural badge, дословные строки.
- `npm run test -w @gift-list/ui` — `Badge`, `NavItem` (web/native), `TabBar`, `Sidebar`, `AppShell`, `SkipLink`, `SafeArea bottom={false}`, иконки, `displayName`.
- `npm run test -w @gift-list/mobile` — badge, sidebar-nav, tab-items, экраны с новых путей, профиль, тост над вкладками, `/l`/`/i`, 360.
- `npm run test -w @gift-list/web` — `spa-paths.test.ts`: `/profile` в SPA, `/l`/`/i`/`.well-known` у Next.
- `npm run typecheck` — без ошибок.
- `npm run lint` — без ошибок, `check-boundaries` чист (нет импорта `apps/web` из `apps/mobile`, нет `"tamagui"`).
- `npm test` — все пакеты зелёные.
- `npm run build` и `node scripts/measure-web-size.mjs` — выполняет координатор в конце; ожидаемый прирост 12–20 КиБ gzip, потолок поднимается отдельным коммитом. В подзадачах сборка не запускается.

**Manual checks (после мерджа, только staging/локально):**
- Телефон (Android): вкладки снизу; переходы; «назад» с «Друзей» ведёт на «Вишлист», с «Вишлиста» сворачивает; из детали/настроек «назад» возвращает в раздел; safe area и тост над панелью.
- iPhone: жест «назад» на вложенных экранах; панель над home indicator; шторки/диалоги не перекрыты.
- Браузер 360/768/1024/1280: вкладки до 1023, меню 264 от 1024; URL у каждого экрана; обновление страницы и «назад»; Tab: skip-link → «Разделы» → контент; `aria-current` у активного.
- Badge: второй аккаунт отправляет запрос — после перезапуска/действия на «Друзьях» badge «1»; принять запрос — badge исчезает; 0 и обрыв сети — badge нет.
- «Профиль»: «Мой профиль» открывает `/u/{nick}`, «Настройки» — `/settings`, «Написать автору» открывает почту, «Выйти» уводит на вход; после повторного входа возвращает в «Профиль».
- Deep links (dev build/`adb`): `/l/{token}`, `/i/{token}`, `/wishlist/{token}` открывают нужный экран; «назад» — «Вишлист»; `/settings` и `/gifts/:id` после прямого открытия возвращаются на корень вкладок.
- 360 px и длинная кириллица: подписи вкладок, меню, карточка пользователя не переполняются; фокус и клавиатура в браузере работают.
