# CLE-45 review fixes (cloud agent review bc-2fd6cdf6-05b5-52e5-92f0-a760c00041d5)

## Major
- [x] M1 "Add wish" CTA pushes to /gifts/new which does not exist (apps/mobile/app/(app)/index.tsx:110-112)
- [x] M2 No fetch timeout; hung request = endless skeleton. Add AbortSignal.timeout(10_000) in apiRequest (client.ts)
- [x] M3 401 does not show toast "Сессия закончилась, войдите снова"
- [x] M4 Gift card ignores reservation phase / ownerAction, always shows "Берёт {name}" (gift-card.tsx:31-35)
- [x] M5 CLOSED gift drops reservedBy even when holderVisibleToOwner (my-gifts.ts:89-90)

## Minor
- [x] m1 Missing list / not_found rendered as empty wishlist
- [x] m2 Contract parse failure shown as network error
- [x] m3 Error screen always talks about network
- [x] m4 Toast pointerEvents in style instead of prop; toast covers "Выйти"
- [x] m5 No list/listitem accessibility roles
- [x] m6 Visibility chip has no icon
- [x] m7 Card grid width wrong on narrow screens / safe area
- [ ] m8 Test gaps
- [ ] m9 List not refreshed on screen focus (useFocusEffect)

## Nits
- [ ] N1 Visibility filter should pass list.ownerId
- [ ] N2 "Every field" contract test should omit one field at a time
- [ ] N3 Hard-coded padding literal
- [ ] N4 Ghost "Посмотреть подборки" button not needed yet