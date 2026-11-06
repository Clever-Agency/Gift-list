# CLE-62 — email вне URL экранов входа

Дата: 2026-11-06. Ветка: `evivanchikov/cle-62-auth-email-transient`, база — `2c16044` (CLE-52 / CLE-49). Коммит кода и спеки: `1601b74`.

## Что изменено

- Email больше не попадает в `href`/URL переходов вход → регистрация → сброс пароля. Ссылки несут только `next`.
- Удобный email передаётся одним слотом в памяти: `apps/mobile/src/session/auth-navigation.ts`. Слот привязан к целевому экрану (`/login`, `/register`, `/forgot`), живёт 60 секунд, читается атомарно (`consumeAuthEmail`) и очищается после чтения. Пустое значение и истёкший срок слот сбрасывают. URL, `history`, `localStorage`, `sessionStorage` и логи не используются.
- `apps/mobile/src/session/use-carried-auth-email.ts` читает перенос при фокусе экрана, поэтому работает и первый монтаж, и повторный фокус уже смонтированного маршрута Expo Router. Поле стартует пустым: перезагрузка, глубокий переход и возврат без состояния дают пустой email.
- `login.tsx`, `register.tsx`, `forgot.tsx`: убран `email` из `useLocalSearchParams`; `next` по-прежнему проходит через `returnPath`/`safeNextPath` без изменений; email запоминается в `onPress` ссылки.
- `nav-link.tsx`: необязательный `onPress` вызывается роутером до навигации; в комментарии описано, что изменённый клик/новая вкладка пропускают перенос.
- `auth-context.tsx`: успешный `signOut` (включая уже истёкшую сессию) сбрасывает ожидающий перенос.

## Файлы

- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/app/(auth)/forgot.tsx`
- `apps/mobile/src/session/auth-navigation.ts` (новый)
- `apps/mobile/src/session/use-carried-auth-email.ts` (новый)
- `apps/mobile/src/session/auth-email-transient.test.tsx` (новый)
- `apps/mobile/src/session/auth-context.tsx`
- `apps/mobile/src/session/auth-context.test.tsx`
- `apps/mobile/src/session/login-screen.test.tsx`
- `apps/mobile/src/session/password-rule.test.tsx`
- `apps/mobile/src/ui/nav-link.tsx`
- `_bmad-output/implementation-artifacts/spec-cle-62-auth-email-transient.md`

## Тесты

Новый `auth-email-transient.test.tsx` — 20 тестов:

- ссылки входа, регистрации и сброса не содержат `email`, `@` и `%40`;
- `next` сохраняется в ссылках и после переноса;
- опасный `next` (`https://`, `//`, `/\`) отбрасывается через `safeNextPath`;
- перенос работает login → forgot, login → register, register → login, forgot → login;
- чужой экран не забирает email (изоляция цели);
- перенос одноразовый, пустое значение сбрасывает слот, просроченный не отдаётся;
- глубокий `?email=` не заполняет поле на всех трёх экранах;
- повторное монтирование (перезагрузка) и повторный фокус ведут себя ожидаемо;
- нажатие ссылки не пишет email в адресную строку и storage.

Обновлены mock `useFocusEffect` в `login-screen.test.tsx` и `password-rule.test.tsx`; `auth-context.test.tsx` проверяет сброс слота при `signOut`.

## Команды и результаты

- `npm run test -w @gift-list/mobile -- src/session/auth-email-transient.test.tsx` — 20/20 passed.
- `npm run typecheck -w @gift-list/mobile` — passed.
- `npm run lint -w @gift-list/mobile` — passed.
- `npm run typecheck` (корень, все workspace) — passed.
- `npm run lint` (корень, включая `check-boundaries`) — passed.
- `npm test` (корень) — mobile 550, web 474, contracts 164, ui 70; `check-boundaries` 5/5 passed; всего 0 failed.
- `npm run build` (корень) — passed: Expo-web экспорт, Prisma generate, Next.js 16.4.3 production build, standalone-копирование.

## BMAD

- Использован `bmad-build` через установленный `uv` (`render_skill.py`), маршрут `oneshot` по scoped-спеке `spec-cle-62-auth-email-transient.md`; главная Story 1.6 не открывалась.
- Спека оставлена в `status: in-review`, не `done`: задача должна уйти на ревью, автоматический `Done` не ставился.
- `sprint-status.yaml`, Linear и приёмка эпика 1 не менялись. Исторический `epic-1-qa-report.md` с PASS для `?email=` задним числом не переписывался.
- Слепое ревью нашло 21 пункт; подтверждённые исправлены (атомарное чтение, цель + TTL, хук, очистка при выходе, тесты `next`, фокуса, глубоких ссылок, storage). Отложены только Q-31…Q-33 ниже.

## Ограничения

- Визуальная проверка в браузере, Android и iOS не проводилась; реальные переходы Expo Router на устройствах не проверялись — это unit-тесты с mock-роутером.
- Старые закладки `/login?email=…` поле больше не заполняют, но сам параметр из адресной строки не переписывается (Q-31).
- Экран `reset` вне области задачи: он работает с токеном, email ему не передаётся.
- Живая/общая БД, seed и миграции не использовались.

## Очередь

`_bmad-output/implementation-artifacts/opencode-microtasks/fixup-queue.md` обновлён и оставлен unstaged. Новые пункты CLE-62: Q-31 (старые `?email=` не вычищаются), Q-32 (нет проверки на реальных переходах/устройствах), Q-33 (исторический PASS в отчёте эпика 1).

Следующие подтверждённые fixup-пункты (не начинались): Q-01 (seed в деплое/CI), Q-02 (конверт ошибки каталога), Q-03 (доступное имя карточки), Q-04 (проверка на реальной PostgreSQL), затем Q-31/Q-32.

## Коммиты

- `1601b74` — `CLE-62: remove email from auth URLs` (код, тесты, спека).
- Отчёт — отдельным коммитом после этого файла.
