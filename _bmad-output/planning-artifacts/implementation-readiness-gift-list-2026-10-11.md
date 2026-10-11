---
project_name: Gift List
round: 1
language: ru
workflow: bmad-sprint-planning
gate: PASS
date: 2026-10-11
supersedes: implementation-readiness-gift-list-2026-09-30.md
trigger: sprint-change-proposal-2026-10-10 (D-12, D-13)
epics_source: _bmad-output/planning-artifacts/epics/epics-gift-list-2026-09-30/epics.md
status_file: _bmad-output/implementation-artifacts/sprint-status.yaml
---

# Implementation Readiness — Gift List Раунд 1 (после correct course 2026-10-10)

## Вердикт: PASS

План Раунда 1 можно реализовать, не придумывая незафиксированных решений. Модель брони D-12 / D-13 прослеживается от PRD через архитектуру и UX до историй Epic 5–6. Трекинг синхронизирован скриптом: 6 эпиков / 30 историй / 6 ретроспектив (optional); статусы Epic 1 сохранены (1.1 done, 1.2 review).

## Inventory артефактов

| Артефакт | Путь | Статус |
|----------|------|--------|
| Product brief | `briefs/brief-gift-list-2026-09-29/brief.md` | ✅ (модель брони не затрагивает) |
| PRD + addendum | `prds/prd-gift-list-2026-09-30/` | ✅ D-12, D-13; FR-29…FR-32; A-9, A-23 сняты |
| UX DESIGN + EXPERIENCE | `ux-designs/ux-gift-list-2026-09-30/` | ✅ EXPERIENCE обновлён; DESIGN без изменений |
| UX prototype | `ux-designs/ux-gift-list-2026-09-30/prototype/index.html` | ⚠️ модель брони не отражена (spine главнее) |
| Architecture Spine | `architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md` | ✅ AD-1…AD-15, ARCH-A14/A15 |
| Epics & Stories | `epics/epics-gift-list-2026-09-30/epics.md` | ✅ 6 / 30 |
| Sprint change proposal | `sprint-change-proposal-2026-10-10.md` | ✅ approved |
| Discussion backlog | `discussion-backlog-2026-10-11.md` | ✅ чат 2 закрыт |

## Locked decisions

- Два списка: Discoverable + Friends-only; D-10 взаимная дружба; D-11 ссылки на списки; A-24 R1 без оплаты
- **D-12** жизненный цикл брони (Срок дарителя +7 / ≤ +30; 72 ч → запрос владельцу; 168 ч → авто-снятие только без «Купил»; «Купил» / «Подарил»; закрытие только владельцем, отмена 10 с; email по событиям брони в R1)
- **D-13** видимость держателя (владельцу — по умолчанию нет, другим — да)
- Переносимость: без Vercel Cron / Blob / KV / Edge Config; таймеры — Route Handler + внешний планировщик

## Трассировка

| Решение / требование | Архитектура | Истории |
|---|---|---|
| FR-17 бронь со Сроком и видимостью | AD-8, AD-9, AD-12 | 5.1, 5.2 |
| FR-29 цикл истечения | AD-5, AD-9, ARCH-A14/A15 | 5.6 (+ 5.5 продление) |
| FR-30 «Купил» / «Подарил» | AD-9 | 5.5, 5.7 |
| FR-31 видимость держателя | AD-7 (матрица по ролям), AD-12, AD-14 | 3.2 (контракт), 5.1, 5.8 (тест 5) |
| FR-32 закрытие, отмена, копия | AD-8, AD-9, AD-14 `deliverAfter` | 5.3, 5.8 (тест 8) |
| FR-10 удаление / правка RESERVED | AD-8 | 5.4 (путь из 2.3) |
| FR-25 «Мои брони» | AD-7 reservation card | 5.5 |
| FR-26 in-app + email | AD-14 | 6.1 |
| SM-2 / инвариант «купленную бронь не снимаем» | AD-9 CAS, AD-15 тесты 6–7 | 5.6, 5.8 |
| SM-C1 одно уведомление на событие | AD-14 | 6.1 |
| UJ-7 → Flow 7 | — | 5.6 |
| Flow 8 (получено вне сервиса) | — | 5.3 |

Покрыты FR R1: 1..3, 5..15, 17, 23..32. Deferred R2: FR-4, 16, 18–22. Сирот нет ни в одну сторону.

## Проверки, исправленные в ходе gate

1. **Ключи sprint-status не совпадали с заголовками историй** (4 ключа Epic 5 были сокращены вручную) → пересинхронизированы скриптом, статусы сохранены.
2. **Зависимости вперёд внутри Epic 5**: ветка «Подарил» (GIVEN) в 5.2 и 5.5 зависит от 5.7 → в AC явно помечено «достижимо после 5.7» (тот же приём, что 2.3 → 5.4).

## Non-blocking notes

1. **Внешний планировщик для `api/cron/reservation-timers`** не выбран (ARCH-A15). Нужен к началу Story 5.6; задача записана в `discussion-backlog-2026-10-11.md`.
2. **Прототип** не отражает модель брони; при реализации Epic 5 ориентир — EXPERIENCE.md.
3. **Soft cross-epic**: доставка in-app / email (Epic 6) после событий 5.x — как и раньше; цикл брони в Epic 5 работоспособен и без доставки (метки на карточках и в «Моих бронях»).
4. **Открытые чаты бэклога могут задеть план**: чат 1 (рынки / хостинг — AD-5, часовой пояс в профиле vs A-27), чат 3 (напоминания, отписка от писем — риск R-3), чат 4 (web push). Ни один не блокирует Epic 1–4; перед Epic 5 стоит проверить `git log -- _bmad-output`.
5. Parser warnings на `# Gift List - Epic Breakdown` и `## Epic List` — false positive.
6. Ключи на кириллице — допустимо для file-system tracking.
