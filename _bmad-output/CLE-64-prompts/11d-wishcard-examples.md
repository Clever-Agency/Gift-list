# CLE-64 / 11d - examples: GiftCard -> WishCard

Repo `D:\Clever\Gift-list`, branch `chore/cle-64-named-functions`. Do NOT commit, push, npm install/ci, or edit .env*.
The real card component is `WishCard` (apps/mobile/src/ui/gift-card.tsx). Replace the example identifier `GiftCard` with `WishCard` in:
- `.cursor/rules/named-functions.mdc` lines 16, 22, 30, 31 (both the identifier and the displayName string).
- `AGENTS.md` line 49 (`export function GiftCard() {}`).
Do not touch the `GiftCard` type from @gift-list/contracts anywhere in code. Change nothing else.
Check: repo root `npm run lint` exits 0.
