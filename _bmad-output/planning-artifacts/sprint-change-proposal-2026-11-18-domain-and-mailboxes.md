---
title: "Sprint Change Proposal — домен WishMoon и служебные почты support@ / privacy@"
date: 2026-11-18
language: ru
workflow: bmad-correct-course
mode: batch
scope: minor
status: approved
approved: 2026-11-18
approver: Sergey
initiator: Sergey
trigger: "Владелец купил домен и настроил почты (2026-11-18): прод `https://wishmoon.clever-agency.dev`, staging `https://staging.wishmoon.clever-agency.dev`; `support@wishmoon.clever-agency.dev` — техподдержка, `privacy@wishmoon.clever-agency.dev` — запросы на удаление аккаунта"
source: "PRD §7 (D-35), §11 (Q-2, Q-8), §12; ARCHITECTURE-SPINE.md AD-24, Deferred, ARCH-A2; DESIGN.md:332; EXPERIENCE.md:357, :559; pre-release-checklist.md п. 4, 6, 7; docs/deployment-environments.md; README.md; packages/contracts/src/brand.ts"
---

# Sprint Change Proposal — 2026-11-18, домен и служебные почты

## 1. Суть

**Что запустило.** Sergey сообщил (2026-11-18), что домен куплен и подключён, а для приложения заведены два почтовых ящика:

| Что | Значение |
| --- | --- |
| Прод | `https://wishmoon.clever-agency.dev` |
| Staging | `https://staging.wishmoon.clever-agency.dev` |
| Техподдержка | `support@wishmoon.clever-agency.dev` |
| Удаление аккаунта и приватность | `privacy@wishmoon.clever-agency.dev` |

**Что расходится с документами.**

- Домены уже записаны в `docs/deployment-environments.md`, но в планировании вопрос о домене Q-2 всё ещё открыт (PRD §11, AD-24, ARCH-A2, Deferred, DESIGN, EXPERIENCE, пункт 7 чеклиста).
- Публичный контакт по D-35 и AD-24 — `clever.web.agency@gmail.com`. Он записан в константе `AUTHOR_EMAIL` в `packages/contracts/src/brand.ts`.
- Адреса для запросов на удаление и вопросов о данных в документах нет. Google Play просит в форме Data safety веб-ссылку, по которой пользователь может запросить удаление аккаунта, не устанавливая приложение.

**Решения Sergey (2026-11-18):**

1. «Написать автору» ведёт на `support@wishmoon.clever-agency.dev`, а не на gmail.
2. `privacy@wishmoon.clever-agency.dev` указывается в политике конфиденциальности и в форме удаления данных Google Play. В интерфейсе отдельной ссылки нет: в приложении остаётся кнопка «Удалить аккаунт» (D-33). Константа `PRIVACY_EMAIL` в `brand.ts` появится вместе с политикой, а не сейчас.
3. Домен выбран, Q-2 закрыт. Переезд хостинга (Q-7) домен не меняет: при переезде меняются только DNS-записи.

**Тип:** новые факты от владельца. Объём MVP, эпики и порядок историй не меняются.

## 2. Анализ влияния

| Область | Влияние |
| --- | --- |
| Эпики и истории | Нет. Story 6.3 (`backlog`) уже требует «Написать автору» и кнопку удаления: адрес приходит из константы, критерии не меняются. Story 2.x (ссылка вишлиста) берёт домен из конфигурации — так и остаётся |
| PRD | D-35 — новый адрес контакта; новое D-48 — домен и служебные почты; Q-2 закрыт; сводка открытых вопросов; Q-8 — адрес privacy@ для политики |
| Архитектура | AD-24 — новое значение `AUTHOR_EMAIL` и будущая `PRIVACY_EMAIL`; строка Deferred о бренде и домене; ARCH-A2 |
| UX | DESIGN.md:332 и EXPERIENCE.md:357, :559 — домен больше не открыт |
| Чеклист перед публикацией | п. 4 — privacy@ в политике; п. 6 — веб-способ запросить удаление для Google Play; п. 7 — домен выбран, остаются `assetlinks.json` и `apple-app-site-association`; итоговая строка |
| Документация | `docs/deployment-environments.md` — раздел о почтовых ящиках; README — адрес «Написать автору» не упоминается буквально, правка не нужна |
| Код | `packages/contracts/src/brand.ts`: `AUTHOR_EMAIL` → `support@wishmoon.clever-agency.dev`. Ссылки в приложении, на Next-страницах и в письмах — производные `AUTHOR_MAILTO`/`authorMailto()`, меняются сами. Тесты с литералом адреса (если есть) обновляются |
| Инфраструктура | Нет. DMARC `rua` на gmail — адрес для отчётов, не публичный контакт; не трогаем |

