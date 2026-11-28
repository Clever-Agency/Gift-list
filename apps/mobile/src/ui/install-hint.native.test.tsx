// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstallHint, useInstallHint } from "@/ui/install-hint.native";

let root: Root;
let container: HTMLElement;

/** The native twin of the hint: it draws nothing and has nothing to remember. */
function Harness() {
  const hint = useInstallHint();
  return (
    <>
      <span>{String(hint.visible)}</span>
      {hint.visible ? <InstallHint onClose={hint.dismiss} /> : null}
    </>
  );
}

Harness.displayName = "Harness";

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("подсказка установки на телефоне", () => {
  it("не рендерится и не просит закрыть себя", async () => {
    await act(async () => root.render(<Harness />));

    expect(container.textContent).toBe("false");
    expect(container.querySelector('[data-testid="install-hint"]')).toBeNull();
  });
});
