---
title: '4.7.4: Экран приглашения, регистрация по приглашению и «Скопировать ссылку-приглашение»'
type: 'feature'
created: '2026-11-16'
status: 'done'
route: 'dispatch'
baseline_commit: 'c355b55'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Домен (4.7.1), API и клиент (4.7.2), Next-страница (4.7.3) готовы, но в приложении `/invite/[token]` — заглушка: вошедший видит только «Приглашение» и ссылку на главный. Регистрация не передаёт `inviteToken`, поэтому дружба по ссылке не создаётся, а на «Моём вишлисте» нет «Скопировать ссылку-приглашение» из IA (`EXPERIENCE.md` стр. 55).

**Approach:** Экран `/invite/[token]` читает превью через `getInvitePreview` (4.7.2) и показывает закрытые состояния `can_accept | self | friends` (AD-21, EXPERIENCE 228–230, Flow 15); «Добавить» — единственный путь к `acceptInvite`, после успеха toast «{имя} теперь в друзьях» и `replace` в профиль. Регистрация передаёт `inviteToken` только для `next=/invite/{token}`. «Мой вишлист» получает кнопку копирования `{origin}/i/{token}` тем же способом, что ссылка `/l` (Story 2.4). Тексты — в `packages/contracts/src/i18n/ru/app.json` (`invite.*`).

## Boundaries & Constraints

**Always:** Экраны и UI — только `packages/ui`/Tamagui, без новых библиотек и без `StyleSheet`; тексты — только ключи каталога `app.json`; имя — `displayName` из превью (AD-24), бренд — `getBrandName()`. Аноним на `/invite/{token}` — прежний редирект на `/register?next=/invite/{token}`. `GET` превью и загрузка экрана ничего не создают: `acceptInvite` вызывается ровно один раз и только по нажатию «Добавить»; «Отмена» не создаёт ничего. Неизвестный токен и Block — один текст «Приглашение не найдено.» без имени. Ошибка сети при загрузке — toast «Нет сети. Попробуйте ещё раз.» и повтор по образцу соседних экранов. `inviteToken` уходит в `POST /api/v1/register` только когда `next` — ровно `/invite/{token}` (`/wishlist/...` после `safeNextPath` и любой другой `next` — без токена). Копирование — `getMyInviteLink()` + `{origin}/i/{token}`, без share-sheet; при отказе — toast об ошибке, успех не выдумывается.

**Never:** Не менять API, домен, схему, миграции, Next-страницу `/i/[token]`, PRD/UX/architecture/epics, `sprint-status.yaml`. Не трогать `apps/web`, кроме генерируемого `apps/web/public` сборочным скриптом. Не подключаться к БД, не применять миграции, не ставить пакеты, не запускать Docker/Storybook/dev-серверы. Не настраивать нативные App Links. Не рефакторить соседние экраны «заодно»; на профиле и других экранах поведение не меняется.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| GATE_ANON | аноним, валидный сегмент | `replace('/register?next=/invite/{token}')`; загрузка/ошибки сессии — как сейчас | — |
| GATE_MALFORMED | `..`, `a/b`, `%2f`, >128 | общий 404 приложения, запроса нет | — |
| PREVIEW_LOADING | сессия готова, ответ в пути | skeleton формы под ожидаемый layout | — |
| PREVIEW_CAN_ACCEPT | `state: can_accept` | Avatar, «Добавить {имя} в друзья?», primary «Добавить», ghost «Отмена»; accept не вызван | — |
| ACCEPT_ONE_PRESS | нажатие «Добавить» | `acceptInvite(token)` один раз; `FRIENDS`/`ALREADY_FRIENDS` → toast «{имя} теперь в друзьях» → `replace('/u/{nick}')` после закрытия toast | повторное нажатие игнорируется; сеть → toast «Нет сети…», ребро не показано |
| CANCEL | «Отмена» | `back()`, иначе `replace('/')`; запросов нет | — |
| PREVIEW_SELF | `state: self` | «Это ваша ссылка-приглашение. Отправьте её друзьям.» + «Скопировать» | копирование → `{origin}/i/{token}` + toast «Ссылка-приглашение скопирована»; отказ → toast об ошибке |
| PREVIEW_FRIENDS | `state: friends` | «Вы уже друзья с {имя}.» + «Открыть вишлист» → `/u/{nick}` | — |
| PREVIEW_NOT_FOUND | `NOT_FOUND`/Block/`invalid` | «Приглашение не найдено.» + ссылка на главный, без имени | — |
| PREVIEW_NETWORK | сеть/битый ответ | toast «Нет сети. Попробуйте ещё раз.», экран повтора | «Повторить» повторяет чтение |
| REGISTER_TOKEN | `next=/invite/tok` | тело `POST /api/v1/register` несёт `inviteToken: "tok"` | — |
| REGISTER_NO_TOKEN | нет `next`, `/wishlist/tok`, `/l/tok` | поля `inviteToken` в теле нет | — |
| OWNER_COPY_INVITE | «Мой вишлист», список любой | кнопка «Скопировать ссылку-приглашение» рядом со «Скопировать ссылку», не зависит от «всем»-желаний | успех/отказ — toast как у ссылки `/l` |