## 3. Рекомендуемый путь

**Прямая правка (Direct Adjustment).** Документы правятся этим предложением, код — маленькой задачей через `bmad-build` (без истории, спека `spec-support-email-author-contact.md`); документы и код идут одним PR в `staging`, потому что это одно решение. Риск низкий: адрес меняется в одной константе. Перед мержем стоит отправить тестовое письмо на `support@` и убедиться, что оно доходит.

## 4. Правки

### 4.1 PRD (`prds/prd-gift-list-2026-09-30/prd.md`)

**frontmatter `decisions_locked`** — добавить `domain-and-mailboxes-D-48`; `updated: 2026-11-18`.

**§7, строка про имя продукта (:755)**

OLD: `… Домен переменная не задаёт (Q-2, D-35).`
NEW: `… Домен переменная не задаёт: он выбран — `wishmoon.clever-agency.dev` (D-48).`

**§11, Q-2 (:802)**

OLD: `2. **Q-2.** Домен не выбран. Имя продукта выбрано 2026-11-10 — WishMoon (D-35) и разработку не блокирует: одна константа по умолчанию и одна переменная-переопределение на веб и приложение. Домен остаётся открытым.`
NEW: `2. **Q-2.** *(закрыт 2026-11-18, D-48)* Имя — WishMoon (D-35), домен — `wishmoon.clever-agency.dev`, staging — `staging.wishmoon.clever-agency.dev`.`

**§11, Q-8 (:808)** — после «Согласия на обработку персональных данных и политика конфиденциальности — до публикации, в чеклисте.» добавить: `Контакт для запросов о данных и удалении аккаунта в политике — `privacy@wishmoon.clever-agency.dev` (D-48).`

**§11, сводка (:817)**

OLD: `Открыты до публикации, не блокируют разработку MVP: Q-2 (только домен), Q-3, Q-7, Q-14 и юридическая сверка жалоб из Q-1.`
NEW: `Открыты до публикации, не блокируют разработку MVP: Q-3, Q-7, Q-14 и юридическая сверка жалоб из Q-1. Q-2 закрыт (D-48).`

**§12, D-35 (:848)**

OLD: `… (ред. 2026-11-10, Evgeniy). Отображаемое имя — **WishMoon**; публичный контакт — `clever.web.agency@gmail.com`, … Контакт окружением не переопределяется. Домен остаётся в Q-2.`
NEW: `… (ред. 2026-11-10, Evgeniy; контакт — ред. 2026-11-18, Sergey). Отображаемое имя — **WishMoon**; публичный контакт — `support@wishmoon.clever-agency.dev`, … Контакт окружением не переопределяется. Домен — D-48.`

**§12, новое D-48** (после D-47)

`| **D-48** | §7, §11 | **Домен и служебные почты** (Sergey, 2026-11-18, закрывает Q-2). Прод — `wishmoon.clever-agency.dev`, staging — `staging.wishmoon.clever-agency.dev`. `support@wishmoon.clever-agency.dev` — техподдержка, на него ведёт «Написать автору» (D-35). `privacy@wishmoon.clever-agency.dev` — запросы на удаление аккаунта и вопросы о персональных данных: указывается в политике конфиденциальности и в форме удаления данных Google Play, в интерфейсе отдельной ссылкой не показывается (в приложении — кнопка «Удалить аккаунт», D-33). Письма сервиса уходят с `noreply@` домена своего окружения (прод — `noreply@wishmoon.clever-agency.dev`, staging — `noreply@staging.wishmoon.clever-agency.dev`). Переезд хостинга (Q-7) домен не меняет. |`

### 4.2 Архитектура (`ARCHITECTURE-SPINE.md`)

**AD-24 Rule (:363)**

