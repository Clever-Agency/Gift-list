---
title: 'Контакт автора — support@wishmoon.clever-agency.dev'
type: 'chore'
created: '2026-11-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** «Написать автору» ведёт на `clever.web.agency@gmail.com`. По одобренному `sprint-change-proposal-2026-11-18-domain-and-mailboxes.md` (D-35 в редакции 2026-11-18, D-48, AD-24) публичный контакт — `support@wishmoon.clever-agency.dev`.

**Approach:** Сменить единственный источник адреса — `AUTHOR_EMAIL` в `packages/contracts/src/brand.ts` — и проверку литерала в `brand.test.ts`. Ссылки в приложении (`apps/mobile/src/ui/author-link.tsx`) и на Next-страницах `/l`, `/i`, `/unsubscribe` (`public-page-footer.tsx`) — производные `AUTHOR_MAILTO`, их не трогаем. Константу `PRIVACY_EMAIL` не добавляем: она появится вместе с политикой (AD-24).

</frozen-after-approval>

## Implementation Notes

- Литерал старого адреса в коде был только в `brand.ts` и `brand.test.ts`; остальные тесты сравнивают с `AUTHOR_MAILTO`, stories — тоже через константу.
- Письма (`apps/web`) ссылку «Написать автору» сейчас не рендерят: ключ `email.writeToAuthor` в каталоге есть, но не используется. Требование «в письмах ведёт на support@» выполнится само, когда ссылка появится, — через ту же константу.
- После ревью: комментарии с «конфигурация (Q-2)» в `apps/mobile` (`config/env.ts`, `.env.example`, `invite/share-link.ts`, `wishlist/share-link.ts`, `wishlist/copy-link.ts`, `session/my-wishlist-screen.test.tsx`) переведены на AD-26 / D-48; шапка и комментарий `brand.ts` называют адрес ящиком поддержки (D-48).
- Проверки после `npm ci`: `typecheck`, `lint`, тесты всех воркспейсов (3204) и `build` зелёные. `scripts/generate-brand-icons.test.mjs` («перезапуск воспроизводит те же файлы») падает локально из-за `core.autocrlf=true`: хеш `site.webmanifest` с CRLF ≠ LF; файл этим изменением не затронут, тест переписывает два манифеста — они возвращены `git checkout`.

## Review Triage Log

- low, patch — в спайне нет D-48 во frontmatter и в `[ADOPTED]` AD-24/AD-26, `updated:` устарели (спайн, DESIGN, EXPERIENCE), чеклист без источника: исправлено.
- low, patch — правка AD-24 и подвал PRD не ссылаются на proposal: добавлены ссылки.
- low, patch — комментарии в коде ссылаются на закрытый Q-2: переведены на AD-26 / D-48.
- false — «AD-24 не называет переменную домена»: источник origin задаёт AD-26 и `docs/deployment-environments.md` (`BETTER_AUTH_URL`, `EXPO_PUBLIC_WEB_ORIGIN`); AD-24 на него ссылается.
- medium, defer — нет истории и серверного маршрута для веб-страницы запроса удаления (Google Play): `deferred-work.md`.
- low, defer — письма с `noreply@` без `Reply-To`: `deferred-work.md`; поведение существовало до правки.
- low, patch — D-48 «`noreply@` того же домена» расходится со staging-отправителем: уточнено в PRD и proposal.
- low, patch — критерий «в письмах» в proposal невыполним: уточнён в §4.6 proposal.
- false — «в спеке нет проверок»: маршрут oneshot, проверки записаны в Implementation Notes.
- low, patch — proposal обещал отдельный PR для кода: уточнено, что документы и код идут одним PR.
- low, reject — ссылки на строки в proposal сдвинулись на 1: снимок одобренного документа, каждая правка однозначно найдена по тексту.
- low, patch — комментарий `brand.ts` смешивал «автора» и поддержку: исправлено.
- false — DMARC `rua` на gmail: адрес отчётов, не публичный контакт; proposal §2 оставляет его осознанно.
