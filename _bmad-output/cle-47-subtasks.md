# CLE-47 Story 2.2 — subtasks (Создание и редактирование желания)

Source: epics.md → Epic 2 → Story 2.2; Linear CLE-47. FR-10, D-25, D-36, D-37, AD-1, AD-8, AD-12, AD-25, ARCH-A17; EXPERIENCE.md → «Ошибки форм».

## Contracts (packages/contracts)
- [x] 1. `giftInputSchema` (create body): title required (trimmed, length limits), description/priceAmount/linkUrl optional, priceCurrency enum USD/EUR/CNY/BYN/RUB default USD when price set, visibility default PUBLIC
- [x] 2. Contract tests for `giftInputSchema` (required title, optional fields, currency default, invalid currency/price/url)
- [x] 3. `giftUpdateSchema` (partial edit body) + tests
- [x] 4. Gift form i18n keys (ru/app.json): labels, placeholders, field errors, save/cancel

## Web use-case (apps/web)
- [x] 5. `createGift` action: session required, owner's single list, status OPEN, returns AD-12 gift card
- [x] 6. Tests for `createGift` (401, validation errors, defaults PUBLIC/USD, OPEN, list ownership)
- [x] 7. `updateGift` action: owner only, same use-case module (AD-1), returns AD-12 card
- [x] 8. Tests for `updateGift` (401, not owner → NOT_FOUND/FORBIDDEN, partial update, validation)
- [x] 9. `POST /api/v1/me/gifts` route → createGift + route test
- [x] 10. `PATCH /api/v1/me/gifts/[id]` route → updateGift + route test
- [x] 11. `GET /api/v1/me/gifts/[id]` (load one own gift for edit) + test

## Mobile API (apps/mobile/src/api)
- [x] 12. `createGift` client fn (contract re-check) + test
- [x] 13. `updateGift` / `fetchGift` client fns + tests

## Mobile form
- [x] 14. `GiftForm` component skeleton (title, description) — extensible field list for 2.3/2.5
- [x] 15. Price field (minor units input) + currency picker (default USD)
- [x] 16. Link field + visibility field (default PUBLIC)
- [x] 17. Inline field errors per EXPERIENCE.md «Ошибки форм» + server error mapping
- [ ] 18. GiftForm tests (required title, defaults, error display)

## Mobile screens
- [ ] 19. Replace `/gifts/new` placeholder with create screen (submit → back to list, list refresh)
- [ ] 20. Edit screen `/gifts/[id]/edit` (load, submit, not-found state)
- [ ] 21. Open edit from gift card on «Мой вишлист»
- [ ] 22. Screen tests (create flow, edit flow, network/401 errors)

## Wrap-up
- [ ] 23. Full check: typecheck, lint, tests, build, check-boundaries