OLD: `` `AUTHOR_EMAIL = "clever.web.agency@gmail.com"` `` … `Домен эта переменная не задаёт (Q-2).`
NEW: `` `AUTHOR_EMAIL = "support@wishmoon.clever-agency.dev"` `` (D-35, ред. 2026-11-18) … `Адрес для запросов о данных и удалении — `privacy@wishmoon.clever-agency.dev` (D-48); когда он понадобится в коде (ссылка на политику), это константа `PRIVACY_EMAIL` в том же файле, не литерал. Домен эта переменная не задаёт: он выбран (D-48) и приходит из конфигурации окружения (AD-26).`

**Deferred (:580)**

OLD: `| Финальный бренд/домен | Q-2 открыт |`
NEW: `| Финальный бренд/домен | Закрыт: WishMoon, `wishmoon.clever-agency.dev` (D-35, D-48) |`

**ARCH-A2 (:591)**

OLD: `| ARCH-A2 | Имя — WishMoon, дефолт в `packages/contracts`, переопределение `BRAND_NAME` (AD-24). Домен открыт | Q-2, D-35 |`
NEW: `| ARCH-A2 | Имя — WishMoon, дефолт в `packages/contracts`, переопределение `BRAND_NAME` (AD-24). Домен — `wishmoon.clever-agency.dev` | D-35, D-48 |`

### 4.3 UX

**DESIGN.md:332** — `домен остаётся открытым (Q-2)` → `домен — `wishmoon.clever-agency.dev` (D-48)`; `«Написать автору» — `mailto:` на `AUTHOR_EMAIL`` → `… на `AUTHOR_EMAIL` (`support@wishmoon.clever-agency.dev`)`.

**EXPERIENCE.md:357** — `| Brand | Provisional DESIGN.md; Q-2 open to confirm |` → `| Brand | DESIGN.md; имя WishMoon (D-35), домен `wishmoon.clever-agency.dev` (D-48) |`.

**EXPERIENCE.md:559** — `домен открыт (Q-2)` → `домен `wishmoon.clever-agency.dev` (D-48)`; последний столбец `Домен — да; имя и палитра — нет` → `Нет`.

### 4.4 Чеклист перед публикацией (`pre-release-checklist.md`)

- **п. 4** — добавить: `Контакт в политике для запросов о данных — `privacy@wishmoon.clever-agency.dev` (D-48).`
- **п. 6** — добавить: `Для Google Play в форме Data safety — веб-ссылка, где можно запросить удаление без приложения: раздел политики с адресом `privacy@wishmoon.clever-agency.dev` (D-48).`
- **п. 7** — `Выбрать домен (Q-2) и опубликовать на нём` → `Домен выбран — `wishmoon.clever-agency.dev` (D-48). Опубликовать на нём`; статус `Открыто` → `Домен — готово; файлы — открыто`; ссылка `Q-2, AD-26` → `D-48, AD-26`.
- **Итоговая строка** — `домен остаётся в Q-2` → `домен — `wishmoon.clever-agency.dev` (D-48)`.

### 4.5 Документация

`docs/deployment-environments.md`, раздел «Общие правила эксплуатации» — добавить:

`- Почтовые ящики продукта: `support@wishmoon.clever-agency.dev` — техподдержка, на него ведёт «Написать автору» (`AUTHOR_EMAIL`); `privacy@wishmoon.clever-agency.dev` — запросы на удаление аккаунта и о персональных данных (политика, форма Google Play). Письма сервиса уходят с `noreply@` (`EMAIL_FROM`), ответы на него не читаются (D-35, D-48).`

### 4.6 Код (отдельная задача через `bmad-build`, без истории)

- `packages/contracts/src/brand.ts`: `AUTHOR_EMAIL = "support@wishmoon.clever-agency.dev"`, комментарий — «owner's decision 2026-11-18 (D-35, D-48)».
- Найти и обновить тесты и stories с литералом `clever.web.agency@gmail.com`.
- Готово, когда `typecheck`, `lint`, `test`, `build` зелёные и «Написать автору» в приложении и на `/l`, `/i`, `/unsubscribe` ведёт на `support@`. Письма такую ссылку пока не показывают; когда покажут, адрес придёт из той же константы.

## 5. Передача

- **Объём:** minor. Документы правит Developer этим предложением после одобрения; код — задача `bmad-build`; всё одним PR в `staging`.
- **Критерии успеха:** в планировании нет открытого Q-2; во всех документах и в `brand.ts` один адрес контакта — `support@`; `privacy@` есть в D-48, AD-24 и чеклисте.
