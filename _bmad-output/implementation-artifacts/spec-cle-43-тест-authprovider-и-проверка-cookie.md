---
title: 'CLE-43: тест AuthProvider и проверка cookie в браузере'
type: 'chore'
created: '2026-11-01'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** После CLE-41 (Story 1.4, клиент) остались открытые пункты в `deferred-work.md`: `AuthProvider` (`apps/mobile/src/session/auth-context.tsx`) без теста — запрос `/api/v1/me` при запуске, удаление токена на `UNAUTHENTICATED`, `signOut`; и AC «веб-сборка: cookie и `Accept-Language` на `/api/v1/me`, без `Authorization`» не проверен в браузере с живым сервером. Задача без истории, Linear CLE-43.

**Approach:** Тест-рендер через `react-dom/client` (`createRoot` + `act` из `react`, обе копии — вложенные 19.3.0 в `apps/mobile/node_modules`) в DOM-среде `happy-dom` только для нового файла `auth-context.test.tsx`; `@testing-library/react` не ставим — он поднимется в корень к React 19.2.8 веба и даст две копии React. Единственная новая dev-зависимость — `happy-dom` в `@gift-list/mobile`, lock корневой. Браузерную проверку делает основная сессия (или человек, если нет локальной БД); пункт закрывается только по её результату.

</frozen-after-approval>

## Implementation Notes

- План утверждён в оркестраторе: реализация — `implementer`, проверки — `verifier`, ревью — `reviewer`.
- Файлы: новый `apps/mobile/src/session/auth-context.test.tsx` (8 тестов), `apps/mobile/vitest.config.ts` (`include` → `src/**/*.test.{ts,tsx}`, среда по умолчанию `node`), `happy-dom ^21.0.4` в `devDependencies` mobile, `package-lock.json` (+95 строк, только `happy-dom` и его зависимости).
- ESLint (`react-hooks/globals`) запрещает писать в переменную модуля из компонента, поэтому `Probe` отдаёт `useAuth()` колбэком из `useEffect`. JSX в `.tsx` работает с текущим tsconfig, правок не понадобилось.
- Первый прогон implementer: mobile `test` (34), `typecheck`, `lint` — зелёные. Полный прогон из корня не выполнен: `npm ci` в песочнице агента падает с heap out of memory, `node_modules` в worktree неполный.
- Браузерная проверка 2026-11-02: человек поднял PostgreSQL и `apps/web/.env`; веб-сборка через `sync-spa.mjs` + `next dev` на `localhost:3000`. Тестовый пользователь зарегистрирован, после перезагрузки `GET /api/v1/me` → 200 (в вебе токена нет — сессия по cookie). Перехват `fetch` на странице: запрос с `credentials: "include"`, `accept-language: ru`, без `authorization`. Пункт в `deferred-work.md` закрыт.
- `npm run build` на Windows падает в `sync-spa.mjs` (`spawnSync npm ENOENT`, нет `shell`). Для проверки правка ставилась временно и убрана; постоянный фикс — отдельная задача.

## Review Triage Log

- `probe` не сбрасывается между тестами — low, patch: `delete probe.auth` в `beforeEach`, чтение через `auth()` с ошибкой при пустом значении.
- `signOut` при не-сетевой ошибке API не покрыт — medium, patch: добавлен тест (UNAUTHENTICATED → токен очищен, `{ok:true}`).
- Не покрыт guard `cancelled` при размонтировании — low, отклонено: редкий путь, тест добавил бы управляемый промис ради гонки без пользовательского эффекта.
- Пограничные случаи часового пояса (сбой PUT, `null`-зона, `attempted`) — low, отклонено: вне скоупа CLE-43 (запрос `/me`, токен, `signOut`).
- `setUser` и начальный `loading` не проверены — low, отклонено: вне скоупа задачи.
- Браузерная проверка не сделана, а пункты помечены закрытыми — частично false: закрыт только пункт про тест; пункт про браузер остаётся открытым, это отражено выше.
- Третий пункт CLE-43 (строгий `meSchema`) не упомянут — false: в `deferred-work.md` он уже снят 2026-11-01.
- Нет записей о проверках — medium, patch: записаны выше вместе с тем, что не прогнано.
- Нет `resolve.dedupe` для React — maybe-false, отклонено: `dedupe` в Vite поднимет `react` из корня (19.2.8 веба), то есть сломает то, от чего защищает; вложенные копии фиксирует lock.
- `IS_REACT_ACT_ENVIRONMENT` не восстанавливается — false: Vitest изолирует файлы, флаг нужен на весь файл.
- LF→CRLF у `vitest.config.ts` — false: предупреждение `core.autocrlf` рабочей копии Windows, в индекс попадает LF.
