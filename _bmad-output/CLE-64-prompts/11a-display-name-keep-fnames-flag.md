# CLE-64 / 11a - explicit displayName for every exported component + KEEP_FNAMES opt-in

Repo `D:\Clever\Gift-list`, branch `chore/cle-64-named-functions`. Do NOT commit, push, run npm install/ci, or edit any .env* file. Do not touch apps/web, packages/contracts, or files not listed below.

## Why
Prod web bundle is minified by terser, which renames `function WishCard` to `function a`, so React DevTools shows `Anonymous`. A string `displayName` survives minification. Keeping function names in terser (+~10% JS) must become an opt-in local debug flag.

## 1. displayName (one line right after each component, `X.displayName = "X";`, string equals the function name)
Add for every exported React component, keep the existing `function` declarations unchanged:
- apps/mobile/src/ui: AnonymousScreen (anonymous-screen.tsx), AuthorLink (author-link.tsx), ConfirmDialog (confirm-dialog.tsx), EmptyState (empty-state.tsx), WishCard (gift-card.tsx), ChoiceGroup (gift-form.tsx), PrimaryButton (primary-button.tsx), WishCardSkeleton (skeleton.tsx), StatusPill (status-pill.tsx), TextField and PasswordField (text-field.tsx), ToastHost (toast.tsx), VisibilityChip (visibility-chip.tsx), VisibilityPicker (visibility-picker.tsx). GhostButton and GiftForm already have it - leave them.
- apps/mobile/src/session/auth-context.tsx: AuthProvider.
- apps/mobile/app: default-export screens EditGiftScreen, NewGiftScreen, MyWishlistScreen, SettingsScreen, ForgotScreen, LoginScreen, RegisterScreen, ResetScreen, InviteReturnScreen, WishlistReturnScreen, RootLayout (_layout.tsx), Root (+html.tsx). Keep `export default function X()` as is and add `X.displayName = "X";` after the function body.
- Generic ChoiceGroup<T>: `ChoiceGroup.displayName = "ChoiceGroup";` works as is.
- Also any other non-exported component in these files that renders JSX (a capitalized function returning JSX): add displayName too.
Do NOT touch hooks (useAuth, useLayerClosed ...) or plain helpers.

## 2. apps/mobile/metro.config.js
Keep `withKeptNames` as is. Apply it only when `process.env.KEEP_FNAMES` is "1" or "true" (case-insensitive, trimmed). Use a named function `keepFnamesEnabled()`. Default (unset) = config.transformer.minifierConfig untouched, identical to main. Update the comment: opt-in local debug flag, adds ~10% JS, not set on Vercel.

## 3. Test apps/mobile/src/ui/component-names.test.tsx
Add a test: every exported component from src/ui modules (the existing import.meta.glob `components` list) has `displayName` (for forwardRef/memo objects read `.displayName` on the object) equal to its export name. Add a second test with `import.meta.glob` over `../../app/**/*.tsx` (exclude *.test.tsx) checking each module's `default` export has a string displayName equal to `default.name`. If importing screens in happy-dom fails due to native modules, mock what is needed the same way the file already mocks react-native; if truly infeasible, explain in your final message. Do not reduce existing tests.

## 4. Docs
AGENTS.md section "Code style: named functions" and .cursor/rules/named-functions.mdc: components are a named `function` PLUS `X.displayName = "X";` (because prod minification strips function names); the test in component-names.test.tsx enforces it for src/ui and app screens. Document the local flag:
- `KEEP_FNAMES=1` makes terser keep all function/class names (incl. libraries) in the web export; ~+10% JS; never set on Vercel.
- Windows PowerShell: `$env:KEEP_FNAMES=1; node apps/web/scripts/sync-spa.mjs` (or `npm run build` in apps/web), then `Remove-Item Env:KEEP_FNAMES`. bash: `KEEP_FNAMES=1 node apps/web/scripts/sync-spa.mjs`.
Keep the rest of the docs unchanged.

## Checks (in apps/mobile): `npm run typecheck`, `npm test`, `npm run lint`. Report changed files and results.