</frozen-after-approval>

## Code Map

- `apps/mobile/app/invite/[token].tsx` — заглушка: оставить редирект анонима, заменить содержимое вошедшего.
- `apps/mobile/app/wishlist/[token].tsx`, `app/u/[nick].tsx` — образцы состояний загрузки/ошибки/not found, toast, `SessionLoadingScreen size="form"`, `replace` в профиль.
- `apps/mobile/src/api/invite-link.ts` — `getInvitePreview`, `acceptInvite`, `getMyInviteLink` (4.7.2, не менять).
- `apps/mobile/src/wishlist/{share-link,copy-link}.ts` — образец построения и копирования `{origin}/l/{token}` (Story 2.4).
- `apps/mobile/src/platform/clipboard.ts` — `copyText`, только через него.
- `apps/mobile/app/(app)/index.tsx` — шапка «Мой вишлист», `copyLink`, `ToastHost`; кнопка приглашения — рядом со «Скопировать ссылку».
- `apps/mobile/app/(auth)/register.tsx` — `next` через `returnPath` (`safeNextPath`), тело `registerBodySchema`; добавить `inviteToken` только для `/invite/{token}`.
- `packages/contracts/src/auth.ts` — `registerBodySchema.inviteToken` (≤`INVITE_TOKEN_MAX`) уже есть.
- `apps/mobile/src/session/invite-screen.test.tsx` — тесты гейта сессии, расширить все состояния.
- `apps/mobile/src/session/{my-wishlist-screen,confirm-password}.test.tsx` — образцы тестов копирования и тела регистрации.
- `packages/contracts/src/i18n/ru/app.json` — `invite.*`; `myWishlist.copyInviteLink`, `myWishlist.copyLinkFailed` переиспользуется.

## Tasks & Acceptance

**Execution:**
- [x] `apps/mobile/src/invite/invite-route.ts` (+ test) — `inviteRoute` (сегмент `/invite/:token`) и `inviteTokenFromNext` (`/invite/{token}`).
- [x] `apps/mobile/src/invite/share-link.ts` (+ test) — `inviteShareLink` = `{origin}/i/{token}` по образцу `/l`.
- [x] `apps/mobile/src/invite/copy-link.ts` (+ test) — `copyMyInviteLink`: `getMyInviteLink` → `inviteShareLink` → `copyText`; `copied | failed`.
- [x] `apps/mobile/app/invite/[token].tsx` — экран по матрице; `acceptInvite` только по нажатию; toast + `replace` в профиль.
- [x] `apps/mobile/app/(app)/index.tsx` (+ test) — «Скопировать ссылку-приглашение» рядом со «Скопировать ссылку».
- [x] `apps/mobile/app/(auth)/register.tsx` (+ test) — `inviteToken` только для `next=/invite/{token}`.
- [x] `packages/contracts/src/i18n/ru/app.json` — `invite.*` (расширить, неиспользуемое убрать), `myWishlist.copyInviteLink`.
- [x] `apps/mobile/src/session/invite-screen.test.tsx` — все состояния, «accept ровно один раз и только по нажатию», «Отмена ничего не создаёт», копирование.
- [x] Бюджет: сначала компактность; при превышении — анализ gzip-diff по чанкам, исправление лишнего; оправданный рост — отдельным коммитом шагами по 1024 Б с числами.

**Acceptance Criteria:**
- Given аноним и валидный токен, when открывает `/invite/{token}`, then `replace('/register?next=/invite/{token}')`, как раньше.
- Given `can_accept`, when экран загружен, then «Добавить {имя} в друзья?», Avatar, «Добавить» и «Отмена», и `acceptInvite` не вызван.
- Given `can_accept`, when нажимает «Добавить», then ровно один `acceptInvite`; после успеха toast «{имя} теперь в друзьях» и `replace('/u/{nick}')`.
- Given `self` / `friends` / not found, when экран загружен, then свои тексты EXPERIENCE 228–230 и свои действия; `acceptInvite` не вызван.
- Given ошибка сети превью, when чтение завершилось, then toast «Нет сети. Попробуйте ещё раз.» и повтор.
- Given `next=/invite/{token}`, when регистрация отправлена, then тело несёт `inviteToken`; given другой `next` или его нет, then поля нет.
- Given «Мой вишлист», when нажимает «Скопировать ссылку-приглашение», then в буфере `{origin}/i/{token}` и toast «Ссылка-приглашение скопирована».
- Given `npm test -w @gift-list/mobile`, `npm test -w @gift-list/contracts`, `npm run typecheck`, `npm run lint`, `npm run build`, `node scripts/measure-web-size.mjs`, when выполняются, then exit 0; рост бандла объяснён и в пределах потолка или потолок поднят отдельным коммитом по правилу.

