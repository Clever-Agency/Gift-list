/**
 * The role of the shared `Pressable`, web half of the platform pair.
 *
 * The browser has one role attribute and the caller already picks it when the
 * surface is not a plain button: `Choice` passes `radio`, `AuthorLink` `link`,
 * `TagChip` its own role. Without a caller role the surface stays
 * `<div role="button">`, exactly as before W12.10, so the DOM of every consumer
 * is byte-for-byte the same. The phone takes `pressable-role.native.ts`: React
 * Native resolves `role` before `accessibilityRole`, so the default has to move
 * there for a `togglebutton` to be reachable.
 */
export const pressableRole = { role: "button" } as const;
