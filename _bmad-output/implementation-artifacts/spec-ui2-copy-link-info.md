---
title: 'UI2 — ссылка только при публичных желаниях и Info рядом'
type: 'feature'
created: '2026-11-07'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** «Скопировать ссылку» доступна и копирует URL даже когда по публичной ссылке нечего показывать: в вишлисте нет ни одного неархивного желания с видимостью `PUBLIC`. Пользователь делится пустой страницей и не понимает, что именно видят гости.

**Approach:** Выключать копирование, пока в загруженном списке нет хотя бы одного `PUBLIC`-желания без `archivedAt`; отдельная всегда активная Lucide-кнопка Info рядом с копированием показывает одно и то же пояснение в обоих состояниях. На вебе — официальный Tamagui Tooltip, на native — Tamagui Dialog, потому что Tooltip на native не рисует контент.

## Boundaries & Constraints

**Always:** приватность не расширять; `FRIENDS`, `SECRET` и архивные не считать публичными; disabled-копирование не создаёт URL и не пишет в буфер; Info не зависит от disabled-состояния копирования; клавиатура, touch и screen reader получают пояснение; тексты — из `packages/contracts/src/i18n/ru`.

**Never:** не менять серверную `VisibilityPolicy`, схему БД, API, env и деплой; не добавлять произвольную библиотеку иконок; не выдавать unit-проверки за браузерные, эмуляторные или device-проверки; не пересобирать APK.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty | `gifts: []` | Copy disabled, no clipboard write, reason in accessible name | Info works |
| Private-only | only `FRIENDS`/`SECRET`/archived `PUBLIC` | Copy disabled, no clipboard write | Info works |
| Eligible | at least one non-archived `PUBLIC` | Copy enabled; existing URL/toast behavior | unchanged |
| Loading | pending list read | no copy control | no accidental share |
| Load error | failed list read | no copy control | retry view unchanged |

</frozen-after-approval>

## Implementation Notes

- `apps/mobile/src/wishlist/share-availability.ts` — `hasWishVisibleToEveryone` mirrors AD-7: `PUBLIC` and `archivedAt === null`. Reserved/closed stay eligible because the server does not hide them from the public read.
- `apps/mobile/app/(app)/index.tsx` — one `canShare` value drives the copy button and its guard; the actions row still renders only in `ready`, so loading/error/missing cannot share. Copy keeps its visible label; a disabled one gets the reason appended to `aria-label` and stays in the Tab order via `focusableWhenDisabled`.
- `packages/ui/src/button.tsx` — optional `ariaLabel` lets a disabled button explain itself without changing its visible text.
- `packages/ui/src/info-button.tsx` — official `@tamagui/tooltip` (3.1.10) on web; opens on keyboard focus and sets `aria-describedby`. `info-button.native.tsx` uses the package's Tamagui `Dialog`, because the installed `@tamagui/tooltip` native entry renders the trigger and drops `Tooltip.Content`; this was read from `node_modules/@tamagui/tooltip/src/Tooltip.native.tsx` and the live docs.
- `packages/ui/src/icons/Info.tsx` — Lucide Info path from the official Tamagui v3 generator; the web twin is a plain SVG so the browser/test bundle never pulls `react-native-svg`, while `Info.native.tsx` keeps the generated `@tamagui/helpers-icon` + `react-native-svg` component for native.
- Dependencies added in workspaces only: `@tamagui/tooltip@3.1.10`, `@tamagui/helpers-icon@3.1.10` in `packages/ui`; `react-native-svg@15.16.0` in `apps/mobile` (Expo SDK 58 bundled version). Root lock is the only lock.
- RU catalog is the only supported locale (`SUPPORTED_LOCALES = ["ru"]`); no EN catalog exists to preserve or extend.
- Tests: helper unit cases; screen DOM tests for empty/private/eligible/loading/error, disabled focusability, same Info text in both states and `aria-describedby`; UI DOM test mounts the native variant and verifies the visible Dialog. No browser, emulator or device run was made.
- Review fixes: visible disabled reason plus `aria-describedby`; web tooltip also opens on click/tap; native dialog uses `description`; native trigger has `aria-haspopup="dialog"` and returns focus; icon size uses `spacing["icon-inline"]`; the icons barrel is used; the web icon keeps its decorative ARIA after prop spreading; `react-native-svg` is declared as an optional peer of `packages/ui`.

## Review Triage Log

- Disabled reason only in `aria-label` → **fixed**: visible `copyLinkDisabledReason` text with `aria-describedby`, covered by a DOM test.
- Help/reason omit archive and call FRIENDS «приватные» → **partly fixed, otherwise rejected**: the disabled reason now names private and archived; the requested explanation string was kept verbatim, and on a public link both FRIENDS and SECRET are private relative to «все».
- `publicToken: null` leaves copy enabled → **false for this task**: the accepted requirement is «≥ one eligible PUBLIC enables»; a missing token is a defensive server inconsistency handled by the existing error toast, and a test pins that.
- Web Info is hover/focus-only for touch → **fixed**: controlled Tooltip also opens on click/tap; a DOM test covers press.
- Native dialog has no accessible description → **fixed**: `description={explanation}`; test reads `aria-describedby`.
- Native focus not restored → **fixed**: trigger ref + `onClosed`; test checks focus return.
- Native trigger has no `aria-haspopup` → **fixed**.
- Icon source/size/duplication → **size fixed** (`spacing["icon-inline"]`); two platform files are deliberate, and `lucide-react-native` is rejected because the task requires official Tamagui packages and forbids an arbitrary icon library.
- Unused icons barrel → **fixed**: both buttons import `./icons`.
- Web icon props could override decorative ARIA → **fixed**: decorative attributes are applied after `{...rest}`; native wrapper passes `accessible={false}`.
- Missing `react-native-svg` declaration → **fixed**: optional peer dependency.
- `closeLabel` required on web and duplicates «Закрыть» → **rejected (low)**: no interface copy lives in `packages/ui`; the caller already owns locale strings.
- Preexisting `tsconfig.json`/`expo-env.d.ts` changes → **false**: they predate UI2 and were explicitly ordered preserved byte-for-byte and excluded from the commit.
- Missing hover/Escape and bundle build checks → **deferred to UI7**: this task’s minimum is covered by focus/press DOM tests; `npm run build` regenerates `apps/web/public` and is outside UI2.
- `epics.md`/`DESIGN.md`/`sprint-status.yaml` not updated → **rejected for this task**: product docs change only through `bmad-correct-course`/`bmad-architecture`; UI2 is a local microtask, and the Russian report records the follow-up.


## Verification

- `npm test -w @gift-list/mobile` — expected all pass.
- `npm test -w @gift-list/ui` — expected all pass.
- `npm test -w @gift-list/contracts` — expected all pass.
- `npm run typecheck` (root) — expected exit 0.
- `npm run lint` (root, includes boundaries) — expected exit 0.
- Not run: `npm run build` (it regenerates `apps/web/public` from Expo web); real browser/emulator/device/a11y runs.