## Implementation Notes

- Выполнено 2026-11-16, ветка `evivanchikov/cle-73-invite`, база `c355b55`. Коммиты: `feat(invite): invite screen, invite registration and copy invite link (CLE-73)` — код, тесты, спека; отдельный `chore(budget): …` — потолок бандла.
- `bmad-build` пройден по шагам 01–03 без чекпойнта утверждения и независимого ревью (автономный запуск по промпту координатора; ревью — 4.7.5). Реализация — напрямую по спеке, без субагента: правки строго ограничены бюджетом и набором файлов.
- Экран: `inviteRoute` проверяет сегмент до запроса (как `publicWishlistRoute`); превью читается только при готовой сессии, аноним сохраняет прежний редирект на `/register?next=/invite/{token}`. `acceptInvite` вызывается только из обработчика «Добавить»; `acceptInFlight` и `busy` не дают создать второе ребро повторным нажатием. `ALREADY_FRIENDS` — тот же успех, что `FRIENDS` (контракт 4.7.2).
- Toast после принятия живёт на экране приглашения, а приложение не имеет глобального toast-хоста: переход в профиль ждёт закрытия toast (образец — «Заблокировать» в 4.5), иначе сообщение не успевает прочитаться и не объявляется диктором. `replace` — на `/u/{nick}` из превью.
- Истёкшая сессия (`UNAUTHENTICATED`) снимается через `auth.signOut()` и уходит в тот же анонимный редирект на регистрацию с токеном: так экран сохраняет поведение заглушки Story 1.4, а не открывает вход, которого в этой истории нет.
- Имя везде — литерал `displayName` из превью (AD-24): «Добавить Сергей в друзья?» и «Вы уже друзья с Сергей.» склонения не получают. Текст ровно из EXPERIENCE 228–230; вопрос о склонении — Сергею.
- Регистрация: `inviteTokenFromNext` принимает только `^/invite/{segment}$` без query/fragment/percent и с `safeNextPath(next) === next`; `/l/:token` (уже переписанный в `/wishlist/:token`) и любой другой `next` токен не отправляют (AD-15-11).
- «Мой вишлист»: кнопка `variant="secondary"` в той же строке действий, сразу после пары «Скопировать ссылку» + Info; доступна и в пустом, и в приватном вишлисте (ссылка-приглашение не зависит от PUBLIC-желаний). Тексты — `myWishlist.copyInviteLink`, `invite.copyDone`; ошибка — общий `myWishlist.copyLinkFailed`. Точный текст toast в UX не задан («Ссылка скопирована» только для `/l`), взят «Ссылка-приглашение скопирована» — вопрос Сергею.
- i18n: `invite.*` (`pageTitle`, `toHome`, `addTitle`, `add`, `cancel`, `self`, `copy`, `copyDone`, `friends`, `openWishlist`, `acceptDone`, `notFound`, `network`), `myWishlist.copyInviteLink`; неиспользуемый `invite.title` удалён, тексты загрузки/повтора взяты из `myWishlist`, чтобы не дублировать каталог.
- Avatar — локальный `InviteAvatar` из примитивов `@gift-list/ui` (`avatar-lg`, `muted`, инициалы), как на Next-странице 4.7.3: компонента Avatar в `packages/ui` нет, новый компонент пакета потребовал бы stories и раздул бы бюджет.
- Тесты: `src/invite/invite-route.test.ts` (14), `src/invite/copy-link.test.ts` (9: ссылка + копирование), `src/session/invite-screen.test.tsx` (15 состояний экрана), `src/session/invite-registration.test.tsx` (3), три теста ссылки-приглашения в `my-wishlist-screen.test.tsx`.
- Бюджет: прирост 181 640 → **184 266** байт (+2 626), потолок `BUDGET_GROWTH_BYTES` 182 272 → **184 320** (+2 шага по 1024) отдельным коммитом. Новый чанк `/invite` — 2 378 байт gzip, остальное — регистрация, «Мой вишлист» и строки каталога; файлов JS по-прежнему 18, новых зависимостей и целых библиотек нет.

