# CLE-64 / 11c - restore WishCard.displayName

Repo `D:\Clever\Gift-list`, branch `chore/cle-64-named-functions`. Do NOT commit, push, npm install/ci, or edit .env*.
In `apps/mobile/src/ui/gift-card.tsx`, right after the closing brace of `export function WishCard(...)` add a blank line and `WishCard.displayName = "WishCard";` (same style as `VisibilityChip.displayName` in visibility-chip.tsx). Touch nothing else.
Check: in apps/mobile `npx vitest run src/ui/component-names.test.tsx` passes.
