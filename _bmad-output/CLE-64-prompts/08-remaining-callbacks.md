# CLE-64 / 08 — оставшиеся анонимные колбэки (итоговый аудит)

Рабочая папка `D:\Clever\Gift-list`, ветка `chore/cle-64-named-functions`. Только локальные правки: НЕ коммить, НЕ пушь, не запускай npm install/ci, не трогай .env*, Prisma, Linear. Прочитай `AGENTS.md` раздел «Code style: named functions» и `.cursor/rules/named-functions.mdc`. Чистый рефакторинг: поведение, deps-массивы, типы и тексты не менять. Комментарии сохранить.

Итоговый AST-аудит нашёл неименованные функции, нарушающие правило. Переименуй РОВНО эти места (имена — как указано или близкие по смыслу):

1. `apps/mobile/app/_layout.tsx:24` — `SplashScreen.preventAutoHideAsync().catch(() => { /* коммент */ })` → `.catch(function ignoreNoSplash() { /* тот же коммент */ })`.
2. `apps/mobile/src/ui/author-link.tsx:22` — `.catch(() => {})` → `.catch(function ignoreOpenError() {})`.
3. `apps/mobile/src/ui/focus.ts` (`useLayerClosed`):
   - `useEffect(() => { closed.current = onClosed; })` → `useEffect(function syncClosedHandler() {…})` (без deps — как было);
   - `useEffect(() => {…}, [visible])` → `useEffect(function reportNativeClose() {…}, [visible])`;
   - `return useCallback(() => {…}, [])` → `return useCallback(function handleWebDismiss() {…}, [])`.
4. `apps/mobile/src/ui/confirm-dialog.tsx:130,135` — `useEffect(() => …)` → `useEffect(function resetAnswerOnOpen() …)` и `useEffect(function focusLayerOnOpen() …)`.
5. `apps/mobile/src/ui/gift-form.tsx`:
   - `:157` `useState<GiftFormDirtyValues>(() => ({…}))` → `useState<GiftFormDirtyValues>(function readInitialValues() { return {…}; })`;
   - `:179` `useImperativeHandle(ref, () => ({ focusCancel() {…} }), …)` → `useImperativeHandle(ref, function createFormHandle() { return { focusCancel() {…} }; }, …)` (deps без изменений).
6. `apps/mobile/app/(app)/gifts/[id]/edit.tsx:88` — `useState<ScreenState>(() => …)` → `useState<ScreenState>(function initialScreenState() { return …; })`.
7. `apps/mobile/app/(auth)/login.tsx:36` и `apps/mobile/app/(auth)/register.tsx:37` — в `function change(field, setValue)` `return (value: string) => {…}` → `return function handleFieldChange(value: string) {…};`.

НЕ трогать: style-колбэки, `.map/.filter/...`, однострочные setState-апдейтеры `setX((v) => …)`, тесты.

Проверки из корня: `npm run typecheck`, `npm test` (424+12=436 / 368 / 130), `npm run lint`. Отчёт: файлы и что сделано.
