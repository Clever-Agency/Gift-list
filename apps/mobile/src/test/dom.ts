import { act } from "react";

/**
 * What a user would press: native buttons (`Button` renders `<button>`), pressable
 * surfaces (`Pressable` is `role="button"`), and radios of a choice list.
 */
export const CONTROLS = 'button, [role="button"], [role="radio"], [role="checkbox"]';

/** The open layer. A `Dialog` is portalled to `document.body`, outside the test container. */
export const DIALOG = '[role="dialog"], [role="alertdialog"]';

export function controls(scope: ParentNode = document): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(CONTROLS));
}

/** The first control whose visible text contains `label`. */
export function controlByText(label: string, scope: ParentNode = document): HTMLElement | undefined {
  return controls(scope).find((node) => (node.textContent ?? "").includes(label));
}

/** The first control with exactly this accessible name. */
export function controlByLabel(label: string, scope: ParentNode = document): HTMLElement | undefined {
  return controls(scope).find((node) => node.getAttribute("aria-label") === label);
}

export function dialogElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(DIALOG);
}

export async function click(node: Element | null | undefined): Promise<void> {
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Lets the timers and frames a layer queues on open and close run. */
export async function settle(ms = 60): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

/** Controlled input: set the value past React's tracker, then let React see the `input` event. */
export async function typeInto(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function escape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

/**
 * A press on the scrim of a layer: the browser dismisses on a pointer press outside the
 * content, then the click follows.
 */
export async function pressScrim(testID: string): Promise<void> {
  const scrim = document.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
  await act(async () => {
    scrim?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    scrim?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(10);
}
